-- Customer portal foundation.
-- Creates a server-derived access context, role-scoped portal RPCs, immutable
-- plan entitlements, hardened municipal invitations and provider-neutral billing.

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS scope jsonb NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(scope) = 'object');

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS inspection_id uuid REFERENCES public.vistorias(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS agendamentos_inspection_id_idx ON public.agendamentos(inspection_id);

UPDATE public.organization_invites
SET status = 'revoked'
WHERE email IS NULL AND status = 'pending';
ALTER TABLE public.organization_invites
  ADD CONSTRAINT organization_invites_email_required
  CHECK (email IS NOT NULL) NOT VALID;
ALTER TABLE public.organization_invites
  ADD CONSTRAINT organization_invites_email_normalized
  CHECK (email = lower(trim(email))) NOT VALID;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_version_id uuid REFERENCES public.plan_versions(id),
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_customer_id text,
  ADD COLUMN IF NOT EXISTS provider_subscription_id text,
  ADD COLUMN IF NOT EXISTS provider_event_time timestamptz;

UPDATE public.subscriptions AS subscription
SET plan_version_id = version.id
FROM public.plans AS plan
JOIN public.plan_versions AS version
  ON version.plan_id = plan.id
 AND version.version = plan.current_version
WHERE subscription.plan_id = plan.id
  AND subscription.plan_version_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_subscription_key
  ON public.subscriptions(provider, provider_subscription_id)
  WHERE provider IS NOT NULL AND provider_subscription_id IS NOT NULL;

CREATE TABLE public.plan_version_features (
  plan_version_id uuid NOT NULL REFERENCES public.plan_versions(id) ON DELETE CASCADE,
  feature_code text NOT NULL REFERENCES public.features(code) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(configuration) = 'object'),
  PRIMARY KEY (plan_version_id, feature_code)
);

CREATE TABLE public.plan_version_limits (
  plan_version_id uuid NOT NULL REFERENCES public.plan_versions(id) ON DELETE CASCADE,
  resource_code text NOT NULL CHECK (resource_code IN ('users', 'inspections', 'invitations', 'storage_bytes', 'sessions')),
  hard_limit bigint CHECK (hard_limit IS NULL OR hard_limit >= 0),
  warning_percent integer NOT NULL DEFAULT 80 CHECK (warning_percent BETWEEN 1 AND 100),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(configuration) = 'object'),
  PRIMARY KEY (plan_version_id, resource_code)
);

INSERT INTO public.features(code, name, category, description)
VALUES
  ('individual_portal', 'Portal individual', 'portal', 'Acesso à experiência individual.'),
  ('municipal_portal', 'Portal municipal', 'portal', 'Acesso à experiência municipal.'),
  ('reports', 'Relatórios do portal', 'portal', 'Relatórios e indicadores no portal.')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    active = true;

INSERT INTO public.plan_features(plan_id, feature_code, enabled)
SELECT id,
       CASE WHEN audience = 'organization' THEN 'municipal_portal' ELSE 'individual_portal' END,
       true
FROM public.plans
WHERE audience IN ('individual', 'organization')
ON CONFLICT (plan_id, feature_code) DO UPDATE SET enabled = EXCLUDED.enabled;

INSERT INTO public.plan_features(plan_id, feature_code, enabled)
SELECT id, 'reports', true
FROM public.plans
WHERE audience IN ('individual', 'organization')
ON CONFLICT (plan_id, feature_code) DO UPDATE SET enabled = EXCLUDED.enabled;

INSERT INTO public.plan_version_features(plan_version_id, feature_code, enabled, configuration)
SELECT version.id, feature.feature_code, feature.enabled, feature.configuration
FROM public.plan_versions AS version
JOIN public.plan_features AS feature ON feature.plan_id = version.plan_id
ON CONFLICT (plan_version_id, feature_code) DO NOTHING;

INSERT INTO public.plan_version_limits(plan_version_id, resource_code, hard_limit, warning_percent, configuration)
SELECT version.id, plan_limit.resource_code, plan_limit.hard_limit, plan_limit.warning_percent, plan_limit.configuration
FROM public.plan_versions AS version
JOIN public.plan_limits AS plan_limit ON plan_limit.plan_id = version.plan_id
ON CONFLICT (plan_version_id, resource_code) DO NOTHING;

CREATE TABLE public.portal_rollout_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  foundation_enabled boolean NOT NULL DEFAULT false,
  individual_enabled boolean NOT NULL DEFAULT false,
  municipal_coordinator_enabled boolean NOT NULL DEFAULT false,
  municipal_supervisor_enabled boolean NOT NULL DEFAULT false,
  municipal_agent_enabled boolean NOT NULL DEFAULT false,
  billing_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
INSERT INTO public.portal_rollout_settings(singleton) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE public.portal_checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  plan_version_id uuid NOT NULL REFERENCES public.plan_versions(id) ON DELETE RESTRICT,
  periodicity text NOT NULL CHECK (periodicity IN ('monthly', 'annual')),
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'BRL' CHECK (currency ~ '^[A-Z]{3}$'),
  idempotency_key uuid NOT NULL,
  provider text,
  provider_session_id text,
  checkout_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((user_id IS NOT NULL)::integer + (organization_id IS NOT NULL)::integer = 1),
  UNIQUE (requester_id, idempotency_key)
);

CREATE UNIQUE INDEX portal_checkout_provider_session_key
  ON public.portal_checkout_sessions(provider, provider_session_id)
  WHERE provider IS NOT NULL AND provider_session_id IS NOT NULL;

CREATE TABLE public.portal_payment_events (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  provider_event_time timestamptz NOT NULL,
  event_type text NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'processed', 'ignored', 'failed')),
  error_code text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, provider_event_id)
);

ALTER TABLE public.plan_version_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_version_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_rollout_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_payment_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.plan_version_features, public.plan_version_limits,
  public.portal_rollout_settings, public.portal_checkout_sessions,
  public.portal_payment_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.plan_version_features, public.plan_version_limits TO authenticated;
GRANT SELECT ON public.portal_checkout_sessions TO authenticated;
GRANT SELECT, UPDATE ON public.portal_rollout_settings TO authenticated;

CREATE POLICY plan_version_features_subject_read
ON public.plan_version_features FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.subscriptions AS subscription
    WHERE subscription.plan_version_id = plan_version_features.plan_version_id
      AND (
        subscription.user_id = (SELECT auth.uid())
        OR subscription.organization_id = (SELECT private.current_organization_id())
      )
  )
  OR (SELECT private.is_owner_admin())
);

CREATE POLICY plan_version_limits_subject_read
ON public.plan_version_limits FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.subscriptions AS subscription
    WHERE subscription.plan_version_id = plan_version_limits.plan_version_id
      AND (
        subscription.user_id = (SELECT auth.uid())
        OR subscription.organization_id = (SELECT private.current_organization_id())
      )
  )
  OR (SELECT private.is_owner_admin())
);

CREATE POLICY portal_checkout_subject_read
ON public.portal_checkout_sessions FOR SELECT TO authenticated
USING (
  requester_id = (SELECT auth.uid())
  AND (
    user_id = (SELECT auth.uid())
    OR organization_id = (SELECT private.current_organization_id())
  )
);

CREATE POLICY portal_rollout_owner_read
ON public.portal_rollout_settings FOR SELECT TO authenticated
USING ((SELECT private.is_owner_admin()));
CREATE POLICY portal_rollout_owner_update
ON public.portal_rollout_settings FOR UPDATE TO authenticated
USING ((SELECT private.is_owner_admin()))
WITH CHECK ((SELECT private.is_owner_admin()));

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
      SELECT 1
      FROM public.organization_members AS target
      WHERE target.organization_id = p_organization_id
        AND target.user_id::text = p_agent_id
        AND target.status = 'active'
    ) THEN false
    WHEN member.role IN ('owner', 'coordinator') THEN true
    WHEN member.role = 'agent' THEN p_agent_id = p_user_id::text
    WHEN member.role = 'supervisor' THEN
      p_agent_id = p_user_id::text
      OR COALESCE(member.scope->'agent_ids', '[]'::jsonb) ? p_agent_id
    ELSE false
  END
  FROM public.organization_members AS member
  WHERE member.organization_id = p_organization_id
    AND member.user_id = p_user_id
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION private.portal_agent_allowed(uuid, text, uuid) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS organization_members_org_select ON public.organization_members;
CREATE POLICY organization_members_portal_select
ON public.organization_members FOR SELECT TO authenticated
USING (
  (SELECT private.is_owner_admin())
  OR user_id = (SELECT auth.uid())
  OR (
    organization_id = (SELECT private.current_organization_id())
    AND (SELECT private.organization_role(organization_id)) IN ('owner', 'coordinator', 'supervisor')
  )
);

DROP POLICY IF EXISTS subscriptions_subject_select ON public.subscriptions;
CREATE POLICY subscriptions_portal_select
ON public.subscriptions FOR SELECT TO authenticated
USING (
  (SELECT private.is_owner_admin())
  OR user_id = (SELECT auth.uid())
  OR (
    organization_id = (SELECT private.current_organization_id())
    AND (SELECT private.organization_role(organization_id)) IN ('owner', 'coordinator')
  )
);

DROP POLICY IF EXISTS usage_subject_select ON public.usage_counters;
CREATE POLICY usage_portal_select
ON public.usage_counters FOR SELECT TO authenticated
USING (
  (SELECT private.is_owner_admin())
  OR user_id = (SELECT auth.uid())
  OR (
    organization_id = (SELECT private.current_organization_id())
    AND (SELECT private.organization_role(organization_id)) IN ('owner', 'coordinator', 'supervisor')
  )
);

DROP POLICY IF EXISTS usage_events_subject_select ON public.usage_events;
CREATE POLICY usage_events_portal_select
ON public.usage_events FOR SELECT TO authenticated
USING (
  (SELECT private.is_owner_admin())
  OR user_id = (SELECT auth.uid())
  OR (
    organization_id = (SELECT private.current_organization_id())
    AND (SELECT private.organization_role(organization_id)) IN ('owner', 'coordinator', 'supervisor')
  )
);

DROP POLICY IF EXISTS invites_org_select ON public.organization_invites;
CREATE POLICY invites_portal_select
ON public.organization_invites FOR SELECT TO authenticated
USING (
  (SELECT private.is_owner_admin())
  OR (
    organization_id = (SELECT private.current_organization_id())
    AND (
      (SELECT private.organization_role(organization_id)) IN ('owner', 'coordinator')
      OR (
        (SELECT private.organization_role(organization_id)) = 'supervisor'
        AND role = 'agent'
      )
    )
  )
);

DROP POLICY IF EXISTS tickets_subject_select ON public.support_tickets;
CREATE POLICY tickets_portal_select
ON public.support_tickets FOR SELECT TO authenticated
USING (
  (SELECT private.is_owner_admin())
  OR requester_id = (SELECT auth.uid())
  OR user_id = (SELECT auth.uid())
  OR (
    organization_id = (SELECT private.current_organization_id())
    AND (SELECT private.organization_role(organization_id)) IN ('owner', 'coordinator')
  )
);

DROP POLICY IF EXISTS vistorias_organization_select ON public.vistorias;
DROP POLICY IF EXISTS vistorias_organization_insert ON public.vistorias;
DROP POLICY IF EXISTS vistorias_organization_update ON public.vistorias;
DROP POLICY IF EXISTS vistorias_organization_delete ON public.vistorias;
CREATE POLICY vistorias_portal_select ON public.vistorias FOR SELECT TO authenticated USING (
  (SELECT private.is_owner_admin())
  OR (
    organization_id IS NOT NULL
    AND organization_id = (SELECT private.current_organization_id())
    AND private.portal_agent_allowed(organization_id, "agenteUid"::text)
  )
  OR (organization_id IS NULL AND "agenteUid"::text = (SELECT auth.uid()::text))
);
CREATE POLICY vistorias_portal_insert ON public.vistorias FOR INSERT TO authenticated WITH CHECK (
  (SELECT private.is_owner_admin())
  OR (
    organization_id IS NOT NULL
    AND organization_id = (SELECT private.current_organization_id())
    AND private.portal_agent_allowed(organization_id, "agenteUid"::text)
  )
  OR (organization_id IS NULL AND "agenteUid"::text = (SELECT auth.uid()::text))
);
CREATE POLICY vistorias_portal_update ON public.vistorias FOR UPDATE TO authenticated
USING (
  (SELECT private.is_owner_admin())
  OR (
    organization_id IS NOT NULL
    AND organization_id = (SELECT private.current_organization_id())
    AND private.portal_agent_allowed(organization_id, "agenteUid"::text)
  )
  OR (organization_id IS NULL AND "agenteUid"::text = (SELECT auth.uid()::text))
)
WITH CHECK (
  (SELECT private.is_owner_admin())
  OR (
    organization_id IS NOT NULL
    AND organization_id = (SELECT private.current_organization_id())
    AND private.portal_agent_allowed(organization_id, "agenteUid"::text)
  )
  OR (organization_id IS NULL AND "agenteUid"::text = (SELECT auth.uid()::text))
);
CREATE POLICY vistorias_portal_delete ON public.vistorias FOR DELETE TO authenticated USING (
  (SELECT private.is_owner_admin())
  OR (
    organization_id IS NOT NULL
    AND organization_id = (SELECT private.current_organization_id())
    AND private.portal_agent_allowed(organization_id, "agenteUid"::text)
  )
  OR (organization_id IS NULL AND "agenteUid"::text = (SELECT auth.uid()::text))
);

DROP POLICY IF EXISTS agendamentos_organization_select ON public.agendamentos;
DROP POLICY IF EXISTS agendamentos_organization_insert ON public.agendamentos;
DROP POLICY IF EXISTS agendamentos_organization_update ON public.agendamentos;
DROP POLICY IF EXISTS agendamentos_organization_delete ON public.agendamentos;
CREATE POLICY agendamentos_portal_select ON public.agendamentos FOR SELECT TO authenticated USING (
  (SELECT private.is_owner_admin())
  OR (
    organization_id IS NOT NULL
    AND organization_id = (SELECT private.current_organization_id())
    AND private.portal_agent_allowed(organization_id, COALESCE(agente_uid, criado_por_uid)::text)
  )
  OR (
    organization_id IS NULL
    AND (agente_uid = (SELECT auth.uid()) OR criado_por_uid = (SELECT auth.uid()))
  )
);
CREATE POLICY agendamentos_portal_insert ON public.agendamentos FOR INSERT TO authenticated WITH CHECK (
  (SELECT private.is_owner_admin())
  OR (
    organization_id IS NOT NULL
    AND organization_id = (SELECT private.current_organization_id())
    AND private.portal_agent_allowed(organization_id, COALESCE(agente_uid, criado_por_uid)::text)
  )
  OR (organization_id IS NULL AND criado_por_uid = (SELECT auth.uid()))
);
CREATE POLICY agendamentos_portal_update ON public.agendamentos FOR UPDATE TO authenticated
USING (
  (SELECT private.is_owner_admin())
  OR (
    organization_id IS NOT NULL
    AND organization_id = (SELECT private.current_organization_id())
    AND private.portal_agent_allowed(organization_id, COALESCE(agente_uid, criado_por_uid)::text)
  )
  OR (
    organization_id IS NULL
    AND (agente_uid = (SELECT auth.uid()) OR criado_por_uid = (SELECT auth.uid()))
  )
)
WITH CHECK (
  (SELECT private.is_owner_admin())
  OR (
    organization_id IS NOT NULL
    AND organization_id = (SELECT private.current_organization_id())
    AND private.portal_agent_allowed(organization_id, COALESCE(agente_uid, criado_por_uid)::text)
  )
  OR (organization_id IS NULL AND criado_por_uid = (SELECT auth.uid()))
);
CREATE POLICY agendamentos_portal_delete ON public.agendamentos FOR DELETE TO authenticated USING (
  (SELECT private.is_owner_admin())
  OR (
    organization_id IS NOT NULL
    AND organization_id = (SELECT private.current_organization_id())
    AND private.portal_agent_allowed(organization_id, COALESCE(agente_uid, criado_por_uid)::text)
  )
  OR (organization_id IS NULL AND criado_por_uid = (SELECT auth.uid()))
);

CREATE OR REPLACE FUNCTION public.portal_ensure_individual_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_auth auth.users;
  v_name text;
  v_username text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.internal_staff WHERE user_id = v_user AND status = 'active') THEN
    RAISE EXCEPTION 'customer_identity_required' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = v_user AND status IN ('active', 'invited', 'suspended')
  ) THEN
    RETURN jsonb_build_object('created', false, 'reason', 'municipal_membership_exists');
  END IF;
  SELECT * INTO v_auth FROM auth.users WHERE id = v_user;
  IF v_auth.id IS NULL OR v_auth.email IS NULL OR v_auth.email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'verified_email_required' USING ERRCODE = '42501';
  END IF;
  v_name := COALESCE(
    NULLIF(trim(v_auth.raw_user_meta_data->>'name'), ''),
    NULLIF(trim(v_auth.raw_user_meta_data->>'full_name'), ''),
    split_part(v_auth.email, '@', 1)
  );
  v_username := left(
    COALESCE(NULLIF(regexp_replace(lower(split_part(v_auth.email, '@', 1)), '[^a-z0-9_.-]', '', 'g'), ''), 'cliente'),
    30
  ) || '-' || left(replace(v_user::text, '-', ''), 8);
  INSERT INTO public.users(uid, email, name, username, role, "isApproved", organization_id)
  VALUES (v_user, lower(v_auth.email), left(v_name, 150), v_username, 'agent', true, NULL)
  ON CONFLICT (uid) DO NOTHING;
  RETURN jsonb_build_object('created', true, 'user_id', v_user);
END;
$$;

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
  v_role text;
  v_permissions text[];
  v_features jsonb := '{}'::jsonb;
  v_limits jsonb := '{}'::jsonb;
  v_usage jsonb := '{}'::jsonb;
  v_creation_allowed boolean := false;
  v_restriction text;
  v_rollout public.portal_rollout_settings;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.internal_staff
    WHERE user_id = v_user AND status = 'active'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_profile FROM public.users WHERE uid = v_user;
  IF v_profile.uid IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_member
  FROM public.organization_members
  WHERE user_id = v_user AND status IN ('active', 'invited', 'suspended')
  ORDER BY CASE status WHEN 'active' THEN 1 WHEN 'invited' THEN 2 ELSE 3 END
  LIMIT 1;

  IF v_member.id IS NOT NULL THEN
    SELECT * INTO v_org FROM public.organizations WHERE id = v_member.organization_id;
    v_role := CASE WHEN v_member.role = 'owner' THEN 'coordinator' ELSE v_member.role END;
    SELECT * INTO v_subscription
    FROM public.subscriptions
    WHERE organization_id = v_member.organization_id
    ORDER BY CASE status WHEN 'active' THEN 1 WHEN 'trial' THEN 2 WHEN 'grace' THEN 3 WHEN 'past_due' THEN 4 ELSE 5 END,
             created_at DESC
    LIMIT 1;
  ELSE
    SELECT * INTO v_subscription
    FROM public.subscriptions
    WHERE user_id = v_user
    ORDER BY CASE status WHEN 'active' THEN 1 WHEN 'trial' THEN 2 WHEN 'grace' THEN 3 WHEN 'past_due' THEN 4 ELSE 5 END,
             created_at DESC
    LIMIT 1;
  END IF;

  IF v_subscription.id IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.plans WHERE id = v_subscription.plan_id;
    SELECT * INTO v_version
    FROM public.plan_versions
    WHERE id = v_subscription.plan_version_id
       OR (v_subscription.plan_version_id IS NULL
           AND plan_id = v_plan.id AND version = v_plan.current_version)
    ORDER BY CASE WHEN id = v_subscription.plan_version_id THEN 0 ELSE 1 END
    LIMIT 1;

    SELECT COALESCE(jsonb_object_agg(feature_code, enabled), '{}'::jsonb)
      INTO v_features
    FROM public.plan_version_features
    WHERE plan_version_id = v_version.id;
    IF v_features = '{}'::jsonb THEN
      SELECT COALESCE(jsonb_object_agg(feature_code, enabled), '{}'::jsonb)
        INTO v_features
      FROM public.plan_features WHERE plan_id = v_plan.id;
    END IF;

    SELECT COALESCE(jsonb_object_agg(resource_code, hard_limit), '{}'::jsonb)
      INTO v_limits
    FROM public.plan_version_limits
    WHERE plan_version_id = v_version.id;
    IF v_limits = '{}'::jsonb THEN
      SELECT COALESCE(jsonb_object_agg(resource_code, hard_limit), '{}'::jsonb)
        INTO v_limits
      FROM public.plan_limits WHERE plan_id = v_plan.id;
    END IF;

    SELECT COALESCE(jsonb_object_agg(resource_code, consumed), '{}'::jsonb)
      INTO v_usage
    FROM public.usage_counters
    WHERE period_start = v_subscription.current_period_start
      AND (
        (v_member.id IS NOT NULL AND organization_id = v_member.organization_id)
        OR (v_member.id IS NULL AND user_id = v_user)
      );
  END IF;

  IF v_member.id IS NULL THEN
    v_permissions := ARRAY[
      'dashboard.read', 'inspection.read', 'inspection.create', 'map.read',
      'appointment.read', 'document.read', 'report.read', 'usage.read',
      'billing.read', 'billing.manage', 'support.read', 'support.create',
      'profile.read', 'profile.manage'
    ];
  ELSIF v_role = 'coordinator' THEN
    v_permissions := ARRAY[
      'dashboard.read', 'inspection.read', 'inspection.create', 'map.read',
      'appointment.read', 'document.read', 'report.read', 'team.read',
      'team.manage', 'invite.agent', 'invite.manage', 'usage.read',
      'billing.read', 'billing.manage', 'support.read', 'support.create',
      'settings.read', 'settings.manage', 'profile.read', 'profile.manage'
    ];
  ELSIF v_role = 'supervisor' THEN
    v_permissions := ARRAY[
      'dashboard.read', 'inspection.read', 'inspection.create', 'map.read',
      'appointment.read', 'document.read', 'report.read', 'team.read',
      'invite.agent', 'usage.read', 'support.read', 'support.create',
      'profile.read', 'profile.manage'
    ];
  ELSE
    v_permissions := ARRAY[
      'dashboard.read', 'inspection.read', 'inspection.create', 'map.read',
      'appointment.read', 'document.read', 'report.read', 'support.read',
      'support.create', 'profile.read', 'profile.manage'
    ];
  END IF;

  SELECT * INTO v_rollout FROM public.portal_rollout_settings WHERE singleton;
  v_creation_allowed :=
    (v_member.id IS NULL OR v_member.status = 'active')
    AND v_subscription.status IN ('trial', 'active', 'grace')
    AND COALESCE(v_rollout.foundation_enabled, false)
    AND CASE
      WHEN v_member.id IS NULL THEN COALESCE(v_rollout.individual_enabled, false)
      WHEN v_role = 'coordinator' THEN COALESCE(v_rollout.municipal_coordinator_enabled, false)
      WHEN v_role = 'supervisor' THEN COALESCE(v_rollout.municipal_supervisor_enabled, false)
      ELSE COALESCE(v_rollout.municipal_agent_enabled, false)
    END;

  IF NOT COALESCE(v_rollout.foundation_enabled, false)
     OR NOT CASE
       WHEN v_member.id IS NULL THEN COALESCE(v_rollout.individual_enabled, false)
       WHEN v_role = 'coordinator' THEN COALESCE(v_rollout.municipal_coordinator_enabled, false)
       WHEN v_role = 'supervisor' THEN COALESCE(v_rollout.municipal_supervisor_enabled, false)
       ELSE COALESCE(v_rollout.municipal_agent_enabled, false)
     END THEN
    v_restriction := 'rollout_disabled';
  ELSIF v_member.id IS NOT NULL AND v_member.status <> 'active' THEN
    v_restriction := 'membership_inactive';
  ELSIF v_subscription.id IS NULL OR v_subscription.status IN ('canceled', 'expired') THEN
    v_restriction := 'subscription_inactive';
  ELSIF v_subscription.status = 'past_due' THEN
    v_restriction := 'subscription_past_due';
  END IF;

  RETURN jsonb_build_object(
    'account_kind', CASE WHEN v_member.id IS NULL THEN 'individual' ELSE 'organization' END,
    'user_id', v_user,
    'display_name', COALESCE(NULLIF(trim(v_profile.name), ''), v_profile.email, 'Cliente TCS'),
    'organization_id', v_member.organization_id,
    'organization_name', v_org.display_name,
    'role', v_role,
    'membership_status', v_member.status,
    'subscription_status', COALESCE(v_subscription.status, 'none'),
    'cancel_at_period_end', COALESCE(v_subscription.cancel_at_period_end, false),
    'plan_id', v_plan.id,
    'plan_version_id', v_version.id,
    'plan_name', v_plan.name,
    'features', v_features,
    'limits', v_limits,
    'usage', v_usage,
    'permissions', to_jsonb(v_permissions),
    'creation_allowed', v_creation_allowed,
    'restriction_cause', v_restriction,
    'rollout', jsonb_build_object(
      'foundation', COALESCE(v_rollout.foundation_enabled, false),
      'experience', CASE
        WHEN v_member.id IS NULL THEN COALESCE(v_rollout.individual_enabled, false)
        WHEN v_role = 'coordinator' THEN COALESCE(v_rollout.municipal_coordinator_enabled, false)
        WHEN v_role = 'supervisor' THEN COALESCE(v_rollout.municipal_supervisor_enabled, false)
        ELSE COALESCE(v_rollout.municipal_agent_enabled, false)
      END,
      'billing', COALESCE(v_rollout.billing_enabled, false)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_get_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_context jsonb;
  v_org uuid;
  v_inspections bigint;
  v_appointments bigint;
  v_documents bigint;
  v_usage bigint;
  v_team bigint := 0;
  v_high_risk bigint := 0;
  v_recent jsonb;
  v_upcoming jsonb;
BEGIN
  v_context := public.get_portal_access_context();
  IF v_context IS NULL THEN
    RAISE EXCEPTION 'portal_access_required' USING ERRCODE = '42501';
  END IF;
  v_org := NULLIF(v_context->>'organization_id', '')::uuid;

  SELECT count(*) INTO v_inspections
  FROM public.vistorias
  WHERE (
    (v_org IS NULL AND organization_id IS NULL AND "agenteUid"::text = v_user::text)
    OR (v_org IS NOT NULL AND organization_id = v_org AND private.portal_agent_allowed(v_org, "agenteUid"::text, v_user))
  );
  SELECT count(*) INTO v_appointments
  FROM public.agendamentos
  WHERE data_agendada >= now()
    AND (
      (v_org IS NULL AND organization_id IS NULL AND (agente_uid = v_user OR criado_por_uid = v_user))
      OR (v_org IS NOT NULL AND organization_id = v_org AND private.portal_agent_allowed(v_org, COALESCE(agente_uid, criado_por_uid)::text, v_user))
    );
  SELECT count(*) INTO v_documents
  FROM public.vistorias
  WHERE laudo_url IS NOT NULL
    AND (
      (v_org IS NULL AND organization_id IS NULL AND "agenteUid"::text = v_user::text)
      OR (v_org IS NOT NULL AND organization_id = v_org AND private.portal_agent_allowed(v_org, "agenteUid"::text, v_user))
    );
  v_usage := COALESCE((v_context->'usage'->>'inspections')::bigint, 0);
  IF v_org IS NOT NULL AND v_context->>'role' IN ('coordinator', 'supervisor') THEN
    SELECT count(*) INTO v_team FROM public.organization_members
    WHERE organization_id = v_org AND status = 'active';
    SELECT count(*) INTO v_high_risk FROM public.vistorias AS inspection
    WHERE inspection.organization_id = v_org
      AND private.portal_agent_allowed(v_org, inspection."agenteUid"::text, v_user)
      AND lower(COALESCE(inspection."nivelRisco", '')) IN ('r4', 'critico', 'crítico', 'alto');
  END IF;

  SELECT COALESCE(jsonb_agg(item ORDER BY item->>'occurredAt' DESC), '[]'::jsonb)
  INTO v_recent
  FROM (
    SELECT jsonb_build_object(
      'id', inspection.id,
      'protocol', COALESCE(inspection.protocolo, inspection.id::text),
      'status', inspection.status,
      'riskLevel', inspection."nivelRisco",
      'occurredAt', COALESCE(inspection."dataVistoria", inspection."criadoEm")
    ) AS item
    FROM public.vistorias AS inspection
    WHERE (
      (v_org IS NULL AND inspection.organization_id IS NULL AND inspection."agenteUid"::text = v_user::text)
      OR (v_org IS NOT NULL AND inspection.organization_id = v_org AND private.portal_agent_allowed(v_org, inspection."agenteUid"::text, v_user))
    )
    ORDER BY COALESCE(inspection."dataVistoria", inspection."criadoEm") DESC NULLS LAST
    LIMIT 6
  ) AS recent;

  SELECT COALESCE(jsonb_agg(item ORDER BY item->>'scheduledAt'), '[]'::jsonb)
  INTO v_upcoming
  FROM (
    SELECT jsonb_build_object(
      'id', appointment.id,
      'title', appointment.titulo,
      'scheduledAt', appointment.data_agendada,
      'status', COALESCE(appointment.status, 'scheduled')
    ) AS item
    FROM public.agendamentos AS appointment
    WHERE appointment.data_agendada >= now()
      AND (
        (v_org IS NULL AND appointment.organization_id IS NULL AND (appointment.agente_uid = v_user OR appointment.criado_por_uid = v_user))
        OR (v_org IS NOT NULL AND appointment.organization_id = v_org AND private.portal_agent_allowed(v_org, COALESCE(appointment.agente_uid, appointment.criado_por_uid)::text, v_user))
      )
    ORDER BY appointment.data_agendada
    LIMIT 6
  ) AS upcoming;

  RETURN jsonb_build_object(
    'metrics', jsonb_build_array(
      jsonb_build_object('key', 'inspections', 'label', 'Vistorias no escopo', 'value', v_inspections),
      jsonb_build_object('key', 'appointments', 'label', 'Próximos agendamentos', 'value', v_appointments),
      jsonb_build_object('key', 'documents', 'label', 'Documentos disponíveis', 'value', v_documents),
      jsonb_build_object('key', 'usage', 'label', 'Uso no período', 'value', v_usage)
    ) || CASE WHEN v_org IS NOT NULL AND v_context->>'role' IN ('coordinator', 'supervisor')
      THEN jsonb_build_array(
        jsonb_build_object('key', 'team', 'label', 'Pessoas ativas', 'value', v_team),
        jsonb_build_object('key', 'high_risk', 'label', 'Risco alto no escopo', 'value', v_high_risk)
      )
      ELSE '[]'::jsonb
    END,
    'recent_inspections', v_recent,
    'upcoming', v_upcoming
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_get_workspace(p_section text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_context jsonb;
  v_org uuid;
  v_items jsonb := '[]'::jsonb;
  v_summary jsonb := '{}'::jsonb;
BEGIN
  IF p_section NOT IN (
    'vistorias', 'mapa', 'agenda', 'documentos', 'relatorios', 'equipe',
    'convites', 'consumo', 'assinatura', 'suporte', 'configuracoes', 'perfil'
  ) THEN RAISE EXCEPTION 'invalid_portal_section'; END IF;

  v_context := public.get_portal_access_context();
  IF v_context IS NULL THEN
    RAISE EXCEPTION 'portal_access_required' USING ERRCODE = '42501';
  END IF;
  v_org := NULLIF(v_context->>'organization_id', '')::uuid;

  IF p_section IN ('vistorias', 'mapa', 'documentos') THEN
    SELECT COALESCE(jsonb_agg(item ORDER BY item->>'occurred_at' DESC), '[]'::jsonb)
    INTO v_items
    FROM (
      SELECT jsonb_build_object(
        'id', inspection.id,
        'title', COALESCE(inspection.protocolo, inspection.id::text),
        'protocol', inspection.protocolo,
        'status', inspection.status,
        'subtitle', COALESCE(inspection.endereco, inspection.municipio, 'Local não informado'),
        'occurred_at', COALESCE(inspection."dataVistoria", inspection."criadoEm"),
        'latitude', inspection.latitude,
        'longitude', inspection.longitude,
        'document_available', inspection.laudo_url IS NOT NULL
      ) AS item
      FROM public.vistorias AS inspection
      WHERE (p_section <> 'documentos' OR inspection.laudo_url IS NOT NULL)
        AND (
          (v_org IS NULL AND inspection.organization_id IS NULL AND inspection."agenteUid"::text = v_user::text)
          OR (v_org IS NOT NULL AND inspection.organization_id = v_org AND private.portal_agent_allowed(v_org, inspection."agenteUid"::text, v_user))
        )
      ORDER BY COALESCE(inspection."dataVistoria", inspection."criadoEm") DESC NULLS LAST
      LIMIT 100
    ) AS scoped;
  ELSIF p_section = 'agenda' THEN
    SELECT COALESCE(jsonb_agg(item ORDER BY item->>'scheduled_at'), '[]'::jsonb)
    INTO v_items
    FROM (
      SELECT jsonb_build_object(
        'id', appointment.id,
        'title', appointment.titulo,
        'subtitle', appointment.endereco,
        'status', COALESCE(appointment.status, 'scheduled'),
        'scheduled_at', appointment.data_agendada,
        'inspection_id', appointment.inspection_id
      ) AS item
      FROM public.agendamentos AS appointment
      WHERE (
        (v_org IS NULL AND appointment.organization_id IS NULL AND (appointment.agente_uid = v_user OR appointment.criado_por_uid = v_user))
        OR (v_org IS NOT NULL AND appointment.organization_id = v_org AND private.portal_agent_allowed(v_org, COALESCE(appointment.agente_uid, appointment.criado_por_uid)::text, v_user))
      )
      ORDER BY appointment.data_agendada DESC
      LIMIT 100
    ) AS scoped;
  ELSIF p_section = 'equipe' AND v_org IS NOT NULL AND (v_context->'permissions') ? 'team.read' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', member.id,
      'user_id', member.user_id,
      'title', COALESCE(profile.name, profile.email, member.user_id::text),
      'subtitle', member.role,
      'status', member.status
    ) ORDER BY member.created_at DESC), '[]'::jsonb)
    INTO v_items
    FROM public.organization_members AS member
    LEFT JOIN public.users AS profile ON profile.uid = member.user_id
    WHERE member.organization_id = v_org;
  ELSIF p_section = 'convites' AND v_org IS NOT NULL AND (v_context->'permissions') ? 'invite.agent' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', invitation.id,
      'title', invitation.email,
      'subtitle', invitation.role,
      'status', invitation.status
    ) ORDER BY invitation.created_at DESC), '[]'::jsonb)
    INTO v_items
    FROM public.organization_invites AS invitation
    WHERE invitation.organization_id = v_org
      AND (
        v_context->>'role' = 'coordinator'
        OR (v_context->>'role' = 'supervisor' AND invitation.role = 'agent')
      );
  ELSIF p_section = 'consumo' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', counter.id,
      'title', counter.resource_code,
      'subtitle', counter.consumed::text || ' de ' || COALESCE(v_context->'limits'->>counter.resource_code, 'ilimitado'),
      'status', 'current'
    ) ORDER BY counter.resource_code), '[]'::jsonb)
    INTO v_items
    FROM public.usage_counters AS counter
    WHERE (
      (v_org IS NULL AND counter.user_id = v_user)
      OR (v_org IS NOT NULL AND counter.organization_id = v_org)
    );
  ELSIF p_section = 'assinatura' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', subscription.id,
      'title', plan.name,
      'subtitle', subscription.status,
      'status', subscription.status,
      'period_end', subscription.current_period_end,
      'cancel_at_period_end', subscription.cancel_at_period_end
    )), '[]'::jsonb)
    INTO v_items
    FROM public.subscriptions AS subscription
    JOIN public.plans AS plan ON plan.id = subscription.plan_id
    WHERE (
      (v_org IS NULL AND subscription.user_id = v_user)
      OR (v_org IS NOT NULL AND subscription.organization_id = v_org)
    );
  ELSIF p_section = 'suporte' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', ticket.id,
      'title', ticket.subject,
      'subtitle', ticket.public_code,
      'status', ticket.status
    ) ORDER BY ticket.created_at DESC), '[]'::jsonb)
    INTO v_items
    FROM public.support_tickets AS ticket
    WHERE (
      (v_org IS NULL AND ticket.user_id = v_user)
      OR (
        v_org IS NOT NULL
        AND ticket.organization_id = v_org
        AND (v_context->>'role' = 'coordinator' OR ticket.requester_id = v_user)
      )
    );
  ELSIF p_section = 'perfil' THEN
    SELECT jsonb_build_array(jsonb_build_object(
      'id', profile.uid,
      'title', COALESCE(profile.name, profile.email, 'Cliente TCS'),
      'subtitle', profile.email,
      'status', 'active'
    )) INTO v_items
    FROM public.users AS profile WHERE profile.uid = v_user;
  ELSIF p_section = 'configuracoes' AND v_org IS NOT NULL THEN
    SELECT jsonb_build_array(jsonb_build_object(
      'id', organization.id,
      'title', organization.display_name,
      'subtitle', COALESCE(organization.municipality_name, organization.state_code),
      'status', organization.status,
      'display_name', organization.display_name,
      'contact_name', organization.contact_name,
      'contact_email', organization.contact_email,
      'session_timeout_minutes', organization.session_timeout_minutes
    )) INTO v_items
    FROM public.organizations AS organization WHERE organization.id = v_org;
  END IF;

  IF p_section = 'relatorios' THEN
    v_summary := jsonb_build_object(
      'inspections', COALESCE((SELECT count(*) FROM public.vistorias AS inspection
        WHERE (v_org IS NULL AND inspection.organization_id IS NULL AND inspection."agenteUid"::text = v_user::text)
           OR (v_org IS NOT NULL AND inspection.organization_id = v_org AND private.portal_agent_allowed(v_org, inspection."agenteUid"::text, v_user))), 0),
      'generated_at', now()
    );
  END IF;
  RETURN jsonb_build_object('section', p_section, 'items', v_items, 'summary', v_summary);
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_create_appointment(
  p_inspection_id uuid,
  p_title text,
  p_scheduled_at timestamptz,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_context jsonb;
  v_org uuid;
  v_inspection public.vistorias;
  v_agent uuid;
  v_municipality text;
  v_appointment public.agendamentos;
BEGIN
  v_context := public.get_portal_access_context();
  IF v_context IS NULL
     OR NOT (v_context->'permissions') ? 'appointment.read'
     OR NOT COALESCE((v_context->>'creation_allowed')::boolean, false) THEN
    RAISE EXCEPTION 'appointment_create_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF char_length(trim(p_title)) NOT BETWEEN 3 AND 150 OR p_scheduled_at <= now() THEN
    RAISE EXCEPTION 'invalid_appointment';
  END IF;
  v_org := NULLIF(v_context->>'organization_id', '')::uuid;
  IF p_inspection_id IS NOT NULL THEN
    SELECT * INTO v_inspection FROM public.vistorias AS inspection
    WHERE inspection.id = p_inspection_id
      AND (
        (v_org IS NULL AND inspection.organization_id IS NULL AND inspection."agenteUid"::text = v_user::text)
        OR (
          v_org IS NOT NULL
          AND inspection.organization_id = v_org
          AND private.portal_agent_allowed(v_org, inspection."agenteUid"::text, v_user)
        )
      );
    IF v_inspection.id IS NULL THEN
      RAISE EXCEPTION 'inspection_not_found' USING ERRCODE = 'P0002';
    END IF;
    BEGIN v_agent := v_inspection."agenteUid"::uuid;
    EXCEPTION WHEN invalid_text_representation THEN v_agent := v_user; END;
  ELSE
    v_agent := v_user;
  END IF;
  v_municipality := CASE
    WHEN v_org IS NOT NULL THEN (SELECT COALESCE(municipality_name, display_name) FROM public.organizations WHERE id = v_org)
    ELSE (SELECT COALESCE(municipio, 'Não informado') FROM public.users WHERE uid = v_user)
  END;
  INSERT INTO public.agendamentos(
    inspection_id, organization_id, agente_uid, agente_nome, criado_por_uid,
    criado_por_nome, data_agendada, municipio, titulo, observacoes, status
  ) VALUES (
    p_inspection_id, v_org, v_agent,
    COALESCE(v_inspection."agenteNome", v_context->>'display_name'),
    v_user, v_context->>'display_name', p_scheduled_at,
    COALESCE(v_municipality, 'Não informado'), trim(p_title), NULLIF(trim(p_notes), ''), 'agendado'
  )
  RETURNING * INTO v_appointment;
  INSERT INTO public.subscription_audit_events(
    organization_id, actor_id, event_type, entity_type, entity_id, metadata
  ) VALUES (
    v_org, v_user, 'portal_appointment_created', 'appointment', v_appointment.id::text,
    jsonb_build_object('inspection_id', p_inspection_id)
  );
  RETURN jsonb_build_object('created', true, 'appointment_id', v_appointment.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_get_inspection(p_inspection_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_context jsonb;
  v_org uuid;
  v_inspection public.vistorias;
BEGIN
  v_context := public.get_portal_access_context();
  IF v_context IS NULL OR NOT (v_context->'permissions') ? 'inspection.read' THEN
    RAISE EXCEPTION 'inspection_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  v_org := NULLIF(v_context->>'organization_id', '')::uuid;
  SELECT * INTO v_inspection
  FROM public.vistorias AS inspection
  WHERE inspection.id = p_inspection_id
    AND (
      (v_org IS NULL AND inspection.organization_id IS NULL AND inspection."agenteUid"::text = v_user::text)
      OR (
        v_org IS NOT NULL
        AND inspection.organization_id = v_org
        AND private.portal_agent_allowed(v_org, inspection."agenteUid"::text, v_user)
      )
    );
  IF v_inspection.id IS NULL THEN
    RAISE EXCEPTION 'inspection_not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object(
    'id', v_inspection.id,
    'protocol', COALESCE(v_inspection.protocolo, v_inspection.id::text),
    'status', v_inspection.status,
    'risk_level', v_inspection."nivelRisco",
    'score', v_inspection."pontuacaoTotal",
    'occurred_at', COALESCE(v_inspection."dataVistoria", v_inspection."criadoEm"),
    'address', COALESCE(v_inspection.endereco, concat_ws(' ', v_inspection."enderecoRua", v_inspection."enderecoNumero")),
    'municipality', v_inspection.municipio,
    'agent_name', v_inspection."agenteNome",
    'latitude', v_inspection.latitude,
    'longitude', v_inspection.longitude,
    'document_available', v_inspection.laudo_gerado_em IS NOT NULL AND v_inspection.laudo_url IS NOT NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_list_own_sessions()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', session.id,
    'device_name', COALESCE(session.device_name, 'Dispositivo'),
    'platform', session.platform,
    'status', session.status,
    'started_at', session.started_at,
    'last_heartbeat_at', session.last_heartbeat_at
  ) ORDER BY session.last_heartbeat_at DESC), '[]'::jsonb)
  FROM public.active_sessions AS session
  WHERE session.user_id = auth.uid()
    AND session.status = 'active'
$$;

CREATE OR REPLACE FUNCTION public.portal_end_own_session(p_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_user uuid := auth.uid(); v_rows integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  UPDATE public.active_sessions
  SET status = 'revoked', ended_at = now(), ended_by = v_user, end_reason = 'portal_user_termination'
  WHERE id = p_session_id AND user_id = v_user AND status = 'active';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 1 THEN
    INSERT INTO public.subscription_audit_events(actor_id, event_type, entity_type, entity_id)
    VALUES (v_user, 'portal_session_ended', 'active_session', p_session_id::text);
  END IF;
  RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_authorize_inspection_document(p_inspection_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_context jsonb;
  v_org uuid;
  v_inspection public.vistorias;
  v_storage_path text;
BEGIN
  v_context := public.get_portal_access_context();
  IF v_context IS NULL OR NOT (v_context->'permissions') ? 'document.read' THEN
    RAISE EXCEPTION 'document_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  v_org := NULLIF(v_context->>'organization_id', '')::uuid;
  SELECT * INTO v_inspection
  FROM public.vistorias AS inspection
  WHERE inspection.id = p_inspection_id
    AND (
      (v_org IS NULL AND inspection.organization_id IS NULL AND inspection."agenteUid"::text = v_user::text)
      OR (
        v_org IS NOT NULL
        AND inspection.organization_id = v_org
        AND private.portal_agent_allowed(v_org, inspection."agenteUid"::text, v_user)
      )
    );
  IF v_inspection.id IS NULL
     OR v_inspection.laudo_gerado_em IS NULL
     OR v_inspection.laudo_url IS NULL THEN
    RAISE EXCEPTION 'document_not_found' USING ERRCODE = 'P0002';
  END IF;
  v_storage_path := CASE
    WHEN v_inspection.laudo_url LIKE 'laudos:%'
      THEN substring(v_inspection.laudo_url FROM char_length('laudos:') + 1)
    ELSE substring(v_inspection.laudo_url FROM '/object/(?:sign|authenticated|public)/laudos/([^?]+)')
  END;
  v_storage_path := COALESCE(
    NULLIF(v_storage_path, ''),
    concat_ws(
      '/',
      COALESCE(NULLIF(v_inspection.municipio, ''), NULLIF(v_inspection.municipio_agente, ''), 'geral'),
      v_inspection.id || '.pdf'
    )
  );
  IF v_storage_path = ''
     OR v_storage_path LIKE '/%'
     OR string_to_array(v_storage_path, '/') @> ARRAY['..']
     OR NOT EXISTS (
       SELECT 1 FROM storage.objects WHERE bucket_id = 'laudos' AND name = v_storage_path
     ) THEN
    RAISE EXCEPTION 'document_file_missing' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.subscription_audit_events(
    organization_id, actor_id, event_type, entity_type, entity_id, metadata
  ) VALUES (
    v_org, v_user, 'portal_document_authorized', 'inspection_document',
    v_inspection.id::text, jsonb_build_object('expires_in_seconds', 60)
  );
  RETURN jsonb_build_object(
    'bucket', 'laudos',
    'path', v_storage_path,
    'expires_in', 60,
    'filename', COALESCE(v_inspection.protocolo, v_inspection.id::text) || '.pdf'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_get_invite_preview(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_invite public.organization_invites; v_organization public.organizations; v_local text; v_domain text;
BEGIN
  SELECT * INTO v_invite
  FROM public.organization_invites
  WHERE token_hash = encode(extensions.digest(upper(trim(p_token)), 'sha256'), 'hex');
  IF v_invite.id IS NULL THEN RETURN NULL; END IF;
  IF v_invite.status = 'pending' AND v_invite.expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;
  SELECT * INTO v_organization FROM public.organizations WHERE id = v_invite.organization_id;
  v_local := split_part(v_invite.email, '@', 1);
  v_domain := split_part(v_invite.email, '@', 2);
  RETURN jsonb_build_object(
    'organization_name', v_organization.display_name,
    'email_hint', left(v_local, 2) || repeat('*', greatest(length(v_local) - 2, 1)) || '@' || v_domain,
    'role', v_invite.role,
    'expires_at', v_invite.expires_at,
    'status', v_invite.status
  );
END;
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
  v_invitation_limit bigint;
  v_invitation_usage bigint;
  v_usage_result jsonb;
  v_token text;
  v_id uuid;
BEGIN
  IF v_org IS NULL OR v_actor_role NOT IN ('owner', 'coordinator', 'supervisor') THEN
    RAISE EXCEPTION 'invite_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('coordinator', 'supervisor', 'agent')
     OR (v_actor_role = 'supervisor' AND p_role <> 'agent') THEN
    RAISE EXCEPTION 'role_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR char_length(v_email) > 320 THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.portal_rollout_settings
    WHERE singleton AND foundation_enabled
      AND CASE
        WHEN v_actor_role = 'supervisor' THEN municipal_supervisor_enabled
        ELSE municipal_coordinator_enabled
      END
  ) THEN RAISE EXCEPTION 'portal_rollout_disabled' USING ERRCODE = '42501'; END IF;
  SELECT subscription.* INTO v_subscription
  FROM public.subscriptions AS subscription
  JOIN public.plans AS plan ON plan.id = subscription.plan_id
  WHERE subscription.organization_id = v_org
    AND subscription.status IN ('trial', 'active', 'grace')
    AND plan.audience = 'organization'
  ORDER BY subscription.created_at DESC LIMIT 1
  FOR UPDATE OF subscription;
  IF v_subscription.id IS NULL THEN RETURN jsonb_build_object('allowed', false, 'reason', 'subscription_inactive'); END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_org::text, 1));
  SELECT hard_limit INTO v_limit
  FROM public.plan_version_limits
  WHERE plan_version_id = v_subscription.plan_version_id AND resource_code = 'users';
  IF v_limit IS NULL THEN
    SELECT hard_limit INTO v_limit FROM public.plan_limits
    WHERE plan_id = v_subscription.plan_id AND resource_code = 'users';
  END IF;
  SELECT
    (SELECT count(*) FROM public.organization_members
      WHERE organization_id = v_org AND status IN ('active', 'invited'))
    + (SELECT count(*) FROM public.organization_invites
      WHERE organization_id = v_org
        AND status = 'pending'
        AND expires_at > now()
        AND lower(email) <> v_email)
  INTO v_members;
  IF v_limit IS NOT NULL AND v_members >= v_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'limit_reached', 'consumed', v_members, 'limit', v_limit);
  END IF;
  SELECT hard_limit INTO v_invitation_limit
  FROM public.plan_version_limits
  WHERE plan_version_id = v_subscription.plan_version_id AND resource_code = 'invitations';
  IF v_invitation_limit IS NULL THEN
    SELECT hard_limit INTO v_invitation_limit FROM public.plan_limits
    WHERE plan_id = v_subscription.plan_id AND resource_code = 'invitations';
  END IF;
  SELECT COALESCE(consumed, 0) INTO v_invitation_usage
  FROM public.usage_counters
  WHERE organization_id = v_org
    AND resource_code = 'invitations'
    AND period_start = v_subscription.current_period_start;
  IF v_invitation_limit IS NOT NULL AND COALESCE(v_invitation_usage, 0) >= v_invitation_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invitation_limit_reached');
  END IF;

  UPDATE public.organization_invites
  SET status = 'revoked'
  WHERE organization_id = v_org AND lower(email) = v_email AND status = 'pending';
  v_token := upper(encode(extensions.gen_random_bytes(24), 'hex'));
  INSERT INTO public.organization_invites(organization_id, token_hash, email, role, expires_at, created_by)
  VALUES (
    v_org,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_email,
    p_role,
    now() + make_interval(hours => greatest(1, least(p_expires_in_hours, 720))),
    v_user
  )
  RETURNING id INTO v_id;
  v_usage_result := public.consume_subscription_usage('invitations', 1);
  INSERT INTO public.subscription_audit_events(organization_id, actor_id, event_type, entity_type, entity_id, metadata)
  VALUES (v_org, v_user, 'portal_invite_created', 'organization_invite', v_id::text, jsonb_build_object('role', p_role));
  RETURN jsonb_build_object('allowed', true, 'invite_id', v_id, 'delivery_token', v_token);
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_accept_organization_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_auth_email text;
  v_confirmed timestamptz;
  v_auth_name text;
  v_username text;
  v_invite public.organization_invites;
  v_subscription public.subscriptions;
  v_limit bigint;
  v_members bigint;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.internal_staff WHERE user_id = v_user AND status = 'active') THEN
    RAISE EXCEPTION 'customer_identity_required' USING ERRCODE = '42501';
  END IF;
  SELECT
    lower(email),
    email_confirmed_at,
    COALESCE(NULLIF(trim(raw_user_meta_data->>'name'), ''), NULLIF(trim(raw_user_meta_data->>'full_name'), ''), split_part(email, '@', 1))
  INTO v_auth_email, v_confirmed, v_auth_name
  FROM auth.users WHERE id = v_user;
  IF v_confirmed IS NULL THEN RAISE EXCEPTION 'verified_email_required' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_invite
  FROM public.organization_invites
  WHERE token_hash = encode(extensions.digest(upper(trim(p_token)), 'sha256'), 'hex')
  FOR UPDATE;
  IF v_invite.id IS NULL THEN RETURN jsonb_build_object('accepted', false, 'reason', 'invalid'); END IF;
  IF v_invite.status <> 'pending' THEN RETURN jsonb_build_object('accepted', false, 'reason', 'already_used'); END IF;
  IF v_invite.expires_at <= now() THEN
    UPDATE public.organization_invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('accepted', false, 'reason', 'expired');
  END IF;
  IF lower(v_invite.email) <> v_auth_email THEN
    RAISE EXCEPTION 'email_mismatch' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = v_user AND status IN ('invited', 'active', 'suspended')
  ) THEN RETURN jsonb_build_object('accepted', false, 'reason', 'membership_conflict'); END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_invite.organization_id::text, 1));
  SELECT subscription.* INTO v_subscription
  FROM public.subscriptions AS subscription
  JOIN public.plans AS plan ON plan.id = subscription.plan_id
  WHERE subscription.organization_id = v_invite.organization_id
    AND subscription.status IN ('trial', 'active', 'grace')
    AND plan.audience = 'organization'
  ORDER BY subscription.created_at DESC LIMIT 1 FOR UPDATE OF subscription;
  IF v_subscription.id IS NULL THEN RETURN jsonb_build_object('accepted', false, 'reason', 'subscription_inactive'); END IF;
  SELECT hard_limit INTO v_limit FROM public.plan_version_limits
  WHERE plan_version_id = v_subscription.plan_version_id AND resource_code = 'users';
  IF v_limit IS NULL THEN SELECT hard_limit INTO v_limit FROM public.plan_limits WHERE plan_id = v_subscription.plan_id AND resource_code = 'users'; END IF;
  SELECT count(*) INTO v_members FROM public.organization_members
  WHERE organization_id = v_invite.organization_id AND status IN ('active', 'invited');
  IF v_limit IS NOT NULL AND v_members >= v_limit THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'limit_reached');
  END IF;

  v_username := left(
    COALESCE(NULLIF(regexp_replace(lower(split_part(v_auth_email, '@', 1)), '[^a-z0-9_.-]', '', 'g'), ''), 'cliente'),
    30
  ) || '-' || left(replace(v_user::text, '-', ''), 8);
  INSERT INTO public.users(uid, email, name, username, role, "isApproved", organization_id)
  VALUES (v_user, v_auth_email, left(v_auth_name, 150), v_username, 'agent', true, NULL)
  ON CONFLICT (uid) DO NOTHING;
  INSERT INTO public.organization_members(organization_id, user_id, role, status, joined_at)
  VALUES (v_invite.organization_id, v_user, v_invite.role, 'active', now());
  UPDATE public.users SET organization_id = v_invite.organization_id WHERE uid = v_user;
  UPDATE public.organization_invites
  SET status = 'accepted', accepted_by = v_user, accepted_at = now()
  WHERE id = v_invite.id AND status = 'pending';
  INSERT INTO public.subscription_audit_events(organization_id, actor_id, event_type, entity_type, entity_id)
  VALUES (v_invite.organization_id, v_user, 'portal_invite_accepted', 'organization_invite', v_invite.id::text);
  RETURN jsonb_build_object('accepted', true, 'organization_id', v_invite.organization_id, 'role', v_invite.role);
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_revoke_organization_invite(p_invite_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_user uuid := auth.uid(); v_org uuid := private.current_organization_id(v_user); v_role text := private.organization_role(v_org, v_user); v_rows integer;
BEGIN
  IF v_role NOT IN ('owner', 'coordinator') THEN
    RAISE EXCEPTION 'invite_revoke_not_allowed' USING ERRCODE = '42501';
  END IF;
  UPDATE public.organization_invites SET status = 'revoked'
  WHERE id = p_invite_id AND organization_id = v_org AND status = 'pending';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 1 THEN
    INSERT INTO public.subscription_audit_events(organization_id, actor_id, event_type, entity_type, entity_id)
    VALUES (v_org, v_user, 'portal_invite_revoked', 'organization_invite', p_invite_id::text);
  END IF;
  RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_create_checkout(
  p_plan_code text,
  p_periodicity text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid := private.current_organization_id(v_user);
  v_role text := private.organization_role(v_org, v_user);
  v_plan public.plans;
  v_version public.plan_versions;
  v_amount bigint;
  v_checkout public.portal_checkout_sessions;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.internal_staff WHERE user_id = v_user AND status = 'active') THEN
    RAISE EXCEPTION 'customer_identity_required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.portal_rollout_settings
    WHERE singleton AND foundation_enabled AND billing_enabled
  ) THEN RAISE EXCEPTION 'billing_rollout_disabled' USING ERRCODE = '42501'; END IF;
  IF p_periodicity NOT IN ('monthly', 'annual') THEN RAISE EXCEPTION 'invalid_periodicity'; END IF;
  IF v_org IS NOT NULL AND v_role NOT IN ('owner', 'coordinator') THEN
    RAISE EXCEPTION 'billing_not_allowed' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_plan FROM public.plans
  WHERE code = p_plan_code
    AND status = 'active'
    AND audience = CASE WHEN v_org IS NULL THEN 'individual' ELSE 'organization' END;
  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'plan_not_found'; END IF;
  SELECT * INTO v_version FROM public.plan_versions WHERE plan_id = v_plan.id AND version = v_plan.current_version;
  IF v_version.id IS NULL THEN RAISE EXCEPTION 'plan_version_not_found'; END IF;
  v_amount := (v_version.configuration->'commercial'->>(CASE WHEN p_periodicity = 'annual' THEN 'annual_price_cents' ELSE 'monthly_price_cents' END))::bigint;
  IF v_amount IS NULL OR v_amount < 0 THEN RAISE EXCEPTION 'plan_price_missing'; END IF;

  INSERT INTO public.portal_checkout_sessions(
    requester_id, user_id, organization_id, plan_id, plan_version_id,
    periodicity, amount_cents, currency, idempotency_key
  ) VALUES (
    v_user, CASE WHEN v_org IS NULL THEN v_user END, v_org, v_plan.id, v_version.id,
    p_periodicity, v_amount, COALESCE(v_version.configuration->'commercial'->>'currency', 'BRL'), p_idempotency_key
  )
  ON CONFLICT (requester_id, idempotency_key) DO UPDATE SET updated_at = now()
  RETURNING * INTO v_checkout;
  RETURN jsonb_build_object(
    'checkout_id', v_checkout.id,
    'status', v_checkout.status,
    'amount_cents', v_checkout.amount_cents,
    'currency', v_checkout.currency,
    'plan_version_id', v_checkout.plan_version_id,
    'checkout_url', v_checkout.checkout_url,
    'provider_configuration_required', v_checkout.checkout_url IS NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_get_checkout_status(p_checkout_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'status', checkout.status,
    'plan_version_id', checkout.plan_version_id,
    'completed_at', checkout.completed_at
  )
  FROM public.portal_checkout_sessions AS checkout
  WHERE checkout.id = p_checkout_id
    AND checkout.requester_id = auth.uid()
    AND (
      checkout.user_id = auth.uid()
      OR checkout.organization_id = private.current_organization_id(auth.uid())
    )
$$;

CREATE OR REPLACE FUNCTION public.portal_process_payment_event(
  p_provider text,
  p_provider_event_id text,
  p_provider_event_time timestamptz,
  p_event_type text,
  p_payload_hash text,
  p_provider_session_id text,
  p_subscription_status text,
  p_provider_subscription_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_event_id bigint; v_checkout public.portal_checkout_sessions; v_subscription public.subscriptions;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501'; END IF;
  IF p_subscription_status NOT IN ('trial', 'active', 'grace', 'past_due', 'canceled', 'expired') THEN RAISE EXCEPTION 'invalid_subscription_status'; END IF;
  INSERT INTO public.portal_payment_events(provider, provider_event_id, provider_event_time, event_type, payload_hash)
  VALUES (p_provider, p_provider_event_id, p_provider_event_time, p_event_type, p_payload_hash)
  ON CONFLICT (provider, provider_event_id) DO UPDATE
  SET status = 'processing',
      error_code = NULL,
      received_at = now()
  WHERE public.portal_payment_events.status = 'failed'
  RETURNING id INTO v_event_id;
  IF v_event_id IS NULL THEN RETURN jsonb_build_object('processed', true, 'duplicate', true); END IF;

  BEGIN
  SELECT * INTO v_checkout
  FROM public.portal_checkout_sessions
  WHERE provider = p_provider AND provider_session_id = p_provider_session_id
  FOR UPDATE;
  IF v_checkout.id IS NULL THEN
    UPDATE public.portal_payment_events SET status = 'failed', error_code = 'checkout_not_found', processed_at = now() WHERE id = v_event_id;
    RETURN jsonb_build_object('processed', false, 'reason', 'checkout_not_found');
  END IF;
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE (v_checkout.user_id IS NOT NULL AND user_id = v_checkout.user_id)
     OR (v_checkout.organization_id IS NOT NULL AND organization_id = v_checkout.organization_id)
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF v_subscription.id IS NOT NULL
     AND v_subscription.provider_event_time IS NOT NULL
     AND v_subscription.provider_event_time > p_provider_event_time THEN
    UPDATE public.portal_payment_events SET status = 'ignored', error_code = 'out_of_order', processed_at = now() WHERE id = v_event_id;
    RETURN jsonb_build_object('processed', true, 'ignored', true, 'reason', 'out_of_order');
  END IF;

  INSERT INTO public.subscriptions(
    plan_id, plan_version_id, user_id, organization_id, status, provider,
    provider_subscription_id, provider_event_time, current_period_start
  ) VALUES (
    v_checkout.plan_id, v_checkout.plan_version_id, v_checkout.user_id, v_checkout.organization_id,
    p_subscription_status, p_provider, p_provider_subscription_id, p_provider_event_time, now()
  )
  ON CONFLICT DO NOTHING;
  IF v_subscription.id IS NOT NULL THEN
    UPDATE public.subscriptions
    SET plan_id = v_checkout.plan_id,
        plan_version_id = v_checkout.plan_version_id,
        status = p_subscription_status,
        provider = p_provider,
        provider_subscription_id = COALESCE(p_provider_subscription_id, provider_subscription_id),
        provider_event_time = p_provider_event_time,
        updated_at = now()
    WHERE id = v_subscription.id;
  END IF;
  UPDATE public.portal_checkout_sessions
  SET status = CASE WHEN p_subscription_status IN ('trial', 'active', 'grace') THEN 'completed' ELSE 'failed' END,
      completed_at = CASE WHEN p_subscription_status IN ('trial', 'active', 'grace') THEN now() ELSE completed_at END,
      updated_at = now()
  WHERE id = v_checkout.id;
  UPDATE public.portal_payment_events SET status = 'processed', processed_at = now() WHERE id = v_event_id;
  RETURN jsonb_build_object('processed', true, 'checkout_id', v_checkout.id);
EXCEPTION WHEN OTHERS THEN
  UPDATE public.portal_payment_events
  SET status = 'failed', error_code = left(SQLSTATE || ':' || SQLERRM, 500), processed_at = now()
  WHERE id = v_event_id;
  RETURN jsonb_build_object('processed', false, 'reason', 'event_processing_failed');
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_update_organization_member(
  p_member_id uuid,
  p_role text,
  p_status text,
  p_reason text,
  p_confirmation text
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
  v_previous jsonb;
  v_active_coordinators bigint;
BEGIN
  IF v_actor IS NULL OR v_org IS NULL OR v_actor_role NOT IN ('owner', 'coordinator') THEN
    RAISE EXCEPTION 'team_manage_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF p_confirmation <> 'CONFIRMAR' OR char_length(trim(COALESCE(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'confirmation_and_reason_required' USING ERRCODE = '22023';
  END IF;
  IF p_role NOT IN ('coordinator', 'supervisor', 'agent')
     OR p_status NOT IN ('active', 'suspended', 'removed') THEN
    RAISE EXCEPTION 'invalid_member_change' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('portal-member:' || v_org::text, 0));
  SELECT * INTO v_member
  FROM public.organization_members
  WHERE id = p_member_id AND organization_id = v_org
  FOR UPDATE;
  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_member.user_id = v_actor THEN
    RAISE EXCEPTION 'self_member_change_not_allowed' USING ERRCODE = '42501';
  END IF;

  IF v_member.role IN ('owner', 'coordinator')
     AND (p_role <> 'coordinator' OR p_status <> 'active') THEN
    SELECT count(*) INTO v_active_coordinators
    FROM public.organization_members
    WHERE organization_id = v_org
      AND status = 'active'
      AND role IN ('owner', 'coordinator');
    IF v_active_coordinators <= 1 THEN
      RAISE EXCEPTION 'last_coordinator_required' USING ERRCODE = '23514';
    END IF;
  END IF;

  v_previous := jsonb_build_object('role', v_member.role, 'status', v_member.status);
  UPDATE public.organization_members
  SET role = p_role,
      status = p_status,
      joined_at = CASE WHEN p_status = 'active' THEN COALESCE(joined_at, now()) ELSE joined_at END,
      updated_at = now()
  WHERE id = v_member.id;

  IF p_status <> 'active' THEN
    UPDATE public.active_sessions
    SET status = 'revoked',
        ended_at = now(),
        ended_by = v_actor,
        end_reason = 'organization_membership_changed'
    WHERE user_id = v_member.user_id AND status = 'active';
  END IF;

  INSERT INTO public.subscription_audit_events(
    organization_id, actor_id, event_type, entity_type, entity_id, metadata
  ) VALUES (
    v_org,
    v_actor,
    'portal_organization_member_changed',
    'organization_member',
    v_member.id::text,
    jsonb_build_object(
      'previous', v_previous,
      'next', jsonb_build_object('role', p_role, 'status', p_status),
      'reason', trim(p_reason)
    )
  );
  RETURN jsonb_build_object('updated', true, 'member_id', v_member.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_update_organization_settings(
  p_display_name text,
  p_contact_name text,
  p_contact_email text,
  p_session_timeout_minutes integer,
  p_reason text,
  p_confirmation text
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
  v_organization public.organizations;
  v_previous jsonb;
  v_email text := lower(trim(COALESCE(p_contact_email, '')));
BEGIN
  IF v_actor IS NULL OR v_org IS NULL OR v_actor_role NOT IN ('owner', 'coordinator') THEN
    RAISE EXCEPTION 'settings_manage_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF p_confirmation <> 'CONFIRMAR' OR char_length(trim(COALESCE(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'confirmation_and_reason_required' USING ERRCODE = '22023';
  END IF;
  IF char_length(trim(COALESCE(p_display_name, ''))) NOT BETWEEN 3 AND 120
     OR p_session_timeout_minutes NOT BETWEEN 5 AND 43200
     OR (v_email <> '' AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN
    RAISE EXCEPTION 'invalid_organization_settings' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('portal-settings:' || v_org::text, 0));
  SELECT * INTO v_organization
  FROM public.organizations
  WHERE id = v_org
  FOR UPDATE;
  IF v_organization.id IS NULL THEN
    RAISE EXCEPTION 'organization_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_previous := jsonb_build_object(
    'display_name', v_organization.display_name,
    'contact_name', v_organization.contact_name,
    'contact_email', v_organization.contact_email,
    'session_timeout_minutes', v_organization.session_timeout_minutes
  );
  UPDATE public.organizations
  SET display_name = trim(p_display_name),
      contact_name = NULLIF(trim(COALESCE(p_contact_name, '')), ''),
      contact_email = NULLIF(v_email, ''),
      session_timeout_minutes = p_session_timeout_minutes,
      updated_at = now()
  WHERE id = v_org;

  INSERT INTO public.subscription_audit_events(
    organization_id, actor_id, event_type, entity_type, entity_id, metadata
  ) VALUES (
    v_org,
    v_actor,
    'portal_organization_settings_changed',
    'organization',
    v_org::text,
    jsonb_build_object(
      'previous', v_previous,
      'next', jsonb_build_object(
        'display_name', trim(p_display_name),
        'contact_name', NULLIF(trim(COALESCE(p_contact_name, '')), ''),
        'contact_email', NULLIF(v_email, ''),
        'session_timeout_minutes', p_session_timeout_minutes
      ),
      'reason', trim(p_reason)
    )
  );
  RETURN jsonb_build_object('updated', true, 'organization_id', v_org);
END;
$$;

REVOKE ALL ON FUNCTION public.get_portal_access_context() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_ensure_individual_profile() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_get_dashboard() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_get_workspace(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_create_appointment(uuid, text, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_get_inspection(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_list_own_sessions() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_end_own_session(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_authorize_inspection_document(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_get_invite_preview(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.portal_create_organization_invite(text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_accept_organization_invite(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_revoke_organization_invite(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_create_checkout(text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_get_checkout_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_process_payment_event(text, text, timestamptz, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_update_organization_member(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_update_organization_settings(text, text, text, integer, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_portal_access_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_ensure_individual_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_workspace(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_create_appointment(uuid, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_inspection(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_list_own_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_end_own_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_authorize_inspection_document(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_invite_preview(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_create_organization_invite(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_accept_organization_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_revoke_organization_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_create_checkout(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_checkout_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_process_payment_event(text, text, timestamptz, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.portal_update_organization_member(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_update_organization_settings(text, text, text, integer, text, text) TO authenticated;

COMMENT ON FUNCTION public.get_portal_access_context() IS
  'Canonical server-derived portal context. Client organization, role, plan and scope inputs are intentionally absent.';
COMMENT ON TABLE public.portal_payment_events IS
  'Idempotency ledger for signed provider webhooks. No client role receives table access.';
