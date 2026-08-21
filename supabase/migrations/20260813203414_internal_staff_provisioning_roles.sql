-- Allow the full internal role set to be managed by an owner. The permission
-- matrix remains the authority for what each role can do after assignment.
CREATE OR REPLACE FUNCTION public.manage_internal_staff(
  p_user_id uuid,
  p_role text,
  p_status text,
  p_reason text,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid(); previous public.internal_staff; updated public.internal_staff;
  previous_result jsonb; v_request_hash text;
BEGIN
  IF NOT private.has_internal_permission('staff.manage', actor) THEN RAISE EXCEPTION 'staff_management_not_allowed' USING ERRCODE = '42501'; END IF;
  IF NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501'; END IF;
  IF p_role NOT IN ('owner', 'developer', 'support', 'auditor') OR p_status NOT IN ('active', 'suspended', 'removed') THEN RAISE EXCEPTION 'invalid_staff_state'; END IF;
  IF char_length(trim(p_reason)) < 8 THEN RAISE EXCEPTION 'reason_required'; END IF;
  v_request_hash := md5(concat_ws('|', p_user_id, p_role, p_status, trim(p_reason)));
  SELECT result INTO previous_result FROM public.internal_operations WHERE actor_id = actor AND operation_id = p_operation_id AND request_hash = v_request_hash;
  IF previous_result IS NOT NULL THEN RETURN previous_result; END IF;
  INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash) VALUES (p_operation_id, actor, 'staff.manage', v_request_hash);
  SELECT * INTO previous FROM public.internal_staff WHERE user_id = p_user_id FOR UPDATE;
  INSERT INTO public.internal_staff(user_id, role, status, created_by)
  VALUES (p_user_id, p_role, p_status, actor)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, updated_at = now()
  RETURNING * INTO updated;
  previous_result := jsonb_build_object('ok', true, 'staff', to_jsonb(updated));
  UPDATE public.internal_operations SET status = 'succeeded', result = previous_result, completed_at = now() WHERE actor_id = actor AND operation_id = p_operation_id;
  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, reason, metadata)
  VALUES (actor, private.current_internal_role(actor), 'staff.manage', 'internal_staff', p_user_id::text, 'allowed', left(p_reason, 500), jsonb_build_object('before', CASE WHEN previous.id IS NULL THEN NULL ELSE jsonb_build_object('role', previous.role, 'status', previous.status) END, 'after', jsonb_build_object('role', updated.role, 'status', updated.status)));
  RETURN previous_result;
EXCEPTION WHEN unique_violation THEN
  SELECT result INTO previous_result FROM public.internal_operations WHERE actor_id = actor AND operation_id = p_operation_id;
  IF previous_result IS NOT NULL THEN RETURN previous_result; END IF;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.manage_internal_staff(uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_internal_staff(uuid, text, text, text, uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
