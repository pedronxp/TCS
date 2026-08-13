-- Municipal roles, individual affiliation and privacy-safe portal contracts.
-- This migration is intentionally additive/compatible with the legacy mobile
-- profile projection: organization_members remains the source of authority.

-- 1. Normalize the municipal hierarchy.
ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;

UPDATE public.organization_members
SET role = CASE role
  WHEN 'owner' THEN 'master'
  WHEN 'coordinator' THEN 'admin'
  ELSE role
END
WHERE role IN ('owner', 'coordinator');

ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('master', 'admin', 'supervisor', 'agent'));

ALTER TABLE public.organization_invites
  DROP CONSTRAINT IF EXISTS organization_invites_role_check;

UPDATE public.organization_invites
SET role = 'admin'
WHERE role = 'coordinator';

ALTER TABLE public.organization_invites
  ADD CONSTRAINT organization_invites_role_check
  CHECK (role IN ('admin', 'supervisor', 'agent'));

-- Pending legacy codes use the same invitation hierarchy.
UPDATE public.invite_tokens
SET role = 'admin'
WHERE role IN ('owner', 'coordinator', 'master_admin', 'admin');

-- Keeps public.users as a compatibility projection only. The capability is
-- set by the SECURITY DEFINER membership trigger, never supplied by clients.
CREATE OR REPLACE FUNCTION private.protect_user_authorization_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.is_owner_admin() THEN RETURN NEW; END IF;

  IF current_setting('tcs.customer_bootstrap_user_id', true) = OLD.uid::text
     AND NEW."isApproved" = true
     AND NEW.municipio IS NOT NULL
     AND NEW.organization_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.organization_members AS membership
       JOIN public.organizations AS organization ON organization.id = membership.organization_id
       WHERE membership.user_id = OLD.uid
         AND membership.organization_id = NEW.organization_id
         AND membership.status = 'active'
         AND organization.municipality_name = NEW.municipio
         AND NEW.role = CASE
           WHEN membership.role IN ('master', 'admin') THEN 'admin'
           WHEN membership.role = 'supervisor' THEN 'supervisor'
           ELSE 'agent'
         END
     ) THEN
    RETURN NEW;
  END IF;

  IF current_setting('tcs.customer_bootstrap_user_id', true) = OLD.uid::text
     AND coalesce(OLD."isApproved", false) = false
     AND OLD.role = 'agent'
     AND OLD.municipio IS NULL
     AND OLD.organization_id IS NULL
     AND NEW."isApproved" = true
     AND NEW.role = 'agent'
     AND NEW.municipio IS NULL
     AND NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.municipio IS DISTINCT FROM OLD.municipio
     OR NEW."isApproved" IS DISTINCT FROM OLD."isApproved" THEN
    RAISE EXCEPTION 'authorization_fields_are_server_managed' USING ERRCODE = '42501';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     AND NEW.organization_id IS DISTINCT FROM private.current_organization_id() THEN
    RAISE EXCEPTION 'organization_field_is_server_managed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.sync_user_profile_from_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_organization public.organizations;
  v_legacy_role text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.internal_staff
    WHERE user_id = NEW.user_id AND status = 'active'
  ) THEN RETURN NEW; END IF;

  IF NEW.status <> 'active' THEN
    PERFORM set_config('tcs.customer_bootstrap_user_id', NEW.user_id::text, true);
    UPDATE public.users
    SET "isApproved" = false
    WHERE uid = NEW.user_id AND organization_id = NEW.organization_id;
    RETURN NEW;
  END IF;

  SELECT * INTO v_organization
  FROM public.organizations
  WHERE id = NEW.organization_id;
  IF v_organization.id IS NULL THEN RETURN NEW; END IF;

  v_legacy_role := CASE
    WHEN NEW.role IN ('master', 'admin') THEN 'admin'
    WHEN NEW.role = 'supervisor' THEN 'supervisor'
    ELSE 'agent'
  END;
  PERFORM set_config('tcs.customer_bootstrap_user_id', NEW.user_id::text, true);
  UPDATE public.users
  SET role = v_legacy_role,
      municipio = v_organization.municipality_name,
      "isApproved" = true,
      organization_id = NEW.organization_id
  WHERE uid = NEW.user_id;
  RETURN NEW;
END;
$$;

-- 2. Durable, private record of the choice made after account creation.
CREATE TABLE private.customer_affiliation_states (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('choice_required', 'pending_token', 'individual', 'municipal')),
  last_token_attempt_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE private.customer_affiliation_states FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.begin_customer_affiliation(
  p_choice text,
  p_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_choice text := lower(trim(coalesce(p_choice, '')));
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.internal_staff WHERE user_id = v_user AND status = 'active') THEN
    RAISE EXCEPTION 'internal_account_not_eligible' USING ERRCODE = '42501';
  END IF;

  IF v_choice = 'individual' THEN
    v_result := public.bootstrap_individual_customer(
      'portal-affiliation-individual-' || v_user::text,
      'customer-terms-2026-08'
    );
    INSERT INTO private.customer_affiliation_states(user_id, state, updated_at)
    VALUES (v_user, 'individual', now())
    ON CONFLICT (user_id) DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at;
    RETURN v_result || jsonb_build_object('affiliation_state', 'individual');
  END IF;

  IF v_choice <> 'municipal' THEN
    RAISE EXCEPTION 'invalid_affiliation_choice' USING ERRCODE = '22023';
  END IF;

  INSERT INTO private.customer_affiliation_states(user_id, state, last_token_attempt_at, updated_at)
  VALUES (v_user, 'pending_token', now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET state = 'pending_token', last_token_attempt_at = now(), updated_at = now();

  IF nullif(trim(p_token), '') IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'affiliation_state', 'pending_token', 'reason', 'token_required');
  END IF;

  -- Legacy municipality codes are the supported token channel. Organization
  -- invitation links continue to use their dedicated acceptance route.
  v_result := public.accept_legacy_municipal_invite(trim(p_token));
  IF coalesce((v_result->>'accepted')::boolean, false) THEN
    UPDATE private.customer_affiliation_states
    SET state = 'municipal', updated_at = now()
    WHERE user_id = v_user;
  END IF;
  RETURN v_result || jsonb_build_object(
    'affiliation_state', CASE WHEN coalesce((v_result->>'accepted')::boolean, false) THEN 'municipal' ELSE 'pending_token' END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.begin_customer_affiliation(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_customer_affiliation(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.internal_link_customer_to_organization(
  p_user_id uuid,
  p_organization_id uuid,
  p_role text DEFAULT 'agent'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := lower(trim(coalesce(p_role, 'agent')));
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.internal_staff
    WHERE user_id = v_actor AND status = 'active' AND role IN ('owner', 'support')
  ) THEN RAISE EXCEPTION 'municipal_link_not_allowed' USING ERRCODE = '42501'; END IF;
  IF v_role NOT IN ('master', 'admin', 'supervisor', 'agent') THEN
    RAISE EXCEPTION 'invalid_municipal_role' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id AND status <> 'archived') THEN
    RAISE EXCEPTION 'organization_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = p_user_id AND status IN ('active', 'invited', 'suspended') AND organization_id <> p_organization_id
  ) THEN RAISE EXCEPTION 'membership_conflict' USING ERRCODE = '23505'; END IF;

  INSERT INTO public.organization_members(organization_id, user_id, role, status, joined_at)
  VALUES (p_organization_id, p_user_id, v_role, 'active', now())
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, status = 'active', joined_at = coalesce(organization_members.joined_at, now());

  INSERT INTO private.customer_affiliation_states(user_id, state, updated_at)
  VALUES (p_user_id, 'municipal', now())
  ON CONFLICT (user_id) DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at;
  INSERT INTO public.subscription_audit_events(organization_id, actor_id, event_type, entity_type, entity_id, metadata)
  VALUES (p_organization_id, v_actor, 'customer_municipal_linked', 'user', p_user_id::text, jsonb_build_object('role', v_role));
  RETURN jsonb_build_object('linked', true, 'organization_id', p_organization_id, 'user_id', p_user_id, 'role', v_role);
END;
$$;
REVOKE ALL ON FUNCTION public.internal_link_customer_to_organization(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_link_customer_to_organization(uuid, uuid, text) TO authenticated;

-- 3. Server-derived access context; municipal accounts are never downgraded to
-- individual accounts and usage/billing dates are supplied to both portals.
CREATE OR REPLACE FUNCTION public.get_portal_access_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_profile public.users;
  v_member public.organization_members;
  v_org public.organizations;
  v_subscription public.subscriptions;
  v_plan public.plans;
  v_version public.plan_versions;
  v_permissions text[];
  v_features jsonb := '{}'::jsonb;
  v_limits jsonb := '{}'::jsonb;
  v_usage jsonb := '{}'::jsonb;
  v_creation_allowed boolean := false;
  v_restriction text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.internal_staff WHERE user_id = v_user AND status = 'active') THEN RETURN NULL; END IF;
  SELECT * INTO v_profile FROM public.users WHERE uid = v_user;
  IF v_profile.uid IS NULL OR NOT coalesce(v_profile."isApproved", false) THEN RETURN NULL; END IF;

  SELECT * INTO v_member FROM public.organization_members
  WHERE user_id = v_user AND status IN ('active', 'invited', 'suspended')
  ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'invited' THEN 1 ELSE 2 END
  LIMIT 1;
  IF v_member.id IS NOT NULL THEN
    SELECT * INTO v_org FROM public.organizations WHERE id = v_member.organization_id;
    SELECT * INTO v_subscription FROM public.subscriptions
    WHERE organization_id = v_member.organization_id
    ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'trial' THEN 1 WHEN 'grace' THEN 2 WHEN 'past_due' THEN 3 ELSE 4 END, created_at DESC
    LIMIT 1;
  ELSE
    SELECT * INTO v_subscription FROM public.subscriptions
    WHERE user_id = v_user
    ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'trial' THEN 1 WHEN 'grace' THEN 2 WHEN 'past_due' THEN 3 ELSE 4 END, created_at DESC
    LIMIT 1;
  END IF;
  IF v_subscription.id IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.plans WHERE id = v_subscription.plan_id;
    SELECT * INTO v_version FROM public.plan_versions
    WHERE id = coalesce(v_subscription.plan_version_id, (
      SELECT id FROM public.plan_versions WHERE plan_id = v_plan.id
      ORDER BY published_at DESC NULLS LAST, created_at DESC LIMIT 1
    ));
    SELECT coalesce(jsonb_object_agg(feature_code, enabled), '{}'::jsonb) INTO v_features
    FROM public.plan_version_features WHERE plan_version_id = v_version.id;
    IF v_features = '{}'::jsonb THEN
      SELECT coalesce(jsonb_object_agg(feature_code, enabled), '{}'::jsonb) INTO v_features
      FROM public.plan_features WHERE plan_id = v_plan.id;
    END IF;
    SELECT coalesce(jsonb_object_agg(resource_code, hard_limit), '{}'::jsonb) INTO v_limits
    FROM public.plan_version_limits WHERE plan_version_id = v_version.id;
    IF v_limits = '{}'::jsonb THEN
      SELECT coalesce(jsonb_object_agg(resource_code, hard_limit), '{}'::jsonb) INTO v_limits
      FROM public.plan_limits WHERE plan_id = v_plan.id;
    END IF;
    SELECT coalesce(jsonb_object_agg(resource_code, consumed), '{}'::jsonb) INTO v_usage
    FROM public.usage_counters
    WHERE period_start = v_subscription.current_period_start
      AND ((v_member.id IS NULL AND user_id = v_user) OR (v_member.id IS NOT NULL AND organization_id = v_member.organization_id));
  END IF;

  IF v_member.id IS NULL THEN
    v_permissions := ARRAY['dashboard.read','inspection.read','inspection.create','map.read','appointment.read','document.read','report.read','usage.read','billing.read','billing.manage','support.read','support.create','profile.read','profile.manage'];
  ELSIF v_member.role = 'master' THEN
    v_permissions := ARRAY['dashboard.read','inspection.read','inspection.create','map.read','appointment.read','document.read','report.read','team.read','team.manage','invite.agent','invite.manage','usage.read','billing.read','billing.manage','support.read','support.create','settings.read','settings.manage','profile.read','profile.manage'];
  ELSIF v_member.role = 'admin' THEN
    v_permissions := ARRAY['dashboard.read','inspection.read','inspection.create','map.read','appointment.read','document.read','report.read','team.read','team.manage','invite.agent','invite.manage','usage.read','billing.read','support.read','support.create','profile.read','profile.manage'];
  ELSIF v_member.role = 'supervisor' THEN
    v_permissions := ARRAY['dashboard.read','inspection.read','inspection.create','map.read','appointment.read','document.read','report.read','team.read','invite.agent','usage.read','support.read','support.create','profile.read','profile.manage'];
  ELSE
    v_permissions := ARRAY['dashboard.read','inspection.read','inspection.create','map.read','appointment.read','document.read','report.read','support.read','support.create','profile.read','profile.manage'];
  END IF;

  v_creation_allowed := (v_member.id IS NULL OR v_member.status = 'active') AND coalesce(v_subscription.status IN ('trial','active','grace'), false);
  IF v_member.id IS NOT NULL AND v_member.status <> 'active' THEN v_restriction := 'membership_inactive';
  ELSIF v_subscription.id IS NULL OR v_subscription.status IN ('canceled','expired') THEN v_restriction := 'subscription_inactive';
  ELSIF v_subscription.status = 'past_due' THEN v_restriction := 'subscription_past_due'; END IF;

  RETURN jsonb_build_object(
    'account_kind', CASE WHEN v_member.id IS NULL THEN 'individual' ELSE 'organization' END,
    'user_id', v_user,
    'display_name', coalesce(nullif(trim(v_profile.name), ''), v_profile.email, 'Cliente TCS'),
    'organization_id', v_member.organization_id,
    'organization_name', v_org.display_name,
    'role', v_member.role,
    'membership_status', v_member.status,
    'subscription_status', coalesce(v_subscription.status, 'none'),
    'cancel_at_period_end', coalesce(v_subscription.cancel_at_period_end, false),
    'plan_id', v_plan.id,
    'plan_version_id', v_version.id,
    'plan_name', v_plan.name,
    'features', v_features,
    'limits', v_limits,
    'usage', v_usage,
    'period_start', v_subscription.current_period_start,
    'period_end', v_subscription.current_period_end,
    'permissions', to_jsonb(v_permissions),
    'creation_allowed', v_creation_allowed,
    'restriction_cause', v_restriction
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_portal_access_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_portal_access_context() TO authenticated;

-- 4. Enforce invite authority at the database boundary.
CREATE OR REPLACE FUNCTION private.portal_invite_role_allowed(p_actor_role text, p_target_role text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT (p_actor_role = 'master' AND p_target_role IN ('admin', 'supervisor', 'agent'))
      OR (p_actor_role = 'admin' AND p_target_role IN ('supervisor', 'agent'))
      OR (p_actor_role = 'supervisor' AND p_target_role = 'agent')
$$;

CREATE OR REPLACE FUNCTION public.portal_create_organization_invite(
  p_role text,
  p_email text,
  p_expires_in_hours integer DEFAULT 72
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid := private.current_organization_id(v_user);
  v_actor_role text := private.organization_role(v_org, v_user);
  v_email text := lower(trim(p_email));
  v_subscription public.subscriptions;
  v_limit bigint;
  v_members bigint;
  v_token text;
  v_id uuid;
BEGIN
  IF v_org IS NULL OR NOT private.portal_invite_role_allowed(v_actor_role, lower(trim(p_role))) THEN
    RAISE EXCEPTION 'invite_role_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR char_length(v_email) > 320 THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
  END IF;
  SELECT subscription.* INTO v_subscription FROM public.subscriptions AS subscription
  WHERE subscription.organization_id = v_org AND subscription.status IN ('trial','active','grace')
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF v_subscription.id IS NULL THEN RETURN jsonb_build_object('allowed', false, 'reason', 'subscription_inactive'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_org::text, 1));
  SELECT coalesce(version_limit.hard_limit, plan_limit.hard_limit) INTO v_limit
  FROM public.plans plan
  LEFT JOIN public.plan_version_limits version_limit ON version_limit.plan_version_id = v_subscription.plan_version_id AND version_limit.resource_code = 'users'
  LEFT JOIN public.plan_limits plan_limit ON plan_limit.plan_id = plan.id AND plan_limit.resource_code = 'users'
  WHERE plan.id = v_subscription.plan_id;
  SELECT (SELECT count(*) FROM public.organization_members WHERE organization_id = v_org AND status IN ('active','invited'))
       + (SELECT count(*) FROM public.organization_invites WHERE organization_id = v_org AND status = 'pending' AND expires_at > now() AND lower(email) <> v_email)
    INTO v_members;
  IF v_limit IS NOT NULL AND v_members >= v_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'limit_reached', 'consumed', v_members, 'limit', v_limit);
  END IF;
  UPDATE public.organization_invites SET status = 'revoked'
  WHERE organization_id = v_org AND lower(email) = v_email AND status = 'pending';
  v_token := upper(encode(extensions.gen_random_bytes(24), 'hex'));
  INSERT INTO public.organization_invites(organization_id, token_hash, email, role, expires_at, created_by)
  VALUES (v_org, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_email, lower(trim(p_role)), now() + make_interval(hours => greatest(1, least(p_expires_in_hours, 720))), v_user)
  RETURNING id INTO v_id;
  INSERT INTO public.subscription_audit_events(organization_id, actor_id, event_type, entity_type, entity_id, metadata)
  VALUES (v_org, v_user, 'organization_invite_created', 'organization_invite', v_id::text, jsonb_build_object('role', lower(trim(p_role))));
  RETURN jsonb_build_object('allowed', true, 'invite_id', v_id, 'token', v_token, 'role', lower(trim(p_role)), 'expires_at', now() + make_interval(hours => greatest(1, least(p_expires_in_hours, 720))));
END;
$$;

-- 5. Device records expose only masked network metadata. Browsers cannot read
-- MAC addresses; a native client may supply a valid MAC through the optional
-- argument, while web sessions display "not available".
ALTER TABLE public.active_sessions
  ADD COLUMN IF NOT EXISTS last_ip inet,
  ADD COLUMN IF NOT EXISTS mac_address text;

CREATE OR REPLACE FUNCTION private.mask_session_ip(p_ip inet)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN p_ip IS NULL THEN NULL
    WHEN family(p_ip) = 4 THEN regexp_replace(host(p_ip), '\.\d+$', '.***')
    ELSE regexp_replace(host(p_ip), '(:[0-9a-f]{0,4}){3}$', ':****:****:****', 'i')
  END
$$;
CREATE OR REPLACE FUNCTION private.mask_session_mac(p_mac text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_mac ~* '^[0-9a-f]{2}(:[0-9a-f]{2}){5}$'
    THEN upper(substring(p_mac FROM 1 FOR 8)) || ':**:**:**'
    ELSE NULL END
$$;

DROP FUNCTION IF EXISTS public.portal_list_own_sessions();
CREATE OR REPLACE FUNCTION public.portal_list_own_sessions()
RETURNS TABLE (
  id uuid, device_name text, platform text, status text,
  started_at timestamptz, last_heartbeat_at timestamptz,
  last_ip_masked text, mac_masked text
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = 'public', 'private'
AS $$
  SELECT id, device_name, platform, status, started_at, last_heartbeat_at,
         private.mask_session_ip(last_ip), private.mask_session_mac(mac_address)
  FROM public.active_sessions
  WHERE user_id = auth.uid() AND status IN ('active', 'replaced')
  ORDER BY last_heartbeat_at DESC
$$;
REVOKE ALL ON FUNCTION public.portal_list_own_sessions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_list_own_sessions() TO authenticated;

-- Replace the historical four-argument overload.  Leaving it in place makes
-- PostgreSQL prefer it for existing clients and bypasses the privacy fields.
DROP FUNCTION IF EXISTS public.register_active_session(text, text, text, boolean);

CREATE OR REPLACE FUNCTION public.register_active_session(
  p_device_id text,
  p_device_name text DEFAULT NULL,
  p_platform text DEFAULT 'unknown',
  p_replace boolean DEFAULT false,
  p_mac_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_auth_session uuid := nullif(auth.jwt()->>'session_id','')::uuid;
  v_org uuid := private.current_organization_id(v_user);
  v_existing public.active_sessions;
  v_policy text := 'block';
  v_enforced boolean;
  v_id uuid;
  v_ip inet;
  v_mac text := nullif(upper(trim(p_mac_address)), '');
BEGIN
  IF v_user IS NULL OR v_auth_session IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF p_platform NOT IN ('android','ios','web','unknown') THEN RAISE EXCEPTION 'invalid_platform'; END IF;
  IF v_mac IS NOT NULL AND v_mac !~ '^[0-9A-F]{2}(:[0-9A-F]{2}){5}$' THEN RAISE EXCEPTION 'invalid_mac_address' USING ERRCODE = '22023'; END IF;
  BEGIN v_ip := nullif(split_part(coalesce(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', ''), ',', 1), '')::inet;
  EXCEPTION WHEN invalid_text_representation THEN v_ip := NULL; END;
  SELECT session_enforcement_enabled INTO v_enforced FROM public.subscription_settings WHERE singleton;
  IF v_org IS NOT NULL THEN SELECT session_policy INTO v_policy FROM public.organizations WHERE id = v_org; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  SELECT * INTO v_existing FROM public.active_sessions WHERE user_id = v_user AND status = 'active' LIMIT 1 FOR UPDATE;
  IF v_existing.id IS NOT NULL AND v_existing.auth_session_id <> v_auth_session THEN
    IF v_enforced AND NOT p_replace AND v_policy = 'block' THEN RETURN jsonb_build_object('allowed', false, 'reason', 'active_session_exists'); END IF;
    UPDATE public.active_sessions SET status = 'replaced', ended_at = now(), ended_by = v_user, end_reason = 'new_login' WHERE id = v_existing.id;
  END IF;
  INSERT INTO public.active_sessions(auth_session_id, user_id, organization_id, device_id, device_name, platform, last_ip, mac_address)
  VALUES (v_auth_session, v_user, v_org, p_device_id, p_device_name, p_platform, v_ip, v_mac)
  ON CONFLICT (auth_session_id) DO UPDATE SET last_heartbeat_at = now(), status = 'active', device_id = EXCLUDED.device_id, device_name = EXCLUDED.device_name, last_ip = coalesce(EXCLUDED.last_ip, active_sessions.last_ip), mac_address = coalesce(EXCLUDED.mac_address, active_sessions.mac_address)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('allowed', true, 'session_id', v_id, 'enforced', coalesce(v_enforced, false));
END;
$$;
REVOKE ALL ON FUNCTION public.register_active_session(text, text, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_active_session(text, text, text, boolean, text) TO authenticated;

-- End-user termination of a device register is intentionally unavailable.
REVOKE ALL ON FUNCTION public.portal_end_own_session(uuid) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.portal_end_own_session(uuid) IS 'Deprecated: device registers are operational history and cannot be ended by portal users.';

-- Align every legacy RLS helper with the normalized hierarchy.
CREATE OR REPLACE FUNCTION private.portal_agent_allowed(
  p_organization_id uuid,
  p_agent_id text,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN private.is_owner_admin(p_user_id) THEN true
    WHEN member.status <> 'active' THEN false
    WHEN NOT EXISTS (
      SELECT 1 FROM public.organization_members AS target
      WHERE target.organization_id = p_organization_id
        AND target.user_id::text = p_agent_id
        AND target.status = 'active'
    ) THEN false
    WHEN member.role IN ('master', 'admin') THEN true
    WHEN member.role = 'agent' THEN p_agent_id = p_user_id::text
    WHEN member.role = 'supervisor' THEN p_agent_id = p_user_id::text
      OR coalesce(member.scope->'agent_ids', '[]'::jsonb) ? p_agent_id
    ELSE false
  END
  FROM public.organization_members AS member
  WHERE member.organization_id = p_organization_id AND member.user_id = p_user_id
  LIMIT 1
$$;

DROP POLICY IF EXISTS organization_members_portal_select ON public.organization_members;
CREATE POLICY organization_members_portal_select ON public.organization_members FOR SELECT TO authenticated
USING ((SELECT private.is_owner_admin()) OR user_id = (SELECT auth.uid()) OR (
  organization_id = (SELECT private.current_organization_id())
  AND (SELECT private.organization_role(organization_id)) IN ('master', 'admin', 'supervisor')
));
DROP POLICY IF EXISTS subscriptions_portal_select ON public.subscriptions;
CREATE POLICY subscriptions_portal_select ON public.subscriptions FOR SELECT TO authenticated
USING ((SELECT private.is_owner_admin()) OR user_id = (SELECT auth.uid()) OR (
  organization_id = (SELECT private.current_organization_id())
  AND (SELECT private.organization_role(organization_id)) IN ('master', 'admin')
));
DROP POLICY IF EXISTS usage_portal_select ON public.usage_counters;
CREATE POLICY usage_portal_select ON public.usage_counters FOR SELECT TO authenticated
USING ((SELECT private.is_owner_admin()) OR user_id = (SELECT auth.uid()) OR (
  organization_id = (SELECT private.current_organization_id())
  AND (SELECT private.organization_role(organization_id)) IN ('master', 'admin', 'supervisor')
));
DROP POLICY IF EXISTS usage_events_portal_select ON public.usage_events;
CREATE POLICY usage_events_portal_select ON public.usage_events FOR SELECT TO authenticated
USING ((SELECT private.is_owner_admin()) OR user_id = (SELECT auth.uid()) OR (
  organization_id = (SELECT private.current_organization_id())
  AND (SELECT private.organization_role(organization_id)) IN ('master', 'admin', 'supervisor')
));
DROP POLICY IF EXISTS invites_portal_select ON public.organization_invites;
CREATE POLICY invites_portal_select ON public.organization_invites FOR SELECT TO authenticated
USING ((SELECT private.is_owner_admin()) OR (
  organization_id = (SELECT private.current_organization_id()) AND (
    (SELECT private.organization_role(organization_id)) IN ('master', 'admin')
    OR ((SELECT private.organization_role(organization_id)) = 'supervisor' AND role = 'agent')
  )
));

-- Existing customer-entry callers keep the same response shape, with a
-- recoverable pending-token state when the user chose municipal affiliation.
ALTER FUNCTION public.get_customer_entry_context()
  RENAME TO get_customer_entry_context_legacy;
CREATE OR REPLACE FUNCTION public.get_customer_entry_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_state text;
  v_context jsonb;
BEGIN
  v_context := public.get_customer_entry_context_legacy();
  SELECT state INTO v_state FROM private.customer_affiliation_states WHERE user_id = auth.uid();
  IF v_state = 'pending_token' AND v_context->>'entry_state' = 'account_choice_required' THEN
    RETURN jsonb_set(v_context, '{entry_state}', to_jsonb('affiliation_pending_token'::text), true);
  END IF;
  RETURN v_context;
END;
$$;
REVOKE ALL ON FUNCTION public.get_customer_entry_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_entry_context() TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_legacy_municipal_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_invite public.invite_tokens%ROWTYPE;
  v_member_role text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT lower(email), email_confirmed_at INTO v_email, v_confirmed FROM auth.users WHERE id = v_user;
  IF v_confirmed IS NULL THEN RAISE EXCEPTION 'verified_email_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_invite FROM public.invite_tokens WHERE upper(trim(codigo)) = upper(trim(p_token)) FOR UPDATE;
  IF v_invite.codigo IS NULL THEN RETURN jsonb_build_object('accepted', false, 'reason', 'invalid'); END IF;
  IF coalesce(v_invite.usado, false) THEN RETURN jsonb_build_object('accepted', false, 'reason', 'already_used'); END IF;
  IF v_invite."expiraEm" IS NOT NULL AND v_invite."expiraEm" <= now() THEN RETURN jsonb_build_object('accepted', false, 'reason', 'expired'); END IF;
  IF v_invite.email_destinatario IS NOT NULL AND lower(trim(v_invite.email_destinatario)) <> v_email THEN
    RAISE EXCEPTION 'email_mismatch' USING ERRCODE = '42501';
  END IF;
  IF v_invite.organization_id IS NULL THEN RETURN jsonb_build_object('accepted', false, 'reason', 'organization_missing'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE organization_id = v_invite.organization_id AND status IN ('trial','active','grace')) THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'subscription_inactive');
  END IF;
  IF EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = v_user AND status IN ('active','invited','suspended')) THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'membership_conflict');
  END IF;
  PERFORM public.reconcile_customer_identity();
  v_member_role := CASE
    WHEN v_invite.role IN ('master', 'admin') THEN 'admin'
    WHEN v_invite.role = 'supervisor' THEN 'supervisor'
    ELSE 'agent'
  END;
  INSERT INTO public.organization_members(organization_id, user_id, role, status, joined_at)
  VALUES (v_invite.organization_id, v_user, v_member_role, 'active', now());
  UPDATE public.invite_tokens SET usado = true, "usadoPorUid" = v_user,
      "usadoPorNome" = coalesce((SELECT name FROM public.users WHERE uid = v_user), split_part(v_email, '@', 1)),
      "usadoEm" = now(), usado_em = now()
  WHERE codigo = v_invite.codigo;
  RETURN jsonb_build_object('accepted', true, 'organization_id', v_invite.organization_id, 'role', v_member_role);
END;
$$;
REVOKE ALL ON FUNCTION public.accept_legacy_municipal_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_legacy_municipal_invite(text) TO authenticated;

-- Keep the public portal entry point serialized as well as the underlying
-- acceptance function, so a future implementation cannot bypass its seat lock.
CREATE OR REPLACE FUNCTION public.portal_accept_organization_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_organization_id uuid;
  v_invited_email text;
  v_authenticated_email text;
BEGIN
  SELECT organization_id, email INTO v_organization_id, v_invited_email
  FROM public.organization_invites
  WHERE token_hash = encode(extensions.digest(upper(trim(p_token)), 'sha256'), 'hex')
  FOR UPDATE;
  SELECT lower(email) INTO v_authenticated_email FROM auth.users WHERE id = auth.uid();
  IF v_invited_email IS NOT NULL AND lower(trim(v_invited_email)) <> v_authenticated_email THEN
    RAISE EXCEPTION 'email_mismatch' USING ERRCODE = '42501';
  END IF;
  IF v_organization_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_organization_id::text, 1));
  END IF;
  RETURN public.accept_organization_invite(p_token);
END;
$$;
REVOKE ALL ON FUNCTION public.portal_accept_organization_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_accept_organization_invite(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_update_organization_member(
  p_member_id uuid, p_role text, p_status text, p_reason text, p_confirmation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_org uuid := private.current_organization_id(v_actor);
  v_actor_role text := private.organization_role(v_org, v_actor);
  v_member public.organization_members;
  v_active_masters bigint;
BEGIN
  IF v_actor IS NULL OR v_org IS NULL OR v_actor_role NOT IN ('master', 'admin') THEN
    RAISE EXCEPTION 'team_manage_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF p_confirmation <> 'CONFIRMAR' OR char_length(trim(coalesce(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'confirmation_and_reason_required' USING ERRCODE = '22023';
  END IF;
  IF p_role NOT IN ('admin', 'supervisor', 'agent') OR p_status NOT IN ('active', 'suspended', 'removed') THEN
    RAISE EXCEPTION 'invalid_member_change' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('portal-member:' || v_org::text, 0));
  SELECT * INTO v_member FROM public.organization_members
  WHERE id = p_member_id AND organization_id = v_org FOR UPDATE;
  IF v_member.id IS NULL THEN RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_member.user_id = v_actor OR v_member.role = 'master' THEN RAISE EXCEPTION 'protected_member_change_not_allowed' USING ERRCODE = '42501'; END IF;
  IF v_actor_role = 'admin' AND (v_member.role = 'admin' OR p_role = 'admin') THEN
    RAISE EXCEPTION 'admin_cannot_manage_admin' USING ERRCODE = '42501';
  END IF;
  SELECT count(*) INTO v_active_masters FROM public.organization_members
  WHERE organization_id = v_org AND role = 'master' AND status = 'active';
  IF v_active_masters < 1 THEN RAISE EXCEPTION 'master_required' USING ERRCODE = '23514'; END IF;
  UPDATE public.organization_members SET role = p_role, status = p_status,
    joined_at = CASE WHEN p_status = 'active' THEN coalesce(joined_at, now()) ELSE joined_at END,
    updated_at = now()
  WHERE id = v_member.id;
  IF p_status <> 'active' THEN
    UPDATE public.active_sessions SET status = 'revoked', ended_at = now(), ended_by = v_actor, end_reason = 'organization_membership_changed'
    WHERE user_id = v_member.user_id AND status = 'active';
  END IF;
  INSERT INTO public.subscription_audit_events(organization_id, actor_id, event_type, entity_type, entity_id, metadata)
  VALUES (v_org, v_actor, 'portal_organization_member_changed', 'organization_member', v_member.id::text,
    jsonb_build_object('next', jsonb_build_object('role', p_role, 'status', p_status), 'reason', trim(p_reason)));
  RETURN jsonb_build_object('updated', true, 'member_id', v_member.id);
END;
$$;
REVOKE ALL ON FUNCTION public.portal_update_organization_member(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_update_organization_member(uuid, text, text, text, text) TO authenticated;
