-- Compat de tipos: mutate_internal_agent_access passa a aceitar
-- p_session_id / p_new_password omitidos (DEFAULT NULL). O console já enviava
-- NULL explícito para esses parâmetros; a assinatura anterior não tinha
-- defaults e o gerador de tipos marcava como obrigatórios. Corpo preservado.

CREATE OR REPLACE FUNCTION public.mutate_internal_agent_access(p_customer_id text, p_user_id uuid, p_action text, p_session_id uuid DEFAULT NULL, p_new_password text DEFAULT NULL, p_reason text DEFAULT NULL, p_operation_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  scope jsonb := private.resolve_internal_agent_scope(p_customer_id, p_user_id);
  actor uuid := auth.uid();
  before_approved boolean;
  previous_result jsonb;
  v_request_hash text;
  affected integer := 0;
  v_result jsonb;
BEGIN
  IF NOT private.has_internal_permission('customer.write', actor) THEN
    RAISE EXCEPTION 'agent_access_management_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501'; END IF;
  IF char_length(trim(coalesce(p_reason, ''))) < 8 THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF p_action NOT IN ('block', 'unblock', 'terminate_session', 'reset_password') THEN RAISE EXCEPTION 'invalid_agent_access_action'; END IF;
  IF p_action = 'reset_password' AND (char_length(coalesce(p_new_password, '')) < 12 OR p_new_password !~ '[A-Z]' OR p_new_password !~ '[a-z]' OR p_new_password !~ '[0-9]') THEN
    RAISE EXCEPTION 'strong_password_required';
  END IF;
  v_request_hash := md5(concat_ws('|', p_customer_id, p_user_id, p_action, p_session_id, trim(p_reason)));
  SELECT io.result INTO previous_result FROM public.internal_operations io
  WHERE io.actor_id = actor AND io.operation_id = p_operation_id AND io.request_hash = v_request_hash;
  IF previous_result IS NOT NULL THEN RETURN previous_result; END IF;
  INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash)
  VALUES (p_operation_id, actor, 'agent.access.' || p_action, v_request_hash);

  SELECT u."isApproved" INTO before_approved FROM public.users u WHERE u.uid = p_user_id FOR UPDATE;
  IF p_action IN ('block', 'unblock') THEN
    UPDATE public.users SET "isApproved" = (p_action = 'unblock') WHERE uid = p_user_id;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF p_action = 'block' THEN
      UPDATE public.active_sessions SET status = 'revoked', ended_at = now(), ended_by = actor, end_reason = 'agent_blocked'
      WHERE user_id = p_user_id AND status = 'active';
      DELETE FROM auth.sessions WHERE user_id = p_user_id;
    END IF;
  ELSIF p_action = 'terminate_session' THEN
    UPDATE public.active_sessions SET status = 'revoked', ended_at = now(), ended_by = actor, end_reason = left(trim(p_reason), 200)
    WHERE id = p_session_id AND user_id = p_user_id AND status = 'active'
      AND ((scope->>'kind' = 'organization' AND organization_id = (scope->>'organization_id')::uuid)
        OR (scope->>'kind' = 'user' AND organization_id IS NULL));
    GET DIAGNOSTICS affected = ROW_COUNT;
  ELSE
    UPDATE auth.users SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')), updated_at = now()
    WHERE id = p_user_id;
    GET DIAGNOSTICS affected = ROW_COUNT;
    UPDATE public.active_sessions SET status = 'revoked', ended_at = now(), ended_by = actor, end_reason = 'password_reset'
    WHERE user_id = p_user_id AND status = 'active';
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
  END IF;
  IF affected <> 1 THEN RAISE EXCEPTION 'agent_access_target_not_found' USING ERRCODE = 'P0002'; END IF;

  v_result := jsonb_build_object('ok', true, 'action', p_action, 'user_id', p_user_id);
  UPDATE public.internal_operations io SET status = 'succeeded', result = v_result, completed_at = now()
  WHERE io.actor_id = actor AND io.operation_id = p_operation_id;
  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, reason, metadata)
  VALUES (actor, private.current_internal_role(actor), 'agent.access.' || p_action, 'customer_user', p_user_id::text, 'allowed', left(trim(p_reason), 500),
    jsonb_build_object('customer_id', p_customer_id, 'session_id', p_session_id, 'before_approved', before_approved,
      'after_approved', CASE WHEN p_action = 'block' THEN false WHEN p_action = 'unblock' THEN true ELSE before_approved END));
  RETURN v_result;
END;
$function$;
