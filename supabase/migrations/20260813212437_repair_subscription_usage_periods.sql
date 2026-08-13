-- Active subscriptions must always have an open, forward-moving billing period.
-- Legacy records with a missing or inverted end date prevented inspection sync
-- because usage_counters requires period_end > period_start.
WITH invalid_periods AS (
  SELECT
    id,
    COALESCE(current_period_start, starts_at, created_at, now()) AS period_start,
    CASE COALESCE(overrides->>'billing_cycle', 'monthly')
      WHEN 'annual' THEN interval '1 year'
      WHEN 'yearly' THEN interval '1 year'
      ELSE interval '1 month'
    END AS period_length
  FROM public.subscriptions
  WHERE status IN ('trial', 'active', 'grace', 'past_due')
    AND (
      current_period_start IS NULL
      OR current_period_end IS NULL
      OR current_period_end <= current_period_start
    )
)
UPDATE public.subscriptions AS subscription
SET
  current_period_start = invalid_periods.period_start,
  current_period_end = invalid_periods.period_start + invalid_periods.period_length,
  updated_at = now()
FROM invalid_periods
WHERE subscription.id = invalid_periods.id;

CREATE OR REPLACE FUNCTION public.consume_subscription_usage(
  p_resource_code text,
  p_amount bigint DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid;
  v_sub public.subscriptions;
  v_limit bigint;
  v_consumed bigint;
  v_warning integer;
  v_enforced boolean;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_period_length interval;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount_must_be_positive';
  END IF;

  v_org := private.current_organization_id(v_user);
  SELECT entitlement_enforcement_enabled
  INTO v_enforced
  FROM public.subscription_settings
  WHERE singleton;

  SELECT *
  INTO v_sub
  FROM public.subscriptions AS subscription
  WHERE (v_org IS NOT NULL AND subscription.organization_id = v_org)
     OR (v_org IS NULL AND subscription.user_id = v_user)
  ORDER BY subscription.created_at DESC
  LIMIT 1;

  IF v_sub.id IS NULL OR v_sub.status NOT IN ('trial', 'active', 'grace') THEN
    IF v_enforced THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'subscription_inactive');
    END IF;
    RETURN jsonb_build_object('allowed', true, 'enforced', false);
  END IF;

  v_period_start := COALESCE(v_sub.current_period_start, v_sub.starts_at, v_sub.created_at, now());
  v_period_length := CASE COALESCE(v_sub.overrides->>'billing_cycle', 'monthly')
    WHEN 'annual' THEN interval '1 year'
    WHEN 'yearly' THEN interval '1 year'
    ELSE interval '1 month'
  END;
  v_period_end := v_sub.current_period_end;

  -- The sync path is the final guard for older subscriptions created before
  -- period validation existed. Persist the normalization so portal renewal
  -- information and later usage writes use the same billing window.
  IF v_period_end IS NULL OR v_period_end <= v_period_start THEN
    v_period_end := v_period_start + v_period_length;
    UPDATE public.subscriptions
    SET
      current_period_start = v_period_start,
      current_period_end = v_period_end,
      updated_at = now()
    WHERE id = v_sub.id;
  END IF;

  SELECT hard_limit, warning_percent
  INTO v_limit, v_warning
  FROM public.plan_limits
  WHERE plan_id = v_sub.plan_id
    AND resource_code = p_resource_code;

  IF v_org IS NOT NULL THEN
    INSERT INTO public.usage_counters(organization_id, resource_code, period_start, period_end, consumed)
    VALUES (v_org, p_resource_code, v_period_start, v_period_end, 0)
    ON CONFLICT (organization_id, resource_code, period_start) WHERE organization_id IS NOT NULL DO NOTHING;

    SELECT consumed
    INTO v_consumed
    FROM public.usage_counters
    WHERE organization_id = v_org
      AND resource_code = p_resource_code
      AND period_start = v_period_start
    FOR UPDATE;

    IF v_enforced AND v_limit IS NOT NULL AND v_consumed + p_amount > v_limit THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'limit_reached', 'consumed', v_consumed, 'limit', v_limit);
    END IF;

    UPDATE public.usage_counters
    SET consumed = consumed + p_amount, updated_at = now()
    WHERE organization_id = v_org
      AND resource_code = p_resource_code
      AND period_start = v_period_start
    RETURNING consumed INTO v_consumed;
  ELSE
    INSERT INTO public.usage_counters(user_id, resource_code, period_start, period_end, consumed)
    VALUES (v_user, p_resource_code, v_period_start, v_period_end, 0)
    ON CONFLICT (user_id, resource_code, period_start) WHERE user_id IS NOT NULL DO NOTHING;

    SELECT consumed
    INTO v_consumed
    FROM public.usage_counters
    WHERE user_id = v_user
      AND resource_code = p_resource_code
      AND period_start = v_period_start
    FOR UPDATE;

    IF v_enforced AND v_limit IS NOT NULL AND v_consumed + p_amount > v_limit THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'limit_reached', 'consumed', v_consumed, 'limit', v_limit);
    END IF;

    UPDATE public.usage_counters
    SET consumed = consumed + p_amount, updated_at = now()
    WHERE user_id = v_user
      AND resource_code = p_resource_code
      AND period_start = v_period_start
    RETURNING consumed INTO v_consumed;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'consumed', v_consumed,
    'limit', v_limit,
    'warning', v_limit IS NOT NULL AND v_consumed * 100 >= v_limit * COALESCE(v_warning, 80)
  );
END;
$$;
