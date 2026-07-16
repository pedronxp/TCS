-- Audited commercial subscription lifecycle for the internal console.

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('trial', 'active', 'grace', 'past_due', 'suspended', 'canceled', 'expired'));

CREATE OR REPLACE FUNCTION public.mutate_internal_subscription(
  p_customer_id text,
  p_subscription_id text,
  p_action text,
  p_payload jsonb,
  p_reason text,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  customer_kind text;
  subject_id uuid;
  subscription_id uuid;
  plan_id uuid;
  plan_audience text;
  target public.subscriptions;
  previous public.subscriptions;
  operation_hash text;
  previous_result jsonb;
  v_result jsonb;
  next_status text;
BEGIN
  IF NOT private.has_internal_permission('commercial.write', actor) THEN
    RAISE EXCEPTION 'commercial_write_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501'; END IF;
  IF p_action NOT IN ('create', 'update') THEN RAISE EXCEPTION 'invalid_subscription_action'; END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN RAISE EXCEPTION 'invalid_subscription_payload'; END IF;
  IF char_length(trim(p_reason)) < 8 THEN RAISE EXCEPTION 'reason_required'; END IF;

  customer_kind := split_part(p_customer_id, ':', 1);
  BEGIN subject_id := split_part(p_customer_id, ':', 2)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid_customer_id'; END;
  IF customer_kind NOT IN ('organization', 'user') OR subject_id IS NULL THEN RAISE EXCEPTION 'invalid_customer_id'; END IF;
  IF p_action = 'update' THEN
    BEGIN subscription_id := p_subscription_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid_subscription_id'; END;
  END IF;

  IF p_payload ? 'plan_id' THEN
    BEGIN plan_id := (p_payload->>'plan_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid_plan_id'; END;
    SELECT audience INTO plan_audience FROM public.plans WHERE id = plan_id AND status <> 'retired';
    IF plan_audience IS NULL OR plan_audience = 'compatibility' THEN RAISE EXCEPTION 'plan_not_available'; END IF;
    IF (customer_kind = 'organization' AND plan_audience <> 'organization')
      OR (customer_kind = 'user' AND plan_audience <> 'individual') THEN
      RAISE EXCEPTION 'plan_audience_mismatch';
    END IF;
  END IF;
  IF p_payload ? 'status' THEN
    next_status := p_payload->>'status';
    IF next_status NOT IN ('trial', 'active', 'grace', 'past_due', 'suspended', 'canceled', 'expired') THEN
      RAISE EXCEPTION 'invalid_subscription_status';
    END IF;
  END IF;
  IF p_payload ? 'overrides' AND jsonb_typeof(p_payload->'overrides') <> 'object' THEN
    RAISE EXCEPTION 'invalid_subscription_overrides';
  END IF;

  operation_hash := md5(concat_ws('|', p_customer_id, p_subscription_id, p_action, p_payload::text, trim(p_reason)));
  SELECT io.result INTO previous_result FROM public.internal_operations io
  WHERE io.actor_id = actor AND io.operation_id = p_operation_id AND io.request_hash = operation_hash;
  IF previous_result IS NOT NULL THEN RETURN previous_result; END IF;
  INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash)
  VALUES (p_operation_id, actor, 'subscription.' || p_action, operation_hash);

  IF p_action = 'create' THEN
    IF COALESCE(p_subscription_id, '') <> '' THEN RAISE EXCEPTION 'subscription_id_must_be_empty'; END IF;
    IF plan_id IS NULL THEN RAISE EXCEPTION 'plan_id_required'; END IF;
    INSERT INTO public.subscriptions(
      plan_id, user_id, organization_id, status, starts_at, trial_ends_at,
      current_period_start, current_period_end, grace_ends_at, canceled_at, overrides
    ) VALUES (
      plan_id, CASE WHEN customer_kind = 'user' THEN subject_id END,
      CASE WHEN customer_kind = 'organization' THEN subject_id END,
      COALESCE(next_status, 'trial'), COALESCE(nullif(p_payload->>'starts_at', '')::timestamptz, now()),
      nullif(p_payload->>'trial_ends_at', '')::timestamptz,
      COALESCE(nullif(p_payload->>'current_period_start', '')::timestamptz, now()),
      nullif(p_payload->>'current_period_end', '')::timestamptz,
      nullif(p_payload->>'grace_ends_at', '')::timestamptz,
      CASE WHEN COALESCE(next_status, 'trial') = 'canceled' THEN now() ELSE NULL END,
      COALESCE(p_payload->'overrides', '{}'::jsonb)
    ) RETURNING * INTO target;
  ELSE
    SELECT * INTO previous FROM public.subscriptions s
    WHERE s.id = subscription_id
      AND ((customer_kind = 'organization' AND s.organization_id = subject_id)
        OR (customer_kind = 'user' AND s.user_id = subject_id))
    FOR UPDATE;
    IF previous.id IS NULL THEN RAISE EXCEPTION 'subscription_not_found' USING ERRCODE = 'P0002'; END IF;
    UPDATE public.subscriptions SET
      plan_id = CASE WHEN p_payload ? 'plan_id' THEN plan_id ELSE public.subscriptions.plan_id END,
      status = CASE WHEN p_payload ? 'status' THEN next_status ELSE status END,
      starts_at = CASE WHEN p_payload ? 'starts_at' THEN nullif(p_payload->>'starts_at', '')::timestamptz ELSE starts_at END,
      trial_ends_at = CASE WHEN p_payload ? 'trial_ends_at' THEN nullif(p_payload->>'trial_ends_at', '')::timestamptz ELSE trial_ends_at END,
      current_period_start = CASE WHEN p_payload ? 'current_period_start' THEN nullif(p_payload->>'current_period_start', '')::timestamptz ELSE current_period_start END,
      current_period_end = CASE WHEN p_payload ? 'current_period_end' THEN nullif(p_payload->>'current_period_end', '')::timestamptz ELSE current_period_end END,
      grace_ends_at = CASE WHEN p_payload ? 'grace_ends_at' THEN nullif(p_payload->>'grace_ends_at', '')::timestamptz ELSE grace_ends_at END,
      canceled_at = CASE
        WHEN p_payload ? 'status' AND next_status = 'canceled' THEN COALESCE(canceled_at, now())
        WHEN p_payload ? 'status' AND next_status <> 'canceled' THEN NULL
        ELSE canceled_at
      END,
      overrides = CASE WHEN p_payload ? 'overrides' THEN p_payload->'overrides' ELSE overrides END,
      updated_at = now()
    WHERE id = subscription_id RETURNING * INTO target;
  END IF;

  v_result := jsonb_build_object('ok', true, 'subscription_id', target.id, 'customer_id', p_customer_id, 'status', target.status);
  UPDATE public.internal_operations SET status = 'succeeded', result = v_result, completed_at = now()
  WHERE actor_id = actor AND operation_id = p_operation_id;
  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, reason, metadata)
  VALUES (actor, private.current_internal_role(actor), 'subscription.' || p_action, 'subscription', target.id::text,
    'allowed', left(trim(p_reason), 500), jsonb_build_object(
      'customer_id', p_customer_id,
      'before', CASE WHEN previous.id IS NULL THEN NULL ELSE jsonb_build_object('plan_id', previous.plan_id, 'status', previous.status) END,
      'after', jsonb_build_object('plan_id', target.plan_id, 'status', target.status),
      'overrides_changed', p_payload ? 'overrides'
    ));
  INSERT INTO public.subscription_audit_events(organization_id, actor_id, event_type, entity_type, entity_id, metadata)
  VALUES (target.organization_id, actor, 'subscription_' || p_action, 'subscription', target.id::text,
    jsonb_build_object('customer_id', p_customer_id, 'reason', left(trim(p_reason), 500),
      'before_status', previous.status, 'after_status', target.status,
      'before_plan_id', previous.plan_id, 'after_plan_id', target.plan_id,
      'overrides_changed', p_payload ? 'overrides'));
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.mutate_internal_subscription(text, text, text, jsonb, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mutate_internal_subscription(text, text, text, jsonb, text, uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
