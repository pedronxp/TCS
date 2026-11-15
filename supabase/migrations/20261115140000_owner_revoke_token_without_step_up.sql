CREATE OR REPLACE FUNCTION public.revoke_console_invite_token(p_management_id uuid, p_reason text, p_operation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_actor uuid := auth.uid(); v_token public.invite_tokens; v_hash text; v_previous jsonb;
BEGIN
  IF v_actor IS NULL OR p_management_id IS NULL OR p_operation_id IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 8 AND 500 THEN RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_token FROM public.invite_tokens WHERE management_id = p_management_id FOR UPDATE;
  IF v_token.management_id IS NULL THEN RAISE EXCEPTION 'invite_token_not_found' USING ERRCODE = 'P0002'; END IF;
  IF NOT private.can_manage_invite_tokens(v_token.municipio, v_actor) THEN RAISE EXCEPTION 'token_management_not_allowed' USING ERRCODE = '42501'; END IF;
  IF private.has_internal_permission('token.manage', v_actor) AND private.current_internal_role(v_actor) IS DISTINCT FROM 'owner' AND NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501'; END IF;
  v_hash := md5(concat_ws('|', p_management_id, btrim(p_reason)));
  SELECT result INTO v_previous FROM public.internal_operations WHERE actor_id = v_actor AND operation_id = p_operation_id AND request_hash = v_hash;
  IF v_previous IS NOT NULL THEN RETURN v_previous; END IF;
  INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash) VALUES (p_operation_id, v_actor, 'token.revoke', v_hash);
  UPDATE public.invite_tokens SET revoked_at = now(), revoked_by = v_actor WHERE management_id = p_management_id AND revoked_at IS NULL;
  v_previous := jsonb_build_object('ok', true, 'management_id', p_management_id, 'revoked', true);
  UPDATE public.internal_operations SET status = 'succeeded', result = v_previous, completed_at = now() WHERE actor_id = v_actor AND operation_id = p_operation_id;
  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, reason, metadata)
  VALUES (v_actor, private.current_internal_role(v_actor), 'token.revoke', 'invite_token', p_management_id::text, 'allowed', left(btrim(p_reason), 500), jsonb_build_object('municipio', v_token.municipio));
  RETURN v_previous;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- Web console actions retain explicit MFA at their server entry point.
CREATE FUNCTION public.web_create_console_invite_token(p_role text,p_municipio text,p_uf text,p_expires_in_minutes integer,p_reason text,p_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE='42501'; END IF;
 RETURN public.create_console_invite_token(p_role,p_municipio,p_uf,p_expires_in_minutes,p_reason,p_operation_id);
END $$;
CREATE FUNCTION public.web_revoke_console_invite_token(p_management_id uuid,p_reason text,p_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE='42501'; END IF;
 RETURN public.revoke_console_invite_token(p_management_id,p_reason,p_operation_id);
END $$;
REVOKE ALL ON FUNCTION public.web_create_console_invite_token(text,text,text,integer,text,uuid),public.web_revoke_console_invite_token(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.web_create_console_invite_token(text,text,text,integer,text,uuid),public.web_revoke_console_invite_token(uuid,text,uuid) TO authenticated;
