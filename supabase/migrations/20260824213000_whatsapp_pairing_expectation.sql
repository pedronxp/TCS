-- A sessão só começa depois que o operador identifica a conta esperada.
ALTER TABLE public.bot_sessoes
  ADD COLUMN IF NOT EXISTS expected_phone text,
  ADD COLUMN IF NOT EXISTS identification text,
  ADD COLUMN IF NOT EXISTS pairing_method text,
  ADD COLUMN IF NOT EXISTS pairing_ready boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pairing_prepared_at timestamptz,
  ADD CONSTRAINT bot_sessoes_pairing_method_check
    CHECK (pairing_method IS NULL OR pairing_method IN ('qr', 'code'));

-- Sessões anteriores continuam operando; a espera vale para novas sessões.
UPDATE public.bot_sessoes
SET pairing_ready = true
WHERE pairing_ready = false
  AND (telefone IS NOT NULL OR status = 'vinculado' OR atualizado_em < now());

CREATE OR REPLACE FUNCTION public.prepare_bot_session_pairing(
  p_session_id uuid,
  p_phone text,
  p_identification text,
  p_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.bot_sessoes;
  v_phone text := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  v_internal boolean := private.has_internal_permission('communication.manage');
  v_org uuid := private.current_organization_id();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_method NOT IN ('qr', 'code') THEN
    RAISE EXCEPTION 'invalid_pairing_method' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_phone) NOT BETWEEN 10 AND 13 THEN
    RAISE EXCEPTION 'invalid_phone' USING ERRCODE = '22023';
  END IF;
  IF char_length(btrim(COALESCE(p_identification, ''))) > 80 THEN
    RAISE EXCEPTION 'identification_too_long' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_session FROM public.bot_sessoes WHERE id = p_session_id FOR UPDATE;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT v_internal AND NOT (
    v_org = v_session.organization_id
    AND private.organization_role(v_session.organization_id) IN ('master', 'admin')
    AND private.whatsapp_org_enabled(v_session.organization_id)
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_session.status = 'vinculado' THEN
    RAISE EXCEPTION 'session_already_linked' USING ERRCODE = '23505';
  END IF;

  UPDATE public.bot_sessoes
  SET expected_phone = v_phone,
      identification = NULLIF(btrim(COALESCE(p_identification, '')), ''),
      pairing_method = p_method,
      pairing_ready = true,
      pairing_prepared_at = now(),
      status = 'aguardando_qr',
      atualizado_em = now()
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'expected_phone', v_phone,
    'identification', NULLIF(btrim(COALESCE(p_identification, '')), ''),
    'method', p_method,
    'state', CASE WHEN p_method = 'qr' THEN 'awaiting_qr' ELSE 'awaiting_code' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_bot_session_pairing(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_bot_session_pairing(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_bot_session_pairing_metadata()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_org uuid := private.current_organization_id();
BEGIN
  IF auth.uid() IS NULL OR v_org IS NULL OR private.organization_role(v_org) NOT IN ('master', 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', session.id,
    'expected_phone', public.mascarar_telefone(session.expected_phone),
    'identification', session.identification,
    'pairing_method', session.pairing_method,
    'pairing_ready', session.pairing_ready
  )) FROM public.bot_sessoes session WHERE session.organization_id = v_org), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.internal_bot_session_pairing_metadata(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_internal_permission('communication.manage') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', session.id,
    'expected_phone', public.mascarar_telefone(session.expected_phone),
    'identification', session.identification,
    'pairing_method', session.pairing_method,
    'pairing_ready', session.pairing_ready
  )) FROM public.bot_sessoes session WHERE session.organization_id = p_organization_id), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.portal_bot_session_pairing_metadata(), public.internal_bot_session_pairing_metadata(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_bot_session_pairing_metadata(), public.internal_bot_session_pairing_metadata(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
