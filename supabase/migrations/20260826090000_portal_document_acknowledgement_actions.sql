-- Habilita gestão de links de ciência no Portal TCS.
-- O token puro continua efêmero: somente seu SHA-256 é persistido.

ALTER TABLE public.document_acknowledgement_requests
  ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS document_acknowledgement_events_one_outcome_idx
  ON public.document_acknowledgement_events(document_id)
  WHERE event_kind = 'outcome';

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
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_expires_in_hours NOT BETWEEN 1 AND 168 THEN
    RAISE EXCEPTION 'invalid_expiration' USING ERRCODE = '22023';
  END IF;

  -- O mesmo lock é usado pelos dois finalizadores públicos abaixo. Assim a
  -- emissão nunca atravessa a confirmação de um resultado para esta versão.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_document_id::text, 0));

  SELECT * INTO v_document
  FROM public.generated_documents
  WHERE id = p_document_id;

  IF NOT FOUND
     OR v_document.training_mode
     OR v_document.status <> 'available'
     OR NOT private.can_access_document_scope(v_document.organization_id, v_document.owner_user_id, v_user)
  THEN
    RAISE EXCEPTION 'document_scope_denied' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.document_acknowledgement_events
    WHERE document_id = v_document.id
      AND event_kind = 'outcome'
  ) THEN
    RAISE EXCEPTION 'document_already_finalized' USING ERRCODE = '23505';
  END IF;

  UPDATE public.document_acknowledgement_requests
  SET status = 'revoked',
      revoked_by = v_user,
      revoked_at = clock_timestamp()
  WHERE document_id = p_document_id
    AND status = 'open';

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  expires_at := clock_timestamp() + make_interval(hours => p_expires_in_hours);

  INSERT INTO public.document_acknowledgement_requests(
    document_id,
    organization_id,
    owner_user_id,
    token_hash,
    expires_at,
    created_by
  ) VALUES (
    p_document_id,
    v_document.organization_id,
    v_document.owner_user_id,
    encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex'),
    expires_at,
    v_user
  );

  token := v_token;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_create_document_acknowledgement_link(
  p_document_id uuid,
  p_expires_in_hours integer DEFAULT 72
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_context jsonb;
  v_document public.generated_documents%ROWTYPE;
  v_token text;
  v_expires_at timestamptz;
  v_org uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  v_context := public.get_portal_access_context();
  IF v_context IS NULL
     OR NOT ((v_context->'permissions') ? 'document.read')
     OR NOT COALESCE((v_context->>'creation_allowed')::boolean, false)
  THEN
    RAISE EXCEPTION 'document_link_creation_not_allowed' USING ERRCODE = '42501';
  END IF;
  v_org := NULLIF(v_context->>'organization_id', '')::uuid;

  SELECT * INTO v_document
  FROM public.generated_documents
  WHERE id = p_document_id;

  IF NOT FOUND OR v_document.training_mode OR v_document.status <> 'available' OR NOT (
    (v_org IS NULL AND v_document.organization_id IS NULL AND v_document.owner_user_id = v_user)
    OR (
      v_org IS NOT NULL
      AND v_document.organization_id = v_org
      AND private.portal_agent_allowed(v_org, v_document.owner_user_id::text, v_user)
    )
  ) THEN
    RAISE EXCEPTION 'document_scope_denied' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.document_acknowledgement_events
    WHERE document_id = v_document.id
      AND event_kind = 'outcome'
  ) THEN
    RAISE EXCEPTION 'document_already_finalized' USING ERRCODE = '23505';
  END IF;

  SELECT created.token, created.expires_at
  INTO v_token, v_expires_at
  FROM public.create_document_acknowledgement_link(p_document_id, p_expires_in_hours) AS created;

  RETURN jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'token', v_token,
    'expires_at', v_expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_revoke_document_acknowledgement_link(
  p_document_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_context jsonb;
  v_org uuid;
  v_document public.generated_documents%ROWTYPE;
  v_revoked integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  v_context := public.get_portal_access_context();
  IF v_context IS NULL OR NOT ((v_context->'permissions') ? 'document.read') THEN
    RAISE EXCEPTION 'document_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  v_org := NULLIF(v_context->>'organization_id', '')::uuid;

  SELECT * INTO v_document
  FROM public.generated_documents
  WHERE id = p_document_id
    AND status = 'available'
    AND training_mode = false;

  IF NOT FOUND OR NOT (
    (v_org IS NULL AND v_document.organization_id IS NULL AND v_document.owner_user_id = v_user)
    OR (
      v_org IS NOT NULL
      AND v_document.organization_id = v_org
      AND private.portal_agent_allowed(v_org, v_document.owner_user_id::text, v_user)
    )
  ) THEN
    RAISE EXCEPTION 'document_scope_denied' USING ERRCODE = '42501';
  END IF;

  UPDATE public.document_acknowledgement_requests
  SET status = 'revoked',
      revoked_by = v_user,
      revoked_at = clock_timestamp()
  WHERE document_id = p_document_id
    AND status = 'open';
  GET DIAGNOSTICS v_revoked = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'revoked', v_revoked > 0
  );
END;
$$;

-- Serializa os dois canais de conclusão com a emissão de link. A validação
-- idempotente continua nas funções privadas existentes; o índice parcial é a
-- última defesa contra resultados finais concorrentes.
CREATE OR REPLACE FUNCTION public.finalize_document_acknowledgement(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_document_id uuid := NULLIF(p_payload->>'document_id', '')::uuid;
BEGIN
  IF v_document_id IS NULL THEN
    RAISE EXCEPTION 'invalid_identifiers' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_document_id::text, 0));
  IF EXISTS (
    SELECT 1
    FROM public.document_acknowledgement_events AS outcome
    WHERE outcome.document_id = v_document_id
      AND outcome.event_kind = 'outcome'
      AND outcome.client_event_id IS DISTINCT FROM NULLIF(p_payload->>'client_event_id', '')::uuid
  ) THEN
    RAISE EXCEPTION 'document_already_acknowledged' USING ERRCODE = '23505';
  END IF;
  RETURN private.finalize_document_acknowledgement(p_payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_remote_document_acknowledgement(
  p_token_hash text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_document_id uuid;
BEGIN
  IF COALESCE(p_token_hash, '') !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_link' USING ERRCODE = '22023';
  END IF;
  SELECT request.document_id
  INTO v_document_id
  FROM public.document_acknowledgement_requests AS request
  WHERE request.token_hash = p_token_hash;
  IF v_document_id IS NULL THEN
    RAISE EXCEPTION 'link_not_found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_document_id::text, 0));
  RETURN private.finalize_remote_document_acknowledgement(p_token_hash, p_payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_list_acknowledgements()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_context jsonb;
  v_org uuid;
  v_creation_allowed boolean;
  v_result jsonb;
BEGIN
  v_context := public.get_portal_access_context();
  IF v_context IS NULL OR NOT ((v_context->'permissions') ? 'document.read') THEN
    RAISE EXCEPTION 'document_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  v_org := NULLIF(v_context->>'organization_id', '')::uuid;
  v_creation_allowed := COALESCE((v_context->>'creation_allowed')::boolean, false);

  SELECT COALESCE(jsonb_agg(item ORDER BY item->>'created_at' DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', document.id,
      'acknowledgement_id', event.id,
      'title', COALESCE(inspection.protocolo, event.protocol, document.id::text),
      'subtitle', COALESCE(event.recipient_name, 'Aguardando destinatário'),
      'status', CASE
        WHEN event.id IS NOT NULL THEN event.outcome
        WHEN request.id IS NOT NULL THEN 'link_sent'
        ELSE 'pending'
      END,
      'inspection_protocol', inspection.protocolo,
      'recipient_name', event.recipient_name,
      'recipient_relationship', event.recipient_relationship,
      'created_at', COALESCE(event.recorded_at_server, document.created_at),
      'expires_at', request.expires_at,
      'outcome', event.outcome,
      'reason', event.reason,
      'document_available', true,
      'signature_available', event.outcome = 'acknowledged' AND event.signature_storage_path IS NOT NULL,
      'acknowledged_at', event.recorded_at_server,
      'can_resume', event.id IS NULL AND v_creation_allowed,
      'can_generate', event.id IS NULL AND v_creation_allowed,
      'can_revoke', event.id IS NULL AND request.id IS NOT NULL,
      'can_copy', false
    ) AS item
    FROM public.generated_documents AS document
    JOIN public.vistorias AS inspection ON inspection.id = document.vistoria_id
    LEFT JOIN LATERAL (
      SELECT outcome.*
      FROM public.document_acknowledgement_events AS outcome
      WHERE outcome.document_id = document.id
        AND outcome.event_kind = 'outcome'
      ORDER BY outcome.recorded_at_server DESC
      LIMIT 1
    ) AS event ON true
    LEFT JOIN LATERAL (
      SELECT open_request.*
      FROM public.document_acknowledgement_requests AS open_request
      WHERE open_request.document_id = document.id
        AND open_request.status = 'open'
        AND open_request.expires_at > clock_timestamp()
      ORDER BY open_request.created_at DESC
      LIMIT 1
    ) AS request ON true
    WHERE document.training_mode = false
      AND document.status = 'available'
      AND (
        (v_org IS NULL AND document.organization_id IS NULL AND document.owner_user_id = v_user)
        OR (
          v_org IS NOT NULL
          AND document.organization_id = v_org
          AND private.portal_agent_allowed(v_org, document.owner_user_id::text, v_user)
        )
      )
    ORDER BY COALESCE(event.recorded_at_server, document.created_at) DESC
    LIMIT 100
  ) AS scoped;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_document_acknowledgement_link(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_create_document_acknowledgement_link(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_revoke_document_acknowledgement_link(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.finalize_document_acknowledgement(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.finalize_remote_document_acknowledgement(text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.finalize_document_acknowledgement(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalize_remote_document_acknowledgement(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_document_acknowledgement_link(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_create_document_acknowledgement_link(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_revoke_document_acknowledgement_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_document_acknowledgement(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_remote_document_acknowledgement(text, jsonb) TO service_role;

COMMENT ON FUNCTION public.portal_create_document_acknowledgement_link(uuid, integer) IS
  'Cria link efêmero de ciência para uma versão acessível no Portal; a assinatura deve permitir novas operações.';
COMMENT ON FUNCTION public.portal_revoke_document_acknowledgement_link(uuid) IS
  'Revoga de forma idempotente o link aberto de uma versão acessível; permanece disponível mesmo com assinatura bloqueada.';

NOTIFY pgrst, 'reload schema';
