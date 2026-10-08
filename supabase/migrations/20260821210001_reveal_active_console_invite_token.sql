-- A manager can reveal a still-valid invite code on demand.  This is an
-- auditable, MFA-protected exception to the normal monitoring projection,
-- which intentionally never lists codes.
CREATE OR REPLACE FUNCTION public.reveal_console_invite_token(
  p_management_id uuid,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_token public.invite_tokens;
  v_hash text;
  v_previous jsonb;
BEGIN
  IF v_actor IS NULL OR p_management_id IS NULL OR p_operation_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_token FROM public.invite_tokens WHERE management_id = p_management_id FOR UPDATE;
  IF v_token.management_id IS NULL THEN RAISE EXCEPTION 'invite_token_not_found' USING ERRCODE = 'P0002'; END IF;
  IF NOT private.can_manage_invite_tokens(v_token.municipio, v_actor) THEN RAISE EXCEPTION 'token_management_not_allowed' USING ERRCODE = '42501'; END IF;
  IF private.has_internal_permission('token.manage', v_actor) AND NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501'; END IF;
  IF coalesce(v_token.usado, false) OR v_token.revoked_at IS NOT NULL OR v_token."expiraEm" <= now() THEN
    RAISE EXCEPTION 'invite_token_not_active' USING ERRCODE = 'P0001';
  END IF;

  v_hash := md5(concat_ws('|', 'token.reveal', p_management_id));
  SELECT result INTO v_previous FROM public.internal_operations
  WHERE actor_id = v_actor AND operation_id = p_operation_id AND request_hash = v_hash;
  IF v_previous IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'management_id', p_management_id, 'token_reveal_available', true);
  END IF;

  INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash)
  VALUES (p_operation_id, v_actor, 'token.reveal', v_hash);
  UPDATE public.internal_operations
  SET status = 'succeeded', result = jsonb_build_object('ok', true, 'management_id', p_management_id), completed_at = now()
  WHERE actor_id = v_actor AND operation_id = p_operation_id;
  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, metadata)
  VALUES (v_actor, private.current_internal_role(v_actor), 'token.reveal', 'invite_token', p_management_id::text, 'allowed', jsonb_build_object('municipio', v_token.municipio, 'expires_at', v_token."expiraEm"));

  RETURN jsonb_build_object('ok', true, 'management_id', v_token.management_id, 'token', v_token.codigo, 'expires_at', v_token."expiraEm", 'token_reveal_available', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reveal_console_invite_token(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reveal_console_invite_token(uuid, uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
