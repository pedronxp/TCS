-- Um novo pareamento precisa começar sem as credenciais Baileys anteriores.
-- Caso contrário, uma sessão desconectada tenta restaurar o socket antigo e
-- nunca entra no fluxo que emite um QR Code novo.
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

  SELECT * INTO v_session
  FROM public.bot_sessoes
  WHERE id = p_session_id
  FOR UPDATE;
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

  DELETE FROM private.bot_auth_state state
  WHERE state.session_id = p_session_id;

  UPDATE public.bot_sessoes
  SET expected_phone = v_phone,
      identification = NULLIF(btrim(COALESCE(p_identification, '')), ''),
      pairing_method = p_method,
      pairing_ready = true,
      pairing_prepared_at = now(),
      status = 'aguardando_qr',
      telefone = NULL,
      vinculado_em = NULL,
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

REVOKE ALL ON FUNCTION public.prepare_bot_session_pairing(uuid, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_bot_session_pairing(uuid, text, text, text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
