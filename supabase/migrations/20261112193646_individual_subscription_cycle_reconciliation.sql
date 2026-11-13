-- Individual subscriptions are excluded from the organization invoice engine.
-- Reconcile recorded deadlines without inventing payment, renewing a period,
-- deleting an account, or resetting cumulative usage.
CREATE FUNCTION private.reconcile_individual_subscription_cycles(p_user_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_sub public.subscriptions;
  v_config jsonb;
  v_grace_end timestamptz;
  v_status text;
BEGIN
  FOR v_sub IN SELECT s.* FROM public.subscriptions s
    WHERE s.organization_id IS NULL AND s.user_id IS NOT NULL
      AND (p_user_id IS NULL OR s.user_id = p_user_id)
      AND s.status IN ('trial', 'active', 'grace')
      AND ((s.status = 'trial' AND s.trial_ends_at <= now())
        OR (s.status = 'active' AND s.current_period_end <= now())
        OR (s.status = 'grace' AND (s.grace_ends_at <= now() OR s.current_period_end <= now())))
    FOR UPDATE
  LOOP
    IF v_sub.status = 'trial' THEN
      IF v_sub.trial_ends_at <= now() THEN
        UPDATE public.subscriptions SET status = 'expired', updated_at = now() WHERE id = v_sub.id;
      END IF;
      CONTINUE;
    END IF;
    IF COALESCE((to_jsonb(v_sub)->>'cancel_at_period_end')::boolean, false) AND v_sub.current_period_end <= now() THEN
      UPDATE public.subscriptions SET status = 'canceled', canceled_at = COALESCE(canceled_at, now()), updated_at = now()
        WHERE id = v_sub.id;
      CONTINUE;
    END IF;
    SELECT pv.configuration INTO v_config FROM public.plan_versions pv
      JOIN public.plans p ON p.id = pv.plan_id
      WHERE p.id = v_sub.plan_id
        AND (pv.id = NULLIF(to_jsonb(v_sub)->>'plan_version_id', '')::uuid
          OR (NULLIF(to_jsonb(v_sub)->>'plan_version_id', '') IS NULL AND pv.version = p.current_version))
      LIMIT 1;
    -- Explicit free plans do not require a payment confirmation. Missing pricing
    -- is not proof of a free plan and cannot extend a paid entitlement.
    IF COALESCE(v_sub.overrides->>'billing_cycle', 'monthly') IN ('annual', 'yearly') THEN
      IF v_sub.status = 'active' AND v_config->'commercial'->>'annual_price_cents' = '0' THEN CONTINUE; END IF;
    ELSE
      IF v_sub.status = 'active' AND v_config->'commercial'->>'monthly_price_cents' = '0' THEN CONTINUE; END IF;
    END IF;
    v_grace_end := COALESCE(v_sub.grace_ends_at, v_sub.current_period_end
      + make_interval(days => COALESCE((v_config->'commercial'->>'grace_days')::integer, 0)));
    v_status := CASE WHEN v_grace_end > now() THEN 'grace' ELSE 'past_due' END;
    UPDATE public.subscriptions SET status = v_status, grace_ends_at = v_grace_end, updated_at = now()
      WHERE id = v_sub.id;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION private.reconcile_individual_subscription_cycles(uuid) FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.get_subscription_context() RENAME TO subscription_context_before_individual_reconciliation;
ALTER FUNCTION public.subscription_context_before_individual_reconciliation() SET SCHEMA private;
REVOKE ALL ON FUNCTION private.subscription_context_before_individual_reconciliation() FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.get_subscription_context()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := auth.uid(); v_context jsonb; v_sessions bigint; v_sub public.subscriptions; v_config jsonb; v_cycle text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  PERFORM private.reconcile_individual_subscription_cycles(v_user);
  v_context := private.subscription_context_before_individual_reconciliation();
  IF v_context->'organization' = 'null'::jsonb AND v_context->'subscription' <> 'null'::jsonb THEN
    SELECT * INTO v_sub FROM public.subscriptions WHERE id = (v_context->'subscription'->>'id')::uuid;
    v_cycle := COALESCE(v_sub.overrides->>'billing_cycle', 'monthly');
    SELECT pv.configuration INTO v_config FROM public.plan_versions pv JOIN public.plans p ON p.id = pv.plan_id
      WHERE p.id = v_sub.plan_id AND (pv.id = NULLIF(to_jsonb(v_sub)->>'plan_version_id', '')::uuid
        OR (NULLIF(to_jsonb(v_sub)->>'plan_version_id', '') IS NULL AND pv.version = p.current_version)) LIMIT 1;
    v_context := jsonb_set(v_context, '{subscription,renewal_required}', to_jsonb(NOT COALESCE(
      (v_config->'commercial'->>CASE WHEN v_cycle IN ('annual','yearly') THEN 'annual_price_cents' ELSE 'monthly_price_cents' END) = '0', false)));
    v_context := jsonb_set(v_context, '{subscription,billing_cycle}', to_jsonb(v_cycle));
    SELECT count(*) INTO v_sessions FROM public.active_sessions WHERE user_id = v_user AND status = 'active';
    v_context := jsonb_set(v_context, '{usage}', COALESCE((SELECT jsonb_agg(
      CASE item->>'resource'
        WHEN 'users' THEN jsonb_set(item, '{consumed}', '1'::jsonb)
        WHEN 'sessions' THEN jsonb_set(item, '{consumed}', to_jsonb(v_sessions))
        ELSE item END ORDER BY ordinal)
      FROM jsonb_array_elements(v_context->'usage') WITH ORDINALITY AS usage(item, ordinal)), '[]'::jsonb));
  END IF;
  RETURN v_context;
END;
$$;
REVOKE ALL ON FUNCTION public.get_subscription_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_subscription_context() TO authenticated;

ALTER FUNCTION public.consume_subscription_usage(text,bigint) RENAME TO consume_usage_before_individual_reconciliation;
ALTER FUNCTION public.consume_usage_before_individual_reconciliation(text,bigint) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.consume_usage_before_individual_reconciliation(text,bigint) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.consume_subscription_usage(p_resource_code text, p_amount bigint DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  PERFORM private.reconcile_individual_subscription_cycles(auth.uid());
  RETURN private.consume_usage_before_individual_reconciliation(p_resource_code, p_amount);
END;
$$;
REVOKE ALL ON FUNCTION public.consume_subscription_usage(text,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_subscription_usage(text,bigint) TO authenticated;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.schedule('reconcile_individual_subscription_cycles', '*/5 * * * *',
      'SELECT private.reconcile_individual_subscription_cycles();');
  END IF;
END $$;
