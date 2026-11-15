-- Individual access grants are separate from municipal membership invitations.
CREATE TABLE private.individual_access_keys (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code_hash text NOT NULL UNIQUE,
 created_by uuid NOT NULL REFERENCES auth.users(id), operation_id uuid NOT NULL,
 municipality text NOT NULL, uf text NOT NULL CHECK (uf ~ '^[A-Z]{2}$'),
 plan_id uuid NOT NULL REFERENCES public.plans(id), plan_version_id uuid NOT NULL REFERENCES public.plan_versions(id),
 access_days integer NOT NULL CHECK (access_days BETWEEN 1 AND 365),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 used_by uuid REFERENCES auth.users(id), used_at timestamptz, revoked_at timestamptz,
 UNIQUE(created_by, operation_id)
);
CREATE TABLE private.individual_key_attempts (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id), window_start timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 0
);
REVOKE ALL ON private.individual_access_keys, private.individual_key_attempts FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.create_individual_access_key(p_municipio text, p_uf text, p_access_days integer, p_expires_in_minutes integer, p_reason text, p_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid := auth.uid(); v_plan public.plans; v_version uuid; v_key private.individual_access_keys; v_code text;
BEGIN
 IF v_actor IS NULL OR private.current_internal_role(v_actor) IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'token_management_not_allowed'; END IF;
 IF p_operation_id IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 8 AND 500
 OR p_municipio IS NULL OR length(btrim(p_municipio)) NOT BETWEEN 2 AND 120 OR p_uf IS NULL OR p_uf !~ '^[A-Z]{2}$'
 OR p_access_days IS NULL OR p_access_days NOT BETWEEN 1 AND 365 OR p_expires_in_minutes IS NULL OR p_expires_in_minutes NOT BETWEEN 15 AND 10080 THEN RAISE EXCEPTION 'invalid_key_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text, 0));
 SELECT * INTO v_key FROM private.individual_access_keys WHERE created_by = v_actor AND operation_id = p_operation_id;
 IF FOUND THEN RETURN jsonb_build_object('ok', true, 'already_created', true, 'id', v_key.id); END IF;
 IF (SELECT count(*) FROM private.individual_access_keys WHERE created_by = v_actor AND created_at > now() - interval '1 hour') >= 100 THEN RAISE EXCEPTION 'key_rate_limit'; END IF;
 SELECT * INTO v_plan FROM public.plans WHERE code = 'individual_basic' AND audience = 'individual' AND status = 'active';
 SELECT id INTO v_version FROM public.plan_versions WHERE plan_id = v_plan.id AND version = v_plan.current_version;
 IF v_version IS NULL THEN RAISE EXCEPTION 'individual_plan_not_published'; END IF;
 v_code := 'IND-' || upper(replace(gen_random_uuid()::text, '-', ''));
 INSERT INTO private.individual_access_keys(code_hash, created_by, operation_id, municipality, uf, plan_id, plan_version_id, access_days, expires_at)
 VALUES(md5(v_code), v_actor, p_operation_id, btrim(p_municipio), p_uf, v_plan.id, v_version, p_access_days, now() + make_interval(mins => p_expires_in_minutes)) RETURNING * INTO v_key;
 INSERT INTO public.subscription_audit_events(actor_id,event_type,entity_type,entity_id,metadata)
 VALUES(v_actor,'individual_key_created','individual_access_key',v_key.id::text,jsonb_build_object('reason',btrim(p_reason),'access_days',p_access_days,'municipality',btrim(p_municipio),'uf',p_uf));
 RETURN jsonb_build_object('ok',true,'id',v_key.id,'token',v_code,'expires_at',v_key.expires_at);
END $$;

CREATE FUNCTION public.list_individual_access_keys() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF auth.uid() IS NULL OR private.current_internal_role(auth.uid()) IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'token_management_not_allowed'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(k) - 'code_hash') FROM (SELECT id,municipality,uf,access_days,created_at,expires_at,used_at,revoked_at FROM private.individual_access_keys ORDER BY created_at DESC LIMIT 200) k),'[]'::jsonb);
END $$;

CREATE FUNCTION public.revoke_individual_access_key(p_id uuid, p_reason text, p_operation_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF auth.uid() IS NULL OR private.current_internal_role(auth.uid()) IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'token_management_not_allowed'; END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 8 AND 500 THEN RAISE EXCEPTION 'reason_required'; END IF;
 UPDATE private.individual_access_keys SET revoked_at = now() WHERE id = p_id AND used_at IS NULL AND revoked_at IS NULL;
 IF FOUND THEN
 INSERT INTO public.subscription_audit_events(actor_id,event_type,entity_type,entity_id,metadata) VALUES(auth.uid(),'individual_key_revoked','individual_access_key',p_id::text,jsonb_build_object('reason',p_reason));
 END IF;
 RETURN jsonb_build_object('ok',true);
END $$;

CREATE FUNCTION public.redeem_individual_access_key(p_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid := auth.uid(); v_key private.individual_access_keys; v_sub public.subscriptions; v_attempts integer; v_end timestamptz;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text, 0));
 INSERT INTO private.individual_key_attempts(user_id,attempts) VALUES(v_actor,1)
 ON CONFLICT(user_id) DO UPDATE SET attempts = CASE WHEN private.individual_key_attempts.window_start < now() - interval '10 minutes' THEN 1 ELSE private.individual_key_attempts.attempts + 1 END,
 window_start = CASE WHEN private.individual_key_attempts.window_start < now() - interval '10 minutes' THEN now() ELSE private.individual_key_attempts.window_start END RETURNING attempts INTO v_attempts;
 IF v_attempts > 10 THEN RETURN jsonb_build_object('ok',false,'error','key_rate_limit'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE uid = v_actor AND role = 'agent' AND organization_id IS NULL AND "isApproved" = true)
 OR EXISTS(SELECT 1 FROM public.organization_members WHERE user_id = v_actor AND status IN ('active','invited','suspended'))
 OR EXISTS(SELECT 1 FROM public.internal_staff WHERE user_id = v_actor AND status = 'active')
 OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id = v_actor AND email_confirmed_at IS NOT NULL)
 THEN RETURN jsonb_build_object('ok',false,'error','individual_account_required'); END IF;
 SELECT * INTO v_key FROM private.individual_access_keys WHERE code_hash = md5(upper(btrim(p_code))) FOR UPDATE;
 IF v_key.id IS NULL OR v_key.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'error','key_invalid'); END IF;
 IF v_key.used_by = v_actor THEN RETURN jsonb_build_object('ok',true,'already_redeemed',true); END IF;
 IF v_key.used_at IS NOT NULL OR v_key.expires_at <= now() THEN RETURN jsonb_build_object('ok',false,'error','key_unavailable'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.plans WHERE id = v_key.plan_id AND status = 'active') THEN RETURN jsonb_build_object('ok',false,'error','individual_plan_not_published'); END IF;
 SELECT * INTO v_sub FROM public.subscriptions WHERE user_id = v_actor AND status IN ('trial','active','grace','past_due','suspended') ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 -- Never replace a paid subscription, pending provider contract or suspended account.
 IF v_sub.id IS NOT NULL AND (v_sub.status = 'suspended' OR v_sub.provider_subscription_id IS NOT NULL OR (v_sub.status <> 'trial' AND v_sub.provider IS DISTINCT FROM 'access_key')) THEN RETURN jsonb_build_object('ok',false,'error','existing_subscription'); END IF;
 v_end := greatest(now(), CASE WHEN v_sub.provider = 'access_key' THEN v_sub.current_period_end ELSE now() END) + make_interval(days => v_key.access_days);
 IF v_sub.id IS NULL THEN
 INSERT INTO public.subscriptions(plan_id,plan_version_id,user_id,status,current_period_start,current_period_end,provider,cancel_at_period_end)
 VALUES(v_key.plan_id,v_key.plan_version_id,v_actor,'active',now(),v_end,'access_key',true);
 ELSE
 UPDATE public.subscriptions SET plan_id=v_key.plan_id,plan_version_id=v_key.plan_version_id,status='active',current_period_end=v_end,trial_ends_at=NULL,grace_ends_at=NULL,canceled_at=NULL,provider='access_key',cancel_at_period_end=true,updated_at=now() WHERE id=v_sub.id;
 END IF;
 UPDATE private.individual_access_keys SET used_by=v_actor,used_at=now() WHERE id=v_key.id;
 INSERT INTO public.subscription_audit_events(actor_id,event_type,entity_type,entity_id,metadata) VALUES(v_actor,'individual_key_redeemed','individual_access_key',v_key.id::text,jsonb_build_object('access_until',v_end));
 RETURN jsonb_build_object('ok',true,'access_until',v_end);
END $$;
REVOKE ALL ON FUNCTION public.create_individual_access_key(text,text,integer,integer,text,uuid), public.list_individual_access_keys(), public.revoke_individual_access_key(uuid,text,uuid), public.redeem_individual_access_key(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_individual_access_key(text,text,integer,integer,text,uuid), public.list_individual_access_keys(), public.revoke_individual_access_key(uuid,text,uuid), public.redeem_individual_access_key(text) TO authenticated;
NOTIFY pgrst, 'reload schema';
