-- Ciência eletrônica vinculada à versão imutável do documento.
-- A evidência é append-only; clientes autenticados somente leem por RLS e
-- concluem/corrigem eventos por RPCs que refazem a autorização no servidor.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE TABLE public.generated_documents (
  id uuid PRIMARY KEY,
  vistoria_id uuid NOT NULL REFERENCES public.vistorias(id) ON DELETE RESTRICT,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  document_type text NOT NULL CHECK (document_type IN ('report','technical_report','interdiction_term')),
  document_version integer NOT NULL CHECK (document_version > 0),
  template_version text NOT NULL CHECK (length(template_version) BETWEEN 1 AND 80),
  content_snapshot jsonb NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  pdf_hash text NOT NULL CHECK (pdf_hash ~ '^[0-9a-f]{64}$'),
  storage_path text NOT NULL CHECK (length(storage_path) BETWEEN 10 AND 1000),
  byte_size bigint NOT NULL CHECK (byte_size > 0 AND byte_size <= 20971520),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','superseded')),
  supersedes_id uuid REFERENCES public.generated_documents(id) ON DELETE RESTRICT,
  training_mode boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at_device timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vistoria_id, document_type, document_version)
);

CREATE TABLE public.document_acknowledgement_events (
  id uuid PRIMARY KEY,
  client_event_id uuid NOT NULL UNIQUE,
  document_id uuid NOT NULL REFERENCES public.generated_documents(id) ON DELETE RESTRICT,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  event_kind text NOT NULL DEFAULT 'outcome' CHECK (event_kind IN ('outcome','corrected','invalidated')),
  outcome text CHECK (outcome IN ('acknowledged','refused','unable_to_sign')),
  declaration_version text,
  declaration_text text,
  declaration_hash text CHECK (declaration_hash IS NULL OR declaration_hash ~ '^[0-9a-f]{64}$'),
  recipient_name text,
  recipient_relationship text,
  signature_strokes jsonb,
  signature_hash text CHECK (signature_hash IS NULL OR signature_hash ~ '^[0-9a-f]{64}$'),
  signature_storage_path text,
  reason text,
  witness jsonb,
  occurred_at_device timestamptz NOT NULL,
  recorded_at_server timestamptz NOT NULL DEFAULT now(),
  device_id_hash text CHECK (device_id_hash IS NULL OR device_id_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  correction_of uuid REFERENCES public.document_acknowledgement_events(id) ON DELETE RESTRICT,
  correction_reason text,
  protocol text NOT NULL UNIQUE,
  CONSTRAINT acknowledgement_outcome_shape CHECK (
    (event_kind = 'outcome' AND outcome IS NOT NULL AND declaration_version IS NOT NULL
      AND declaration_text IS NOT NULL AND declaration_hash IS NOT NULL
      AND recipient_name IS NOT NULL AND recipient_relationship IS NOT NULL
      AND correction_of IS NULL AND correction_reason IS NULL)
    OR
    (event_kind IN ('corrected','invalidated') AND outcome IS NULL
      AND correction_of IS NOT NULL AND length(btrim(correction_reason)) >= 5)
  ),
  CONSTRAINT acknowledgement_evidence_shape CHECK (
    event_kind <> 'outcome'
    OR (outcome = 'acknowledged' AND signature_strokes IS NOT NULL
      AND signature_hash IS NOT NULL AND reason IS NULL)
    OR (outcome IN ('refused','unable_to_sign') AND signature_strokes IS NULL
      AND signature_hash IS NULL AND length(btrim(reason)) >= 3)
  )
);

CREATE INDEX generated_documents_scope_idx
  ON public.generated_documents(organization_id, owner_user_id, vistoria_id, document_type, document_version DESC);
CREATE INDEX generated_documents_storage_idx ON public.generated_documents(storage_path);
CREATE INDEX acknowledgement_events_document_idx
  ON public.document_acknowledgement_events(document_id, recorded_at_server DESC);
CREATE INDEX acknowledgement_events_scope_idx
  ON public.document_acknowledgement_events(organization_id, owner_user_id, recorded_at_server DESC);
CREATE INDEX acknowledgement_events_signature_storage_idx
  ON public.document_acknowledgement_events(signature_storage_path)
  WHERE signature_storage_path IS NOT NULL;

ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_acknowledgement_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.generated_documents, public.document_acknowledgement_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.generated_documents, public.document_acknowledgement_events TO authenticated;

CREATE OR REPLACE FUNCTION private.can_access_document_scope(
  p_organization_id uuid,
  p_owner_user_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_user_id IS NOT NULL AND (
    p_owner_user_id = p_user_id
    OR (p_organization_id IS NOT NULL AND p_organization_id = private.current_organization_id(p_user_id))
    OR private.is_owner_admin(p_user_id)
  );
$$;

REVOKE ALL ON FUNCTION private.can_access_document_scope(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_access_document_scope(uuid,uuid,uuid) TO authenticated;

CREATE POLICY generated_documents_scope_select
  ON public.generated_documents FOR SELECT TO authenticated
  USING ((SELECT private.can_access_document_scope(organization_id, owner_user_id)));

CREATE POLICY acknowledgement_events_scope_select
  ON public.document_acknowledgement_events FOR SELECT TO authenticated
  USING ((SELECT private.can_access_document_scope(organization_id, owner_user_id)));

CREATE OR REPLACE FUNCTION private.finalize_document_acknowledgement(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_document_id uuid := nullif(p_payload->>'document_id','')::uuid;
  v_client_event_id uuid := nullif(p_payload->>'client_event_id','')::uuid;
  v_vistoria_id uuid := nullif(p_payload->>'vistoria_id','')::uuid;
  v_event_id uuid := nullif(p_payload->>'event_id','')::uuid;
  v_existing public.document_acknowledgement_events%ROWTYPE;
  v_vistoria public.vistorias%ROWTYPE;
  v_document public.generated_documents%ROWTYPE;
  v_org uuid;
  v_outcome text := p_payload->>'outcome';
  v_signature jsonb := p_payload->'signature_strokes';
  v_witness jsonb := p_payload->'witness';
  v_storage_path text := p_payload->>'storage_path';
  v_signature_path text := nullif(p_payload->>'signature_storage_path','');
  v_protocol text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF v_document_id IS NULL OR v_client_event_id IS NULL OR v_vistoria_id IS NULL OR v_event_id IS NULL THEN
    RAISE EXCEPTION 'invalid_identifiers' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
    FROM public.document_acknowledgement_events
   WHERE client_event_id = v_client_event_id;
  IF FOUND THEN
    IF v_existing.created_by <> v_user OR v_existing.document_id <> v_document_id OR v_existing.id <> v_event_id THEN
      RAISE EXCEPTION 'idempotency_key_conflict' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object(
      'event_id', v_existing.id,
      'protocol', v_existing.protocol,
      'recorded_at_server', v_existing.recorded_at_server,
      'signature_storage_path', v_existing.signature_storage_path,
      'idempotent', true
    );
  END IF;

  SELECT * INTO v_vistoria FROM public.vistorias WHERE id = v_vistoria_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'inspection_not_found' USING ERRCODE = 'P0002'; END IF;
  v_org := v_vistoria.organization_id;

  IF NOT (
    v_vistoria."agenteUid"::text = v_user::text
    OR (v_org IS NOT NULL AND v_org = private.current_organization_id(v_user))
    OR private.is_owner_admin(v_user)
  ) THEN
    RAISE EXCEPTION 'document_scope_denied' USING ERRCODE = '42501';
  END IF;

  IF p_payload->>'document_type' NOT IN ('report','technical_report','interdiction_term')
     OR coalesce((p_payload->>'training_mode')::boolean, false)
     OR coalesce((p_payload->>'document_version')::integer, 0) <= 0
     OR coalesce(p_payload->>'content_hash','') !~ '^[0-9a-f]{64}$'
     OR coalesce(p_payload->>'pdf_hash','') !~ '^[0-9a-f]{64}$'
     OR coalesce((p_payload->>'byte_size')::bigint, 0) NOT BETWEEN 1 AND 20971520 THEN
    RAISE EXCEPTION 'invalid_document_payload' USING ERRCODE = '22023';
  END IF;
  IF position(v_user::text || '/' in v_storage_path) <> 1 THEN
    RAISE EXCEPTION 'invalid_storage_scope' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects
     WHERE bucket_id = 'document-evidence' AND name = v_storage_path
  ) THEN
    RAISE EXCEPTION 'document_object_not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.generated_documents(
    id, vistoria_id, organization_id, owner_user_id, document_type,
    document_version, template_version, content_snapshot, content_hash,
    pdf_hash, storage_path, byte_size, supersedes_id, training_mode,
    created_by, created_at_device
  ) VALUES (
    v_document_id, v_vistoria_id, v_org, v_user, p_payload->>'document_type',
    (p_payload->>'document_version')::integer, p_payload->>'template_version',
    p_payload->'content_snapshot', p_payload->>'content_hash', p_payload->>'pdf_hash',
    v_storage_path, (p_payload->>'byte_size')::bigint,
    nullif(p_payload->>'supersedes_id','')::uuid, coalesce((p_payload->>'training_mode')::boolean,false),
    v_user, (p_payload->>'document_created_at_device')::timestamptz
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO v_document FROM public.generated_documents WHERE id = v_document_id;
  IF NOT FOUND OR v_document.created_by <> v_user OR v_document.vistoria_id <> v_vistoria_id
     OR v_document.content_hash <> p_payload->>'content_hash'
     OR v_document.pdf_hash <> p_payload->>'pdf_hash' THEN
    RAISE EXCEPTION 'document_identity_conflict' USING ERRCODE = '23505';
  END IF;

  UPDATE public.generated_documents
     SET status = 'superseded'
   WHERE vistoria_id = v_vistoria_id AND document_type = v_document.document_type
     AND id <> v_document_id AND document_version < v_document.document_version
     AND status <> 'superseded';

  IF v_outcome NOT IN ('acknowledged','refused','unable_to_sign')
     OR length(btrim(coalesce(p_payload->>'recipient_name',''))) < 2
     OR length(btrim(coalesce(p_payload->>'recipient_relationship',''))) < 2
     OR length(btrim(coalesce(p_payload->>'declaration_text',''))) < 20
     OR coalesce(p_payload->>'declaration_hash','') !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_acknowledgement_payload' USING ERRCODE = '22023';
  END IF;
  IF encode(extensions.digest(convert_to(
       '{"text":' || to_jsonb(p_payload->>'declaration_text')::text ||
       ',"version":' || to_jsonb(p_payload->>'declaration_version')::text || '}',
       'UTF8'
     ), 'sha256'), 'hex') <> p_payload->>'declaration_hash' THEN
    RAISE EXCEPTION 'declaration_hash_mismatch' USING ERRCODE = '22023';
  END IF;

  IF v_outcome = 'acknowledged' THEN
    IF v_signature IS NULL OR jsonb_typeof(v_signature) <> 'array'
       OR jsonb_array_length(v_signature) = 0
       OR coalesce(p_payload->>'signature_hash','') !~ '^[0-9a-f]{64}$'
       OR v_signature_path IS NULL OR position(v_user::text || '/' in v_signature_path) <> 1
       OR NOT EXISTS (
         SELECT 1 FROM storage.objects
          WHERE bucket_id = 'document-evidence' AND name = v_signature_path
       ) THEN
      RAISE EXCEPTION 'signature_required' USING ERRCODE = '22023';
    END IF;
  ELSIF length(btrim(coalesce(p_payload->>'reason',''))) < 3 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  IF coalesce((p_payload->>'witness_required')::boolean,false)
     AND length(btrim(coalesce(v_witness->>'name',''))) < 2 THEN
    RAISE EXCEPTION 'witness_required' USING ERRCODE = '22023';
  END IF;

  v_protocol := 'TCS-CIE-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' ||
    upper(substr(replace(v_event_id::text, '-', ''), 1, 8));

  INSERT INTO public.document_acknowledgement_events(
    id, client_event_id, document_id, organization_id, owner_user_id,
    event_kind, outcome, declaration_version, declaration_text,
    declaration_hash, recipient_name, recipient_relationship,
    signature_strokes, signature_hash, signature_storage_path, reason,
    witness, occurred_at_device, device_id_hash, created_by, protocol
  ) VALUES (
    v_event_id, v_client_event_id, v_document_id, v_org, v_user,
    'outcome', v_outcome, p_payload->>'declaration_version',
    p_payload->>'declaration_text', p_payload->>'declaration_hash',
    btrim(p_payload->>'recipient_name'), btrim(p_payload->>'recipient_relationship'),
    CASE WHEN v_outcome = 'acknowledged' THEN v_signature ELSE NULL END,
    CASE WHEN v_outcome = 'acknowledged' THEN p_payload->>'signature_hash' ELSE NULL END,
    CASE WHEN v_outcome = 'acknowledged' THEN v_signature_path ELSE NULL END,
    CASE WHEN v_outcome <> 'acknowledged' THEN btrim(p_payload->>'reason') ELSE NULL END,
    CASE WHEN v_witness IS NULL OR v_witness = 'null'::jsonb THEN NULL ELSE v_witness END,
    (p_payload->>'occurred_at_device')::timestamptz,
    nullif(p_payload->>'device_id_hash',''), v_user, v_protocol
  );

  RETURN jsonb_build_object(
    'event_id', v_event_id,
    'protocol', v_protocol,
    'recorded_at_server', (SELECT recorded_at_server FROM public.document_acknowledgement_events WHERE id = v_event_id),
    'signature_storage_path', CASE WHEN v_outcome = 'acknowledged' THEN v_signature_path ELSE NULL END,
    'idempotent', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_document_acknowledgement(p_payload jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$ SELECT private.finalize_document_acknowledgement(p_payload); $$;

REVOKE ALL ON FUNCTION private.finalize_document_acknowledgement(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalize_document_acknowledgement(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.finalize_document_acknowledgement(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_document_acknowledgement(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION private.append_document_acknowledgement_correction(
  p_original_event_id uuid,
  p_action text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_original public.document_acknowledgement_events%ROWTYPE;
  v_id uuid := extensions.gen_random_uuid();
  v_protocol text;
  v_role text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF p_action NOT IN ('corrected','invalidated') OR length(btrim(coalesce(p_reason,''))) < 5 THEN
    RAISE EXCEPTION 'invalid_correction' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_original FROM public.document_acknowledgement_events WHERE id = p_original_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002'; END IF;
  v_role := private.organization_role(v_original.organization_id, v_user)::text;
  IF NOT (private.is_owner_admin(v_user) OR (v_original.organization_id IS NOT NULL AND v_role IN ('owner','coordinator','supervisor'))) THEN
    RAISE EXCEPTION 'correction_denied' USING ERRCODE = '42501';
  END IF;
  v_protocol := 'TCS-CIE-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || upper(substr(replace(v_id::text,'-',''),1,8));
  INSERT INTO public.document_acknowledgement_events(
    id, client_event_id, document_id, organization_id, owner_user_id,
    event_kind, occurred_at_device, created_by, correction_of,
    correction_reason, protocol
  ) VALUES (
    v_id, v_id, v_original.document_id, v_original.organization_id,
    v_original.owner_user_id, p_action, now(), v_user,
    v_original.id, btrim(p_reason), v_protocol
  );
  RETURN jsonb_build_object('event_id', v_id, 'protocol', v_protocol, 'recorded_at_server', now());
END;
$$;

CREATE OR REPLACE FUNCTION public.append_document_acknowledgement_correction(
  p_original_event_id uuid,
  p_action text,
  p_reason text
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$ SELECT private.append_document_acknowledgement_correction(p_original_event_id, p_action, p_reason); $$;

REVOKE ALL ON FUNCTION private.append_document_acknowledgement_correction(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.append_document_acknowledgement_correction(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.append_document_acknowledgement_correction(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.append_document_acknowledgement_correction(uuid,text,text) TO authenticated;

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'document-evidence', 'document-evidence', false, 20971520,
  ARRAY['application/pdf','application/json','text/html']
)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS document_evidence_insert ON storage.objects;
CREATE POLICY document_evidence_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'document-evidence'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS document_evidence_select ON storage.objects;
CREATE POLICY document_evidence_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'document-evidence'
    AND (
      owner_id = (SELECT auth.uid()::text)
      OR EXISTS (
        SELECT 1 FROM public.generated_documents d
         WHERE d.storage_path = name
           AND private.can_access_document_scope(d.organization_id, d.owner_user_id)
      )
      OR EXISTS (
        SELECT 1 FROM public.document_acknowledgement_events e
         WHERE e.signature_storage_path = name
           AND private.can_access_document_scope(e.organization_id, e.owner_user_id)
      )
    )
  );

COMMENT ON TABLE public.generated_documents IS 'Versões imutáveis de documentos apresentados para ciência eletrônica.';
COMMENT ON TABLE public.document_acknowledgement_events IS 'Eventos append-only de ciência, recusa, impossibilidade e correção.';
