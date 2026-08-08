-- Public product preview: two inspection attempts per device/network in a
-- rolling 30-day window. Raw IP addresses are never persisted.

-- Complete the customer entry contract used by the mobile app. Earlier app
-- releases shipped the client flow before these RPCs reached production.
CREATE OR REPLACE FUNCTION public.reconcile_customer_identity()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_identity auth.users;
  v_name text;
  v_username text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_identity FROM auth.users WHERE id = v_user;
  IF v_identity.email IS NULL OR v_identity.email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'verified_email_required' USING ERRCODE = '42501';
  END IF;

  v_name := left(coalesce(
    nullif(trim(v_identity.raw_user_meta_data->>'name'), ''),
    nullif(trim(v_identity.raw_user_meta_data->>'full_name'), ''),
    split_part(v_identity.email, '@', 1)
  ), 150);
  v_username := left(
    coalesce(nullif(regexp_replace(lower(split_part(v_identity.email, '@', 1)), '[^a-z0-9_.-]', '', 'g'), ''), 'cliente')
      || '-' || left(replace(v_user::text, '-', ''), 8),
    120
  );

  INSERT INTO public.users(uid, email, name, username, role, "isApproved", organization_id)
  VALUES (v_user, lower(v_identity.email), v_name, v_username, 'agent', false, NULL)
  ON CONFLICT (uid) DO NOTHING;

  RETURN jsonb_build_object('entry_state', 'pending_customer', 'account_kind', NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_customer_identity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_customer_identity() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_customer_entry_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_profile public.users;
  v_membership public.organization_members;
  v_subscription public.subscriptions;
  v_kind text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_profile FROM public.users WHERE uid = v_user;
  SELECT * INTO v_membership FROM public.organization_members
  WHERE user_id = v_user AND status = 'active' LIMIT 1;
  SELECT * INTO v_subscription FROM public.subscriptions
  WHERE user_id = v_user AND status IN ('trial', 'active', 'grace', 'past_due')
  ORDER BY created_at DESC LIMIT 1;

  v_kind := CASE
    WHEN v_membership.id IS NOT NULL THEN 'organization'
    WHEN v_subscription.id IS NOT NULL THEN 'individual'
    ELSE NULL
  END;

  RETURN jsonb_build_object(
    'entry_state', CASE WHEN coalesce(v_profile."isApproved", false) THEN 'active' ELSE 'pending_customer' END,
    'account_kind', v_kind,
    'lifecycle_state', CASE WHEN coalesce(v_profile."isApproved", false) THEN 'trial' ELSE 'creating' END,
    'features', jsonb_build_object('individual_bootstrap', true, 'municipal_bootstrap', false),
    'onboarding', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_entry_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_entry_context() TO authenticated;

-- Permit only two server-controlled authorization transitions: neutral OAuth
-- identity -> individual customer, or neutral identity -> accepted member.
CREATE OR REPLACE FUNCTION private.protect_user_authorization_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.is_owner_admin() THEN RETURN NEW; END IF;

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

  IF current_setting('tcs.customer_bootstrap_user_id', true) = OLD.uid::text
     AND coalesce(OLD."isApproved", false) = false
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
           WHEN membership.role IN ('owner', 'coordinator') THEN 'admin'
           WHEN membership.role = 'supervisor' THEN 'supervisor'
           ELSE 'agent'
         END
     ) THEN
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

REVOKE ALL ON FUNCTION private.protect_user_authorization_fields() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bootstrap_individual_customer(
  p_idempotency_key text,
  p_terms_version text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_identity auth.users;
  v_plan public.plans;
  v_version public.plan_versions;
  v_trial_end timestamptz := now() + interval '14 days';
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF char_length(trim(coalesce(p_idempotency_key, ''))) NOT BETWEEN 8 AND 128
     OR char_length(trim(coalesce(p_terms_version, ''))) NOT BETWEEN 1 AND 64 THEN
    RAISE EXCEPTION 'invalid_bootstrap_request' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  SELECT * INTO v_identity FROM auth.users WHERE id = v_user;
  IF v_identity.email IS NULL OR v_identity.email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'verified_email_required' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = v_user AND status IN ('active','invited','suspended')) THEN
    RAISE EXCEPTION 'municipal_membership_exists' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE code = 'individual_basic' AND status = 'active';
  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'individual_plan_not_published' USING ERRCODE = '55000'; END IF;
  SELECT * INTO v_version FROM public.plan_versions WHERE plan_id = v_plan.id AND version = v_plan.current_version;

  PERFORM set_config('tcs.customer_bootstrap_user_id', v_user::text, true);
  UPDATE public.users
  SET "isApproved" = true, role = 'agent', municipio = NULL, organization_id = NULL
  WHERE uid = v_user AND coalesce("isApproved", false) = false;
  IF NOT FOUND THEN
    PERFORM public.reconcile_customer_identity();
    UPDATE public.users SET "isApproved" = true
    WHERE uid = v_user AND coalesce("isApproved", false) = false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = v_user AND status IN ('trial','active','grace','past_due')
  ) THEN
    INSERT INTO public.subscriptions(
      plan_id, plan_version_id, user_id, status, starts_at,
      trial_ends_at, current_period_start, current_period_end
    ) VALUES (
      v_plan.id, v_version.id, v_user, 'trial', now(),
      v_trial_end, now(), v_trial_end
    );
  END IF;

  RETURN public.get_customer_entry_context();
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_individual_customer(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_individual_customer(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_customer_onboarding_funnel(
  p_event text,
  p_request_id uuid,
  p_source text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF p_event NOT IN ('onboarding_viewed','account_kind_selected','details_started','terms_accepted','bootstrap_submitted','onboarding_resumed') THEN
    RAISE EXCEPTION 'invalid_onboarding_event' USING ERRCODE = '22023';
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_customer_onboarding_funnel(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_customer_onboarding_funnel(text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_accept_organization_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_invite public.organization_invites;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT lower(email), email_confirmed_at INTO v_email, v_confirmed FROM auth.users WHERE id = v_user;
  IF v_confirmed IS NULL THEN RAISE EXCEPTION 'verified_email_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_invite FROM public.organization_invites
  WHERE token_hash = encode(extensions.digest(upper(trim(p_token)), 'sha256'), 'hex')
  FOR UPDATE;
  IF v_invite.id IS NULL THEN RETURN jsonb_build_object('accepted', false, 'reason', 'invalid'); END IF;
  IF v_invite.email IS NOT NULL AND lower(trim(v_invite.email)) <> v_email THEN
    RAISE EXCEPTION 'email_mismatch' USING ERRCODE = '42501';
  END IF;
  RETURN public.accept_organization_invite(p_token);
END;
$$;

REVOKE ALL ON FUNCTION public.portal_accept_organization_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_accept_organization_invite(text) TO authenticated;

CREATE TABLE private.public_preview_secret (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  secret bytea NOT NULL DEFAULT extensions.gen_random_bytes(32),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO private.public_preview_secret(singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE private.public_preview_usage (
  fingerprint_kind text NOT NULL CHECK (fingerprint_kind IN ('device', 'network')),
  fingerprint_hash text NOT NULL,
  used_count smallint NOT NULL DEFAULT 0 CHECK (used_count BETWEEN 0 AND 2),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fingerprint_kind, fingerprint_hash)
);

CREATE INDEX public_preview_usage_updated_at_idx
  ON private.public_preview_usage(updated_at);

ALTER TABLE private.public_preview_secret ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.public_preview_usage ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON private.public_preview_secret FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.public_preview_usage FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.public_preview_fingerprints(
  p_client_ip text,
  p_device_id text
)
RETURNS TABLE(device_hash text, network_hash text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret bytea;
  v_ip text := trim(coalesce(p_client_ip, ''));
  v_device text := lower(trim(coalesce(p_device_id, '')));
BEGIN
  IF char_length(v_ip) NOT BETWEEN 3 AND 64
     OR char_length(v_device) NOT BETWEEN 16 AND 128
     OR v_device !~ '^[a-z0-9._:-]+$' THEN
    RAISE EXCEPTION 'invalid_preview_fingerprint' USING ERRCODE = '22023';
  END IF;

  SELECT secret INTO v_secret
  FROM private.public_preview_secret
  WHERE singleton;

  RETURN QUERY SELECT
    encode(extensions.hmac(convert_to('device:' || v_device, 'UTF8'), v_secret, 'sha256'), 'hex'),
    encode(extensions.hmac(convert_to('network:' || v_ip, 'UTF8'), v_secret, 'sha256'), 'hex');
END;
$$;

REVOKE ALL ON FUNCTION private.public_preview_fingerprints(text, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_preview_status(
  p_client_ip text,
  p_device_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_device_hash text;
  v_network_hash text;
  v_device_count integer := 0;
  v_network_count integer := 0;
  v_window interval := interval '30 days';
BEGIN
  SELECT fingerprints.device_hash, fingerprints.network_hash
  INTO v_device_hash, v_network_hash
  FROM private.public_preview_fingerprints(p_client_ip, p_device_id) AS fingerprints;

  SELECT coalesce(max(
    CASE WHEN usage.window_started_at > now() - v_window THEN usage.used_count ELSE 0 END
  ), 0)
  INTO v_device_count
  FROM private.public_preview_usage AS usage
  WHERE usage.fingerprint_kind = 'device'
    AND usage.fingerprint_hash = v_device_hash;

  SELECT coalesce(max(
    CASE WHEN usage.window_started_at > now() - v_window THEN usage.used_count ELSE 0 END
  ), 0)
  INTO v_network_count
  FROM private.public_preview_usage AS usage
  WHERE usage.fingerprint_kind = 'network'
    AND usage.fingerprint_hash = v_network_hash;

  RETURN jsonb_build_object(
    'allowed', greatest(v_device_count, v_network_count) < 2,
    'used', greatest(v_device_count, v_network_count),
    'limit', 2,
    'remaining', greatest(0, 2 - greatest(v_device_count, v_network_count))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_preview_status(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_preview_status(text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.claim_public_preview_attempt(
  p_client_ip text,
  p_device_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_device_hash text;
  v_network_hash text;
  v_device_count integer := 0;
  v_network_count integer := 0;
  v_used integer;
  v_window interval := interval '30 days';
BEGIN
  SELECT fingerprints.device_hash, fingerprints.network_hash
  INTO v_device_hash, v_network_hash
  FROM private.public_preview_fingerprints(p_client_ip, p_device_id) AS fingerprints;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_device_hash, 11));
  PERFORM pg_advisory_xact_lock(hashtextextended(v_network_hash, 12));

  UPDATE private.public_preview_usage
  SET used_count = 0,
      window_started_at = now(),
      updated_at = now()
  WHERE window_started_at <= now() - v_window
    AND (
      (fingerprint_kind = 'device' AND fingerprint_hash = v_device_hash)
      OR (fingerprint_kind = 'network' AND fingerprint_hash = v_network_hash)
    );

  SELECT coalesce(max(used_count), 0) INTO v_device_count
  FROM private.public_preview_usage
  WHERE fingerprint_kind = 'device' AND fingerprint_hash = v_device_hash;

  SELECT coalesce(max(used_count), 0) INTO v_network_count
  FROM private.public_preview_usage
  WHERE fingerprint_kind = 'network' AND fingerprint_hash = v_network_hash;

  v_used := greatest(v_device_count, v_network_count);
  IF v_used >= 2 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'used', v_used,
      'limit', 2,
      'remaining', 0,
      'reason', 'preview_limit_reached'
    );
  END IF;

  INSERT INTO private.public_preview_usage(
    fingerprint_kind, fingerprint_hash, used_count, window_started_at, updated_at
  ) VALUES
    ('device', v_device_hash, 1, now(), now()),
    ('network', v_network_hash, 1, now(), now())
  ON CONFLICT (fingerprint_kind, fingerprint_hash) DO UPDATE
  SET used_count = private.public_preview_usage.used_count + 1,
      updated_at = now();

  v_used := v_used + 1;
  RETURN jsonb_build_object(
    'allowed', true,
    'used', v_used,
    'limit', 2,
    'remaining', greatest(0, 2 - v_used)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_public_preview_attempt(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_public_preview_attempt(text, text)
  TO service_role;

COMMENT ON TABLE private.public_preview_usage IS
  'Rate-limit state for the anonymous product preview. Stores keyed hashes only; no raw IP or device identifier.';
COMMENT ON FUNCTION public.claim_public_preview_attempt(text, text) IS
  'Service-role-only preview permit. Enforces two attempts per device or network in a rolling 30-day window.';

-- Invitation acceptance must also approve an already reconciled neutral OAuth
-- profile. Without this update, a first-time Google user accepted the invite
-- but remained trapped in the pending-customer route.
CREATE OR REPLACE FUNCTION public.activate_customer_profile_after_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    PERFORM set_config('tcs.customer_bootstrap_user_id', NEW.user_id::text, true);
    UPDATE public.users AS profile
    SET organization_id = NEW.organization_id,
        "isApproved" = true,
        municipio = organization.municipality_name,
        role = CASE
          WHEN NEW.role IN ('owner', 'coordinator') THEN 'admin'
          WHEN NEW.role = 'supervisor' THEN 'supervisor'
          ELSE 'agent'
        END
    FROM public.organizations AS organization
    WHERE profile.uid = NEW.user_id
      AND organization.id = NEW.organization_id
      AND coalesce(profile."isApproved", false) = false;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_customer_profile_after_invite()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS organization_members_activate_customer_profile
  ON public.organization_members;
CREATE TRIGGER organization_members_activate_customer_profile
AFTER INSERT OR UPDATE OF status, role, organization_id
ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.activate_customer_profile_after_invite();
