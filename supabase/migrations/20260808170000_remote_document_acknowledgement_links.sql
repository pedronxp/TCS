-- Ciência eletrônica remota por link revogável e de uso único.
-- O token puro nunca é persistido: somente seu SHA-256 fica no banco.

ALTER TABLE public.document_acknowledgement_events
  ADD COLUMN IF NOT EXISTS capture_source text NOT NULL DEFAULT 'device'
    CHECK (capture_source IN ('device', 'remote_link')),
  ADD COLUMN IF NOT EXISTS remote_request_id uuid;

CREATE TABLE IF NOT EXISTS public.document_acknowledgement_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.generated_documents(id) ON DELETE RESTRICT,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'revoked', 'expired')),
  expires_at timestamptz NOT NULL,
  completed_event_id uuid REFERENCES public.document_acknowledgement_events(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS document_acknowledgement_requests_open_document_idx
  ON public.document_acknowledgement_requests(document_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS document_acknowledgement_requests_token_idx
  ON public.document_acknowledgement_requests(token_hash);

ALTER TABLE public.document_acknowledgement_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.document_acknowledgement_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.register_generated_document(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_document_id uuid := nullif(p_payload->>'document_id', '')::uuid;
  v_vistoria_id uuid := nullif(p_payload->>'vistoria_id', '')::uuid;
  v_document public.generated_documents%ROWTYPE;
  v_vistoria public.vistorias%ROWTYPE;
  v_storage_path text := nullif(p_payload->>'storage_path', '');
  v_org uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF v_document_id IS NULL OR v_vistoria_id IS NULL
     OR p_payload->>'document_type' NOT IN ('report', 'technical_report', 'interdiction_term')
     OR coalesce((p_payload->>'document_version')::integer, 0) <= 0
     OR coalesce(p_payload->>'content_hash', '') !~ '^[0-9a-f]{64}$'
     OR coalesce(p_payload->>'pdf_hash', '') !~ '^[0-9a-f]{64}$'
     OR coalesce((p_payload->>'byte_size')::bigint, 0) NOT BETWEEN 1 AND 20971520
     OR coalesce((p_payload->>'training_mode')::boolean, false)
     OR v_storage_path IS NULL
  THEN RAISE EXCEPTION 'invalid_document_payload' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_vistoria FROM public.vistorias WHERE id = v_vistoria_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'inspection_not_found' USING ERRCODE = 'P0002'; END IF;
  v_org := v_vistoria.organization_id;
  IF NOT (v_vistoria."agenteUid"::text = v_user::text
    OR (v_org IS NOT NULL AND v_org = private.current_organization_id(v_user))
    OR private.is_owner_admin(v_user))
  THEN RAISE EXCEPTION 'document_scope_denied' USING ERRCODE = '42501'; END IF;
  IF position(v_user::text || '/' in v_storage_path) <> 1
    OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'document-evidence' AND name = v_storage_path)
  THEN RAISE EXCEPTION 'invalid_storage_scope' USING ERRCODE = '42501'; END IF;

  INSERT INTO public.generated_documents(
    id, vistoria_id, organization_id, owner_user_id, document_type, document_version,
    template_version, content_snapshot, content_hash, pdf_hash, storage_path, byte_size,
    supersedes_id, training_mode, created_by, created_at_device
  ) VALUES (
    v_document_id, v_vistoria_id, v_org, v_user, p_payload->>'document_type',
    (p_payload->>'document_version')::integer, p_payload->>'template_version',
    p_payload->'content_snapshot', p_payload->>'content_hash', p_payload->>'pdf_hash',
    v_storage_path, (p_payload->>'byte_size')::bigint, nullif(p_payload->>'supersedes_id', '')::uuid,
    false, v_user, (p_payload->>'document_created_at_device')::timestamptz
  ) ON CONFLICT (id) DO NOTHING;

  SELECT * INTO v_document FROM public.generated_documents WHERE id = v_document_id;
  IF NOT FOUND OR v_document.vistoria_id <> v_vistoria_id OR v_document.created_by <> v_user
     OR v_document.content_hash <> p_payload->>'content_hash' OR v_document.pdf_hash <> p_payload->>'pdf_hash'
  THEN RAISE EXCEPTION 'document_identity_conflict' USING ERRCODE = '23505'; END IF;

  UPDATE public.generated_documents
     SET status = 'superseded'
   WHERE vistoria_id = v_vistoria_id AND document_type = v_document.document_type
     AND id <> v_document_id AND document_version < v_document.document_version AND status <> 'superseded';

  RETURN jsonb_build_object('document_id', v_document.id, 'status', v_document.status);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_document_acknowledgement_link(
  p_document_id uuid,
  p_expires_in_hours integer DEFAULT 72
)
RETURNS TABLE(token text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_document public.generated_documents%ROWTYPE;
  v_token text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF p_expires_in_hours NOT BETWEEN 1 AND 168 THEN RAISE EXCEPTION 'invalid_expiration' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_document FROM public.generated_documents WHERE id = p_document_id;
  IF NOT FOUND OR v_document.training_mode OR v_document.status <> 'available'
     OR NOT private.can_access_document_scope(v_document.organization_id, v_document.owner_user_id, v_user)
  THEN RAISE EXCEPTION 'document_scope_denied' USING ERRCODE = '42501'; END IF;

  UPDATE public.document_acknowledgement_requests
     SET status = 'revoked'
   WHERE document_id = p_document_id AND status = 'open';
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  expires_at := clock_timestamp() + make_interval(hours => p_expires_in_hours);
  INSERT INTO public.document_acknowledgement_requests(document_id, organization_id, owner_user_id, token_hash, expires_at, created_by)
  VALUES (p_document_id, v_document.organization_id, v_document.owner_user_id,
    encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex'), expires_at, v_user);
  token := v_token;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION private.finalize_remote_document_acknowledgement(
  p_token_hash text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.document_acknowledgement_requests%ROWTYPE;
  v_document public.generated_documents%ROWTYPE;
  v_event_id uuid := gen_random_uuid();
  v_protocol text;
  v_outcome text := p_payload->>'outcome';
  v_signature jsonb := p_payload->'signature_strokes';
  v_signature_path text := nullif(p_payload->>'signature_storage_path', '');
BEGIN
  IF coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid_link' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_request FROM public.document_acknowledgement_requests WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'link_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_request.status = 'open' AND v_request.expires_at <= clock_timestamp() THEN
    UPDATE public.document_acknowledgement_requests SET status = 'expired' WHERE id = v_request.id;
    RAISE EXCEPTION 'link_expired' USING ERRCODE = 'P0002';
  END IF;
  IF v_request.status <> 'open' THEN RAISE EXCEPTION 'link_unavailable' USING ERRCODE = '23505'; END IF;
  SELECT * INTO v_document FROM public.generated_documents WHERE id = v_request.document_id;
  IF NOT FOUND OR v_document.status <> 'available' OR v_document.training_mode THEN RAISE EXCEPTION 'document_unavailable' USING ERRCODE = 'P0002'; END IF;
  IF EXISTS (SELECT 1 FROM public.document_acknowledgement_events WHERE document_id = v_document.id AND event_kind = 'outcome') THEN
    RAISE EXCEPTION 'document_already_acknowledged' USING ERRCODE = '23505';
  END IF;
  IF v_outcome NOT IN ('acknowledged', 'refused', 'unable_to_sign')
     OR length(btrim(coalesce(p_payload->>'recipient_name', ''))) < 2
     OR length(btrim(coalesce(p_payload->>'recipient_relationship', ''))) < 2
     OR length(btrim(coalesce(p_payload->>'declaration_text', ''))) < 20
     OR coalesce(p_payload->>'declaration_hash', '') !~ '^[0-9a-f]{64}$'
  THEN RAISE EXCEPTION 'invalid_acknowledgement_payload' USING ERRCODE = '22023'; END IF;
  IF v_outcome = 'acknowledged' THEN
    IF v_signature IS NULL OR jsonb_typeof(v_signature) <> 'array' OR jsonb_array_length(v_signature) = 0
      OR coalesce(p_payload->>'signature_hash', '') !~ '^[0-9a-f]{64}$' OR v_signature_path IS NULL
      OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'document-evidence' AND name = v_signature_path)
    THEN RAISE EXCEPTION 'signature_required' USING ERRCODE = '22023'; END IF;
  ELSIF length(btrim(coalesce(p_payload->>'reason', ''))) < 3 THEN RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023'; END IF;

  v_protocol := 'TCS-CIE-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || upper(substr(replace(v_event_id::text, '-', ''), 1, 8));
  INSERT INTO public.document_acknowledgement_events(
    id, client_event_id, document_id, organization_id, owner_user_id, event_kind, outcome,
    declaration_version, declaration_text, declaration_hash, recipient_name, recipient_relationship,
    signature_strokes, signature_hash, signature_storage_path, reason, occurred_at_device,
    created_by, protocol, capture_source, remote_request_id
  ) VALUES (
    v_event_id, gen_random_uuid(), v_document.id, v_document.organization_id, v_document.owner_user_id, 'outcome', v_outcome,
    p_payload->>'declaration_version', p_payload->>'declaration_text', p_payload->>'declaration_hash',
    btrim(p_payload->>'recipient_name'), btrim(p_payload->>'recipient_relationship'),
    CASE WHEN v_outcome = 'acknowledged' THEN v_signature ELSE NULL END,
    CASE WHEN v_outcome = 'acknowledged' THEN p_payload->>'signature_hash' ELSE NULL END,
    CASE WHEN v_outcome = 'acknowledged' THEN v_signature_path ELSE NULL END,
    CASE WHEN v_outcome <> 'acknowledged' THEN btrim(p_payload->>'reason') ELSE NULL END,
    clock_timestamp(), v_document.owner_user_id, v_protocol, 'remote_link', v_request.id
  );
  UPDATE public.document_acknowledgement_requests
     SET status = 'completed', completed_event_id = v_event_id, completed_at = clock_timestamp()
   WHERE id = v_request.id;
  RETURN jsonb_build_object('event_id', v_event_id, 'protocol', v_protocol, 'recorded_at_server', clock_timestamp());
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_remote_document_acknowledgement(
  p_token_hash text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$ SELECT private.finalize_remote_document_acknowledgement(p_token_hash, p_payload); $$;

REVOKE ALL ON FUNCTION public.register_generated_document(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_generated_document(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.create_document_acknowledgement_link(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_document_acknowledgement_link(uuid, integer) TO authenticated;
REVOKE ALL ON FUNCTION private.finalize_remote_document_acknowledgement(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_remote_document_acknowledgement(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.finalize_remote_document_acknowledgement(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_remote_document_acknowledgement(text, jsonb) TO service_role;
