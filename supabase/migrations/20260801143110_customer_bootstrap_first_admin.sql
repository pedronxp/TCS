-- Idempotent customer bootstrap and exactly-one first municipal administrator.
-- Public rollout remains controlled by subscription_settings feature flags.

CREATE TABLE private.customer_bootstrap_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  account_kind text NOT NULL CHECK (account_kind IN ('individual', 'organization')),
  status text NOT NULL CHECK (status IN ('in_progress', 'completed', 'blocked')),
  current_step text NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  municipality_key text,
  terms_version text NOT NULL,
  terms_accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (char_length(idempotency_key) BETWEEN 8 AND 128),
  CHECK (char_length(terms_version) BETWEEN 1 AND 64),
  CHECK (
    (account_kind = 'individual' AND organization_id IS NULL AND municipality_key IS NULL)
    OR (account_kind = 'organization' AND organization_id IS NOT NULL AND municipality_key IS NOT NULL)
  )
);

CREATE UNIQUE INDEX customer_bootstrap_states_user_key
  ON private.customer_bootstrap_states (user_id, idempotency_key);
CREATE UNIQUE INDEX customer_bootstrap_states_municipality_key
  ON private.customer_bootstrap_states (municipality_key)
  WHERE account_kind = 'organization' AND status IN ('in_progress', 'completed');

REVOKE ALL ON TABLE private.customer_bootstrap_states
  FROM PUBLIC, anon, authenticated;

-- Store the provisional trial policy in the plan version. A plan still needs
-- to be explicitly published (`plans.status = active`) before a flag can open
-- self-service enrollment.
UPDATE public.plan_versions AS version
SET configuration = jsonb_set(
  version.configuration,
  '{commercial,trial_days}',
  to_jsonb(CASE plan.code WHEN 'individual_basic' THEN 14 ELSE 30 END),
  true
)
FROM public.plans AS plan
WHERE plan.id = version.plan_id
  AND plan.code IN ('individual_basic', 'municipal_basic');

CREATE OR REPLACE FUNCTION public.get_customer_entry_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_identity auth.users;
  v_profile public.users;
  v_member public.organization_members;
  v_organization public.organizations;
  v_bootstrap private.customer_bootstrap_states;
  v_subscription public.subscriptions;
  v_settings public.subscription_settings;
  v_internal boolean := false;
  v_account_kind text;
  v_entry_state text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_identity FROM auth.users WHERE id = v_user;
  SELECT * INTO v_profile FROM public.users WHERE uid = v_user;
  SELECT * INTO v_bootstrap
  FROM private.customer_bootstrap_states
  WHERE user_id = v_user;
  SELECT * INTO v_member
  FROM public.organization_members
  WHERE user_id = v_user
    AND status IN ('active', 'invited', 'suspended')
  ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'invited' THEN 1 ELSE 2 END
  LIMIT 1;
  IF v_member.id IS NOT NULL THEN
    SELECT * INTO v_organization
    FROM public.organizations
    WHERE id = v_member.organization_id;
  END IF;
  SELECT * INTO v_settings FROM public.subscription_settings WHERE singleton;

  v_internal := EXISTS (
    SELECT 1 FROM public.internal_staff
    WHERE user_id = v_user AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.owner_admins
    WHERE user_id = v_user AND active
  );

  IF v_internal THEN
    v_account_kind := 'internal';
    v_entry_state := 'internal_only';
  ELSIF v_member.id IS NOT NULL THEN
    v_account_kind := 'organization';
    v_entry_state := CASE
      WHEN v_member.status = 'active' THEN 'ready'
      ELSE 'membership_' || v_member.status
    END;
  ELSIF v_bootstrap.id IS NOT NULL THEN
    v_account_kind := v_bootstrap.account_kind;
    v_entry_state := CASE
      WHEN v_bootstrap.status = 'completed' THEN 'ready'
      ELSE v_bootstrap.status
    END;
  ELSIF v_profile.uid IS NOT NULL
        AND coalesce(v_profile."isApproved", false)
        AND v_profile.organization_id IS NULL
        AND v_profile.role = 'agent' THEN
    v_account_kind := 'individual';
    v_entry_state := 'ready';
  ELSE
    v_account_kind := NULL;
    v_entry_state := CASE
      WHEN v_identity.email_confirmed_at IS NULL THEN 'email_verification_required'
      ELSE 'account_choice_required'
    END;
  END IF;

  IF v_member.id IS NOT NULL THEN
    SELECT * INTO v_subscription
    FROM public.subscriptions
    WHERE organization_id = v_member.organization_id
      AND status IN ('trial', 'active', 'grace', 'past_due')
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    SELECT * INTO v_subscription
    FROM public.subscriptions
    WHERE user_id = v_user
      AND status IN ('trial', 'active', 'grace', 'past_due')
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'user_id', v_user,
    'email_verified', v_identity.email_confirmed_at IS NOT NULL,
    'account_kind', v_account_kind,
    'entry_state', v_entry_state,
    'profile', CASE WHEN v_profile.uid IS NULL THEN NULL ELSE jsonb_build_object(
      'name', v_profile.name,
      'approved', coalesce(v_profile."isApproved", false)
    ) END,
    'bootstrap', CASE WHEN v_bootstrap.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_bootstrap.id,
      'account_kind', v_bootstrap.account_kind,
      'status', v_bootstrap.status,
      'current_step', v_bootstrap.current_step,
      'organization_id', v_bootstrap.organization_id,
      'terms_version', v_bootstrap.terms_version,
      'updated_at', v_bootstrap.updated_at
    ) END,
    'membership', CASE WHEN v_member.id IS NULL THEN NULL ELSE jsonb_build_object(
      'organization_id', v_member.organization_id,
      'role', v_member.role,
      'status', v_member.status
    ) END,
    'organization', CASE WHEN v_organization.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_organization.id,
      'display_name', v_organization.display_name,
      'municipality_name', v_organization.municipality_name,
      'state_code', v_organization.state_code,
      'status', v_organization.status
    ) END,
    'subscription', CASE WHEN v_subscription.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_subscription.id,
      'status', v_subscription.status,
      'trial_ends_at', v_subscription.trial_ends_at,
      'current_period_end', v_subscription.current_period_end
    ) END,
    'features', jsonb_build_object(
      'individual_bootstrap', coalesce(v_settings.individual_bootstrap_enabled, false),
      'municipal_bootstrap', coalesce(v_settings.municipal_bootstrap_enabled, false),
      'google_auth', coalesce(v_settings.google_customer_auth_enabled, false),
      'password_recovery', coalesce(v_settings.password_recovery_enabled, false)
    ),
    'can_start_individual', NOT v_internal
      AND v_identity.email_confirmed_at IS NOT NULL
      AND v_member.id IS NULL
      AND coalesce(v_settings.individual_bootstrap_enabled, false),
    'can_start_municipal', NOT v_internal
      AND v_identity.email_confirmed_at IS NOT NULL
      AND v_member.id IS NULL
      AND coalesce(v_settings.municipal_bootstrap_enabled, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_entry_context()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_entry_context()
  TO authenticated;

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
  IF EXISTS (
    SELECT 1 FROM public.internal_staff
    WHERE user_id = v_user AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.owner_admins
    WHERE user_id = v_user AND active
  ) THEN
    RETURN public.get_customer_entry_context();
  END IF;

  SELECT * INTO v_identity FROM auth.users WHERE id = v_user;
  v_name := left(coalesce(
    nullif(trim(v_identity.raw_user_meta_data->>'name'), ''),
    nullif(trim(v_identity.raw_user_meta_data->>'full_name'), ''),
    nullif(split_part(lower(v_identity.email), '@', 1), ''),
    'Cliente TCS'
  ), 150);
  v_username := left(
    coalesce(
      nullif(regexp_replace(lower(split_part(v_identity.email, '@', 1)), '[^a-z0-9_.-]', '', 'g'), ''),
      'cliente'
    ) || '-' || left(replace(v_user::text, '-', ''), 8),
    120
  );

  INSERT INTO public.users(
    uid, email, name, username, role, "isApproved", organization_id
  ) VALUES (
    v_user, lower(v_identity.email), v_name, v_username, 'agent', false, NULL
  )
  ON CONFLICT (uid) DO NOTHING;

  RETURN public.get_customer_entry_context();
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_customer_identity()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_customer_identity()
  TO authenticated;

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
  v_profile public.users;
  v_existing private.customer_bootstrap_states;
  v_plan public.plans;
  v_version public.plan_versions;
  v_subscription public.subscriptions;
  v_name text;
  v_username text;
  v_trial_end timestamptz := now() + interval '14 days';
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_idempotency_key IS NULL
     OR char_length(trim(p_idempotency_key)) NOT BETWEEN 8 AND 128
     OR p_terms_version IS NULL
     OR char_length(trim(p_terms_version)) NOT BETWEEN 1 AND 64 THEN
    RAISE EXCEPTION 'invalid_bootstrap_request' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  IF NOT EXISTS (
    SELECT 1 FROM public.subscription_settings
    WHERE singleton AND individual_bootstrap_enabled
  ) THEN
    RAISE EXCEPTION 'individual_bootstrap_disabled' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.internal_staff
    WHERE user_id = v_user AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.owner_admins
    WHERE user_id = v_user AND active
  ) THEN
    RAISE EXCEPTION 'customer_identity_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_identity FROM auth.users WHERE id = v_user;
  IF v_identity.email IS NULL OR v_identity.email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'verified_email_required' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = v_user AND status IN ('active', 'invited', 'suspended')
  ) THEN
    RAISE EXCEPTION 'municipal_membership_exists' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing
  FROM private.customer_bootstrap_states
  WHERE user_id = v_user
  FOR UPDATE;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.account_kind <> 'individual' THEN
      RAISE EXCEPTION 'customer_kind_already_selected' USING ERRCODE = '23505';
    END IF;
    RETURN public.get_customer_entry_context();
  END IF;

  SELECT * INTO v_plan
  FROM public.plans
  WHERE code = 'individual_basic' AND status = 'active';
  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'individual_plan_not_published' USING ERRCODE = '55000';
  END IF;
  SELECT * INTO v_version
  FROM public.plan_versions
  WHERE plan_id = v_plan.id AND version = v_plan.current_version;
  IF v_version.id IS NULL THEN
    RAISE EXCEPTION 'individual_plan_version_missing' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO v_profile FROM public.users WHERE uid = v_user FOR UPDATE;
  IF v_profile.uid IS NOT NULL AND (
    v_profile.role IS DISTINCT FROM 'agent'
    OR v_profile.municipio IS NOT NULL
    OR v_profile.organization_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'neutral_customer_profile_required' USING ERRCODE = '42501';
  END IF;

  v_name := left(coalesce(
    nullif(trim(v_identity.raw_user_meta_data->>'name'), ''),
    nullif(trim(v_identity.raw_user_meta_data->>'full_name'), ''),
    split_part(v_identity.email, '@', 1)
  ), 150);
  v_username := left(
    coalesce(
      nullif(regexp_replace(lower(split_part(v_identity.email, '@', 1)), '[^a-z0-9_.-]', '', 'g'), ''),
      'cliente'
    ) || '-' || left(replace(v_user::text, '-', ''), 8),
    120
  );

  PERFORM set_config('tcs.customer_bootstrap_user_id', v_user::text, true);

  INSERT INTO public.users(
    uid, email, name, username, role, municipio, "isApproved", organization_id
  ) VALUES (
    v_user, lower(v_identity.email), v_name, v_username, 'agent', NULL, true, NULL
  )
  ON CONFLICT (uid) DO UPDATE
  SET email = EXCLUDED.email,
      name = EXCLUDED.name,
      username = EXCLUDED.username,
      role = 'agent',
      municipio = NULL,
      "isApproved" = true,
      organization_id = NULL;

  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE user_id = v_user
    AND status IN ('trial', 'active', 'grace', 'past_due')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;
  IF v_subscription.id IS NULL THEN
    INSERT INTO public.subscriptions(
      plan_id, plan_version_id, user_id, status, starts_at,
      trial_ends_at, current_period_start, current_period_end
    ) VALUES (
      v_plan.id, v_version.id, v_user, 'trial', now(),
      v_trial_end, now(), v_trial_end
    );
  END IF;

  INSERT INTO private.customer_bootstrap_states(
    user_id,
    idempotency_key,
    account_kind,
    status,
    current_step,
    terms_version,
    completed_at
  ) VALUES (
    v_user,
    trim(p_idempotency_key),
    'individual',
    'completed',
    'completed',
    trim(p_terms_version),
    now()
  );

  INSERT INTO public.subscription_audit_events(
    actor_id, event_type, entity_type, entity_id, metadata
  ) VALUES (
    v_user,
    'customer_bootstrap_completed',
    'individual_customer',
    v_user::text,
    jsonb_build_object(
      'account_kind', 'individual',
      'idempotency_key_hash', encode(extensions.digest(trim(p_idempotency_key), 'sha256'), 'hex'),
      'terms_version', trim(p_terms_version),
      'trial_days', 14
    )
  );

  RETURN public.get_customer_entry_context();
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_individual_customer(text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_individual_customer(text, text)
  TO authenticated;

-- Extend the authorization-field guard with a transaction-scoped bootstrap
-- capability. Clients cannot set this database setting through PostgREST.
CREATE OR REPLACE FUNCTION private.protect_user_authorization_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.is_owner_admin() THEN
    RETURN NEW;
  END IF;

  IF current_setting('tcs.customer_bootstrap_user_id', true) = OLD.uid::text
     AND auth.uid() = OLD.uid
     AND OLD.role = 'agent'
     AND coalesce(OLD."isApproved", false) = false
     AND OLD.municipio IS NULL
     AND OLD.organization_id IS NULL
     AND NEW.role = 'agent'
     AND NEW."isApproved" = true
     AND NEW.municipio IS NULL
     AND NEW.organization_id IS NULL
     AND EXISTS (
       SELECT 1 FROM auth.users AS identity
       WHERE identity.id = OLD.uid
         AND identity.email IS NOT NULL
         AND identity.email_confirmed_at IS NOT NULL
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.internal_staff
       WHERE user_id = OLD.uid AND status = 'active'
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members
       WHERE user_id = OLD.uid AND status IN ('active', 'invited', 'suspended')
     ) THEN
    RETURN NEW;
  END IF;

  IF current_setting('tcs.customer_bootstrap_user_id', true) = OLD.uid::text
     AND NEW."isApproved" = true
     AND NEW.municipio IS NOT NULL
     AND NEW.organization_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.organization_members AS membership
       JOIN public.organizations AS organization
         ON organization.id = membership.organization_id
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

  IF current_setting('tcs.customer_bootstrap_user_id', true) = OLD.uid::text
     AND NEW."isApproved" = false
     AND NEW.role IS NOT DISTINCT FROM OLD.role
     AND NEW.municipio IS NOT DISTINCT FROM OLD.municipio
     AND NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id
     AND EXISTS (
       SELECT 1 FROM public.organization_members
       WHERE user_id = OLD.uid
         AND organization_id = OLD.organization_id
         AND status IN ('invited', 'suspended', 'removed')
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

REVOKE ALL ON FUNCTION private.protect_user_authorization_fields()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bootstrap_municipal_customer(
  p_idempotency_key text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_identity auth.users;
  v_profile public.users;
  v_existing private.customer_bootstrap_states;
  v_plan public.plans;
  v_version public.plan_versions;
  v_organization_id uuid := gen_random_uuid();
  v_display_name text;
  v_municipality text;
  v_state_code text;
  v_responsible_name text;
  v_terms_version text;
  v_municipality_key text;
  v_slug text;
  v_name text;
  v_username text;
  v_trial_end timestamptz := now() + interval '30 days';
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_idempotency_key IS NULL
     OR char_length(trim(p_idempotency_key)) NOT BETWEEN 8 AND 128
     OR coalesce(jsonb_typeof(p_payload), '') <> 'object' THEN
    RAISE EXCEPTION 'invalid_bootstrap_request' USING ERRCODE = '22023';
  END IF;
  IF p_payload ?| ARRAY[
    'role', 'internal_role', 'master_admin', 'owner_admin', 'internal_staff',
    'isApproved', 'organization_status', 'subscription_status'
  ] THEN
    RAISE EXCEPTION 'forbidden_authorization_field' USING ERRCODE = '42501';
  END IF;

  v_display_name := nullif(trim(p_payload->>'display_name'), '');
  v_municipality := nullif(trim(p_payload->>'municipality_name'), '');
  v_state_code := upper(trim(coalesce(p_payload->>'state_code', '')));
  v_responsible_name := nullif(trim(p_payload->>'responsible_name'), '');
  v_terms_version := nullif(trim(p_payload->>'terms_version'), '');
  IF v_display_name IS NULL
     OR v_municipality IS NULL
     OR v_responsible_name IS NULL
     OR v_terms_version IS NULL
     OR char_length(v_terms_version) > 64
     OR v_state_code !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'invalid_municipal_details' USING ERRCODE = '22023';
  END IF;
  v_municipality_key := lower(regexp_replace(v_municipality, '\s+', ' ', 'g'))
    || ':' || lower(v_state_code);

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(v_municipality_key, 1));
  IF NOT EXISTS (
    SELECT 1 FROM public.subscription_settings
    WHERE singleton AND municipal_bootstrap_enabled
  ) THEN
    RAISE EXCEPTION 'municipal_bootstrap_disabled' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.internal_staff
    WHERE user_id = v_user AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.owner_admins
    WHERE user_id = v_user AND active
  ) THEN
    RAISE EXCEPTION 'customer_identity_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_identity FROM auth.users WHERE id = v_user;
  IF v_identity.email IS NULL OR v_identity.email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'verified_email_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing
  FROM private.customer_bootstrap_states
  WHERE user_id = v_user
  FOR UPDATE;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.account_kind <> 'organization' THEN
      RAISE EXCEPTION 'customer_kind_already_selected' USING ERRCODE = '23505';
    END IF;
    RETURN public.get_customer_entry_context();
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = v_user AND status IN ('active', 'invited', 'suspended')
  ) THEN
    RAISE EXCEPTION 'organization_membership_exists_use_invitation' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM private.customer_bootstrap_states
    WHERE municipality_key = v_municipality_key
      AND status IN ('in_progress', 'completed')
  ) THEN
    RAISE EXCEPTION 'municipality_onboarding_exists_use_invitation' USING ERRCODE = '23505';
  END IF;

  SELECT * INTO v_plan
  FROM public.plans
  WHERE code = 'municipal_basic' AND status = 'active';
  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'municipal_plan_not_published' USING ERRCODE = '55000';
  END IF;
  SELECT * INTO v_version
  FROM public.plan_versions
  WHERE plan_id = v_plan.id AND version = v_plan.current_version;
  IF v_version.id IS NULL THEN
    RAISE EXCEPTION 'municipal_plan_version_missing' USING ERRCODE = '55000';
  END IF;

  v_slug := 'municipio-' || lower(v_state_code) || '-'
    || left(replace(v_organization_id::text, '-', ''), 12);
  INSERT INTO public.organizations(
    id,
    slug,
    display_name,
    municipality_name,
    state_code,
    status,
    contact_name,
    contact_email,
    metadata
  ) VALUES (
    v_organization_id,
    v_slug,
    left(v_display_name, 150),
    left(v_municipality, 150),
    v_state_code,
    'pilot',
    left(v_responsible_name, 150),
    lower(v_identity.email),
    jsonb_build_object(
      'source', 'self_service',
      'provisional', true,
      'contractually_active', false,
      'terms_version', v_terms_version
    )
  );

  INSERT INTO public.organization_members(
    organization_id, user_id, role, status, joined_at
  ) VALUES (
    v_organization_id, v_user, 'owner', 'active', now()
  );

  SELECT * INTO v_profile FROM public.users WHERE uid = v_user FOR UPDATE;
  v_name := left(coalesce(
    nullif(trim(v_identity.raw_user_meta_data->>'name'), ''),
    nullif(trim(v_identity.raw_user_meta_data->>'full_name'), ''),
    v_responsible_name
  ), 150);
  v_username := left(
    coalesce(
      nullif(regexp_replace(lower(split_part(v_identity.email, '@', 1)), '[^a-z0-9_.-]', '', 'g'), ''),
      'cliente'
    ) || '-' || left(replace(v_user::text, '-', ''), 8),
    120
  );
  PERFORM set_config('tcs.customer_bootstrap_user_id', v_user::text, true);
  INSERT INTO public.users(
    uid, email, name, username, role, municipio, "isApproved", organization_id
  ) VALUES (
    v_user,
    lower(v_identity.email),
    v_name,
    v_username,
    'admin',
    v_municipality,
    true,
    v_organization_id
  )
  ON CONFLICT (uid) DO UPDATE
  SET email = EXCLUDED.email,
      name = EXCLUDED.name,
      username = EXCLUDED.username,
      role = 'admin',
      municipio = EXCLUDED.municipio,
      "isApproved" = true,
      organization_id = EXCLUDED.organization_id;

  INSERT INTO public.organization_onboarding(
    organization_id,
    pilot_started_at,
    checklist,
    review_due_at
  ) VALUES (
    v_organization_id,
    now(),
    jsonb_build_object(
      'identity', true,
      'organization', true,
      'plan', true,
      'team', false,
      'configuration', false,
      'first_operation', false
    ),
    v_trial_end
  );

  INSERT INTO public.subscriptions(
    plan_id,
    plan_version_id,
    organization_id,
    status,
    starts_at,
    trial_ends_at,
    current_period_start,
    current_period_end
  ) VALUES (
    v_plan.id,
    v_version.id,
    v_organization_id,
    'trial',
    now(),
    v_trial_end,
    now(),
    v_trial_end
  );

  INSERT INTO private.customer_bootstrap_states(
    user_id,
    idempotency_key,
    account_kind,
    status,
    current_step,
    organization_id,
    municipality_key,
    terms_version
  ) VALUES (
    v_user,
    trim(p_idempotency_key),
    'organization',
    'in_progress',
    'team',
    v_organization_id,
    v_municipality_key,
    v_terms_version
  );

  INSERT INTO public.subscription_audit_events(
    organization_id, actor_id, event_type, entity_type, entity_id, metadata
  ) VALUES (
    v_organization_id,
    v_user,
    'first_organization_administrator_created',
    'organization',
    v_organization_id::text,
    jsonb_build_object(
      'account_kind', 'organization',
      'membership_role', 'owner',
      'organization_status', 'pilot',
      'contractually_active', false,
      'idempotency_key_hash', encode(extensions.digest(trim(p_idempotency_key), 'sha256'), 'hex'),
      'terms_version', v_terms_version,
      'trial_days', 30
    )
  );

  RETURN public.get_customer_entry_context();
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_municipal_customer(text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_municipal_customer(text, jsonb)
  TO authenticated;
