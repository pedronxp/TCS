-- The legacy plan function remains an implementation detail. Direct client
-- execution is removed so every internal edit must pass MFA, justification,
-- permission checks and idempotency below.
REVOKE ALL ON FUNCTION public.update_plan_commercial_configuration(uuid,jsonb,jsonb,jsonb,jsonb,jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.is_owner_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.owner_admins oa WHERE oa.user_id=p_user_id AND oa.active)
    OR EXISTS (SELECT 1 FROM public.internal_staff s WHERE s.user_id=p_user_id AND s.role='owner' AND s.status='active')
  );
$$;

CREATE OR REPLACE FUNCTION public.mutate_internal_plan(
  p_plan_id uuid,
  p_plan jsonb,
  p_commercial jsonb,
  p_features jsonb,
  p_limits jsonb,
  p_sla jsonb,
  p_reason text,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  v_request_hash text;
  prior jsonb;
  legacy_result jsonb;
  v_result jsonb;
BEGIN
  IF NOT private.has_internal_permission('commercial.write',actor) THEN
    RAISE EXCEPTION 'commercial_write_not_allowed' USING ERRCODE='42501';
  END IF;
  IF NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE='42501'; END IF;
  IF char_length(trim(p_reason)) NOT BETWEEN 8 AND 500 THEN RAISE EXCEPTION 'reason_required'; END IF;
  v_request_hash:=md5(concat_ws('|',p_plan_id,p_plan::text,p_commercial::text,p_features::text,p_limits::text,p_sla::text,p_reason));
  SELECT io.result INTO v_result FROM public.internal_operations io
  WHERE io.actor_id=actor AND io.operation_id=p_operation_id AND io.request_hash=v_request_hash;
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  INSERT INTO public.internal_operations(operation_id,actor_id,action,request_hash)
  VALUES(p_operation_id,actor,'plan.update',v_request_hash);
  SELECT jsonb_build_object(
    'plan',to_jsonb(p),
    'commercial',COALESCE((SELECT configuration->'commercial' FROM public.plan_versions WHERE plan_id=p.id AND version=p.current_version),'{}'::jsonb),
    'features',COALESCE((SELECT jsonb_object_agg(feature_code,enabled) FROM public.plan_features WHERE plan_id=p.id),'{}'::jsonb),
    'limits',COALESCE((SELECT jsonb_object_agg(resource_code,jsonb_build_object('hard_limit',hard_limit,'warning_percent',warning_percent)) FROM public.plan_limits WHERE plan_id=p.id),'{}'::jsonb),
    'sla',COALESCE((SELECT jsonb_object_agg(priority,jsonb_build_object('response_minutes',response_minutes,'resolution_minutes',resolution_minutes,'escalation_minutes',escalation_minutes)) FROM public.support_sla_policies WHERE plan_id=p.id),'{}'::jsonb)
  ) INTO prior FROM public.plans p WHERE p.id=p_plan_id FOR UPDATE;
  IF prior IS NULL THEN RAISE EXCEPTION 'commercial_plan_not_found'; END IF;
  legacy_result:=public.update_plan_commercial_configuration(p_plan_id,p_plan,p_commercial,p_features,p_limits,p_sla);
  v_result:=jsonb_build_object('ok',true,'plan_id',p_plan_id,'version',legacy_result->'version');
  UPDATE public.internal_operations SET status='succeeded',result=v_result,completed_at=now()
  WHERE actor_id=actor AND operation_id=p_operation_id;
  INSERT INTO public.internal_access_events(actor_id,actor_role,action,target_type,target_id,result,reason,metadata)
  VALUES(actor,private.current_internal_role(actor),'plan.update','plan',p_plan_id::text,'allowed',left(trim(p_reason),500),jsonb_build_object('before',prior,'after_version',legacy_result->'version'));
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.mutate_internal_plan(uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_internal_plan(uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
