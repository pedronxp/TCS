-- Subscription, municipal organization and support platform.
-- Commercial enforcement is deliberately disabled until product approval and pilot rollout.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE TABLE public.owner_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text NOT NULL,
  legal_name text,
  municipality_name text,
  state_code text CHECK (state_code IS NULL OR state_code ~ '^[A-Z]{2}$'),
  status text NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding', 'pilot', 'active', 'suspended', 'archived')),
  session_policy text NOT NULL DEFAULT 'block' CHECK (session_policy IN ('block', 'replace')),
  session_timeout_minutes integer NOT NULL DEFAULT 480 CHECK (session_timeout_minutes BETWEEN 5 AND 43200),
  offline_tolerance_minutes integer NOT NULL DEFAULT 1440 CHECK (offline_tolerance_minutes BETWEEN 0 AND 43200),
  contact_name text,
  contact_email text,
  contract_reference text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'coordinator', 'supervisor', 'agent')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended', 'removed')),
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE UNIQUE INDEX organization_members_one_active_org_per_user
  ON public.organization_members(user_id)
  WHERE status IN ('invited', 'active', 'suspended');
CREATE INDEX organization_members_org_status_idx ON public.organization_members(organization_id, status);

CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code = lower(code) AND code ~ '^[a-z0-9_]+$'),
  name text NOT NULL,
  audience text NOT NULL CHECK (audience IN ('individual', 'organization', 'compatibility')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
  current_version integer NOT NULL DEFAULT 1 CHECK (current_version > 0),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(configuration) = 'object'),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (plan_id, version)
);

CREATE TABLE public.features (
  code text PRIMARY KEY CHECK (code = lower(code) AND code ~ '^[a-z0-9_]+$'),
  name text NOT NULL,
  category text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.plan_features (
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_code text NOT NULL REFERENCES public.features(code) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(configuration) = 'object'),
  PRIMARY KEY (plan_id, feature_code)
);

CREATE TABLE public.plan_limits (
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  resource_code text NOT NULL CHECK (resource_code IN ('users', 'inspections', 'invitations', 'storage_bytes', 'sessions')),
  hard_limit bigint CHECK (hard_limit IS NULL OR hard_limit >= 0),
  warning_percent integer NOT NULL DEFAULT 80 CHECK (warning_percent BETWEEN 1 AND 100),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(configuration) = 'object'),
  PRIMARY KEY (plan_id, resource_code)
);

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('trial', 'active', 'grace', 'past_due', 'canceled', 'expired')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz,
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  grace_ends_at timestamptz,
  canceled_at timestamptz,
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(overrides) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((user_id IS NOT NULL)::integer + (organization_id IS NOT NULL)::integer = 1)
);
CREATE UNIQUE INDEX subscriptions_one_current_user ON public.subscriptions(user_id)
  WHERE user_id IS NOT NULL AND status IN ('trial', 'active', 'grace', 'past_due');
CREATE UNIQUE INDEX subscriptions_one_current_org ON public.subscriptions(organization_id)
  WHERE organization_id IS NOT NULL AND status IN ('trial', 'active', 'grace', 'past_due');

CREATE TABLE public.usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  resource_code text NOT NULL CHECK (resource_code IN ('users', 'inspections', 'invitations', 'storage_bytes', 'sessions')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  consumed bigint NOT NULL DEFAULT 0 CHECK (consumed >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end > period_start),
  CHECK ((user_id IS NOT NULL)::integer + (organization_id IS NOT NULL)::integer = 1)
);
CREATE UNIQUE INDEX usage_counters_user_period_key
  ON public.usage_counters(user_id, resource_code, period_start) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX usage_counters_org_period_key
  ON public.usage_counters(organization_id, resource_code, period_start) WHERE organization_id IS NOT NULL;

CREATE TABLE public.usage_events (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  resource_code text NOT NULL CHECK (resource_code IN ('users', 'inspections', 'invitations', 'storage_bytes', 'sessions')),
  operation_key text NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((user_id IS NOT NULL)::integer + (organization_id IS NOT NULL)::integer = 1),
  UNIQUE (resource_code, operation_key)
);
CREATE INDEX usage_events_org_created_idx ON public.usage_events(organization_id, created_at DESC);

CREATE TABLE public.active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_session_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  device_id text NOT NULL,
  device_name text,
  platform text NOT NULL CHECK (platform IN ('android', 'ios', 'web', 'unknown')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'expired', 'revoked', 'replaced')),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ended_by uuid REFERENCES auth.users(id),
  end_reason text,
  UNIQUE (auth_session_id)
);
CREATE UNIQUE INDEX active_sessions_one_per_user ON public.active_sessions(user_id) WHERE status = 'active';
CREATE INDEX active_sessions_org_status_idx ON public.active_sessions(organization_id, status);

CREATE TABLE public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  email text,
  role text NOT NULL CHECK (role IN ('coordinator', 'supervisor', 'agent')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_by uuid REFERENCES auth.users(id),
  accepted_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX organization_invites_org_status_idx ON public.organization_invites(organization_id, status);

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_code text NOT NULL UNIQUE DEFAULT ('TCS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  requester_id uuid NOT NULL REFERENCES auth.users(id),
  category text NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  assigned_to uuid REFERENCES auth.users(id),
  response_due_at timestamptz,
  resolution_due_at timestamptz,
  escalate_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR organization_id IS NOT NULL)
);
CREATE INDEX support_tickets_queue_idx ON public.support_tickets(status, priority, created_at);
CREATE INDEX support_tickets_org_idx ON public.support_tickets(organization_id, created_at DESC);

CREATE TABLE public.support_sla_policies (
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  priority text NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  response_minutes integer NOT NULL CHECK (response_minutes > 0),
  resolution_minutes integer CHECK (resolution_minutes IS NULL OR resolution_minutes > 0),
  escalation_minutes integer CHECK (escalation_minutes IS NULL OR escalation_minutes > 0),
  default_assignee uuid REFERENCES auth.users(id),
  PRIMARY KEY (plan_id, priority)
);

CREATE TABLE public.support_ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  event_type text NOT NULL,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.organization_onboarding (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  pilot_started_at timestamptz,
  coordinator_trained_at timestamptz,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_due_at timestamptz,
  review_completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.subscription_audit_events (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscription_audit_org_created_idx ON public.subscription_audit_events(organization_id, created_at DESC);

CREATE TABLE public.subscription_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  entitlement_enforcement_enabled boolean NOT NULL DEFAULT false,
  session_enforcement_enabled boolean NOT NULL DEFAULT false,
  default_warning_percent integer NOT NULL DEFAULT 80 CHECK (default_warning_percent BETWEEN 1 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
INSERT INTO public.subscription_settings(singleton) VALUES (true) ON CONFLICT DO NOTHING;

INSERT INTO public.features(code, name, category, description) VALUES
  ('inspection_standard', 'Vistoria padrão', 'inspection_model', 'Fluxos de vistoria já disponíveis no aplicativo'),
  ('inspection_arv', 'Vistoria de Árvores (ARV)', 'inspection_model', 'Formulário técnico para vistoria de árvores'),
  ('training_mode', 'Modo treinamento', 'module', 'Turmas e vistorias de treinamento'),
  ('reports_basic', 'Relatórios básicos', 'module', 'Laudos e exportações essenciais'),
  ('reports_advanced', 'Relatórios avançados', 'module', 'Relatórios e análises ampliadas'),
  ('reports_institutional', 'Relatórios institucionais', 'module', 'Relatórios personalizados para organizações'),
  ('indicators_essential', 'Indicadores essenciais', 'module', 'Indicadores e mapas essenciais'),
  ('indicators_complete', 'Indicadores completos', 'module', 'Indicadores e mapas completos'),
  ('indicators_custom', 'Indicadores customizados', 'module', 'Indicadores configurados para a organização'),
  ('municipal_coordination', 'Coordenação municipal', 'module', 'Agentes, convites e sessões da organização')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description;

INSERT INTO public.plans(code, name, audience, status, description) VALUES
  ('compatibility', 'Compatibilidade', 'compatibility', 'active', 'Fluxo legado durante migração; não comercializável'),
  ('individual_basic', 'Individual Básico', 'individual', 'draft', 'Proposta inicial do documento comercial; preço pendente de aprovação'),
  ('individual_professional', 'Individual Profissional', 'individual', 'draft', 'Proposta inicial do documento comercial; add-ons pendentes de aprovação'),
  ('municipal_basic', 'Municipal Básico', 'organization', 'draft', 'Proposta inicial para equipes de até 10 agentes'),
  ('municipal_professional', 'Municipal Profissional', 'organization', 'draft', 'Proposta inicial para equipes de até 30 agentes'),
  ('municipal_complete', 'Municipal Completo', 'organization', 'draft', 'Plano customizado; valores definidos por contrato')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.plan_versions(plan_id, version, configuration)
SELECT p.id, 1, jsonb_build_object(
  'commercial', jsonb_build_object(
    'monthly_price_cents', NULL,
    'annual_price_cents', NULL,
    'currency', 'BRL',
    'trial_days', 0,
    'grace_days', 0,
    'overage_policy', 'block',
    'support_tier', CASE
      WHEN p.code IN ('individual_professional', 'municipal_professional') THEN 'priority'
      WHEN p.code = 'municipal_complete' THEN 'specialized'
      ELSE 'standard'
    END,
    'support_channels', jsonb_build_array('E-mail'),
    'support_hours', 'Dias úteis, horário comercial'
  )
)
FROM public.plans p
WHERE p.code <> 'compatibility'
ON CONFLICT (plan_id, version) DO NOTHING;

INSERT INTO public.plan_features(plan_id, feature_code, enabled)
SELECT p.id, f.feature_code, true
FROM public.plans p
JOIN (VALUES
  ('individual_basic', 'inspection_standard'), ('individual_basic', 'reports_basic'),
  ('individual_professional', 'inspection_standard'), ('individual_professional', 'reports_advanced'),
  ('municipal_basic', 'inspection_standard'), ('municipal_basic', 'reports_basic'), ('municipal_basic', 'indicators_essential'), ('municipal_basic', 'municipal_coordination'),
  ('municipal_professional', 'inspection_standard'), ('municipal_professional', 'reports_advanced'), ('municipal_professional', 'indicators_complete'), ('municipal_professional', 'municipal_coordination'),
  ('municipal_complete', 'inspection_standard'), ('municipal_complete', 'inspection_arv'), ('municipal_complete', 'training_mode'), ('municipal_complete', 'reports_institutional'), ('municipal_complete', 'indicators_custom'), ('municipal_complete', 'municipal_coordination')
) AS f(plan_code, feature_code) ON f.plan_code = p.code
ON CONFLICT (plan_id, feature_code) DO UPDATE SET enabled = EXCLUDED.enabled;

INSERT INTO public.plan_limits(plan_id, resource_code, hard_limit, warning_percent)
SELECT p.id, l.resource_code, l.hard_limit, 80
FROM public.plans p
JOIN (VALUES
  ('individual_basic', 'users', 1::bigint), ('individual_basic', 'inspections', 30::bigint), ('individual_basic', 'invitations', 10::bigint), ('individual_basic', 'sessions', 1::bigint),
  ('individual_professional', 'users', 1::bigint), ('individual_professional', 'inspections', 150::bigint), ('individual_professional', 'invitations', 50::bigint), ('individual_professional', 'sessions', 1::bigint),
  ('municipal_basic', 'users', 10::bigint), ('municipal_basic', 'inspections', 300::bigint), ('municipal_basic', 'invitations', 50::bigint), ('municipal_basic', 'sessions', 1::bigint),
  ('municipal_professional', 'users', 30::bigint), ('municipal_professional', 'inspections', 1000::bigint), ('municipal_professional', 'invitations', 200::bigint), ('municipal_professional', 'sessions', 1::bigint),
  ('municipal_complete', 'users', NULL::bigint), ('municipal_complete', 'inspections', NULL::bigint), ('municipal_complete', 'invitations', NULL::bigint), ('municipal_complete', 'sessions', 1::bigint)
) AS l(plan_code, resource_code, hard_limit) ON l.plan_code = p.code
ON CONFLICT (plan_id, resource_code) DO UPDATE SET hard_limit = EXCLUDED.hard_limit, warning_percent = EXCLUDED.warning_percent;

-- Initial response targets from the commercial proposal. Values are editable by owners.
-- They are stored as elapsed minutes; support hours remain explicit in the version configuration.
INSERT INTO public.support_sla_policies(plan_id, priority, response_minutes)
SELECT p.id, 'normal', CASE
  WHEN p.code IN ('individual_professional', 'municipal_professional') THEN 1440
  ELSE 2880
END
FROM public.plans p
WHERE p.code IN ('individual_basic', 'individual_professional', 'municipal_basic', 'municipal_professional')
ON CONFLICT (plan_id, priority) DO NOTHING;

-- Existing master administrators become internal owners. This does not trust JWT user metadata.
INSERT INTO public.owner_admins(user_id)
SELECT uid FROM public.users WHERE role = 'master_admin'
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION private.is_owner_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.owner_admins oa WHERE oa.user_id = p_user_id AND oa.active
  );
$$;

CREATE OR REPLACE FUNCTION private.current_organization_id(p_user_id uuid DEFAULT auth.uid())
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT om.organization_id
  FROM public.organization_members om
  WHERE om.user_id = p_user_id AND om.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.organization_role(p_organization_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT om.role FROM public.organization_members om
  WHERE om.organization_id = p_organization_id AND om.user_id = p_user_id AND om.status = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_owner_admin(uuid), private.current_organization_id(uuid), private.organization_role(uuid, uuid) TO authenticated;

-- Link legacy rows without using the client-provided municipality as authorization.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.vistorias ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.invite_tokens ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
CREATE INDEX IF NOT EXISTS users_organization_idx ON public.users(organization_id);
CREATE INDEX IF NOT EXISTS vistorias_organization_idx ON public.vistorias(organization_id);
CREATE INDEX IF NOT EXISTS agendamentos_organization_idx ON public.agendamentos(organization_id);
CREATE INDEX IF NOT EXISTS invite_tokens_organization_idx ON public.invite_tokens(organization_id);

CREATE OR REPLACE FUNCTION private.can_access_legacy_municipality(p_municipality text, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.uid = p_user_id
      AND u.organization_id IS NULL
      AND u."isApproved" = true
      AND u.role IN ('admin','supervisor')
      AND u.municipio = p_municipality
  );
$$;
REVOKE ALL ON FUNCTION private.can_access_legacy_municipality(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_access_legacy_municipality(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.assign_request_organization()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
DECLARE v_org uuid;
BEGIN
  IF private.is_owner_admin() THEN RETURN NEW; END IF;
  v_org := private.current_organization_id();
  IF v_org IS NULL THEN
    IF NEW.organization_id IS NOT NULL THEN RAISE EXCEPTION 'organization_not_allowed' USING ERRCODE = '42501'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.organization_id IS NULL THEN NEW.organization_id := v_org;
  ELSIF NEW.organization_id <> v_org THEN RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.assign_request_organization() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.protect_user_authorization_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
BEGIN
  IF private.is_owner_admin() THEN RETURN NEW; END IF;
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
DROP TRIGGER IF EXISTS users_protect_authorization_fields ON public.users;
CREATE TRIGGER users_protect_authorization_fields BEFORE UPDATE OF role, municipio, organization_id, "isApproved" ON public.users
FOR EACH ROW EXECUTE FUNCTION private.protect_user_authorization_fields();

DROP TRIGGER IF EXISTS vistorias_assign_organization ON public.vistorias;
CREATE TRIGGER vistorias_assign_organization BEFORE INSERT OR UPDATE OF organization_id ON public.vistorias
FOR EACH ROW EXECUTE FUNCTION private.assign_request_organization();
DROP TRIGGER IF EXISTS agendamentos_assign_organization ON public.agendamentos;
CREATE TRIGGER agendamentos_assign_organization BEFORE INSERT OR UPDATE OF organization_id ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION private.assign_request_organization();
DROP TRIGGER IF EXISTS invite_tokens_assign_organization ON public.invite_tokens;
CREATE TRIGGER invite_tokens_assign_organization BEFORE INSERT OR UPDATE OF organization_id ON public.invite_tokens
FOR EACH ROW EXECUTE FUNCTION private.assign_request_organization();

-- New tables are explicitly exposed to authenticated clients; RLS remains the authorization boundary.
REVOKE ALL ON public.owner_admins, public.organizations, public.organization_members, public.plans,
  public.plan_versions, public.features, public.plan_features, public.plan_limits, public.subscriptions,
  public.usage_counters, public.usage_events, public.active_sessions, public.organization_invites, public.support_tickets,
  public.support_ticket_events, public.support_sla_policies, public.organization_onboarding, public.subscription_audit_events,
  public.subscription_settings FROM anon, authenticated;
GRANT SELECT ON public.owner_admins, public.organizations, public.organization_members, public.plans,
  public.plan_versions, public.features, public.plan_features, public.plan_limits, public.subscriptions,
  public.usage_counters, public.usage_events, public.active_sessions, public.organization_invites, public.support_tickets,
  public.support_ticket_events, public.support_sla_policies, public.organization_onboarding, public.subscription_audit_events,
  public.subscription_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.organizations, public.plans, public.plan_versions,
  public.features, public.plan_features, public.plan_limits, public.subscriptions,
  public.support_tickets, public.support_ticket_events, public.organization_onboarding,
  public.support_sla_policies,
  public.subscription_settings TO authenticated;

ALTER TABLE public.owner_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_admin_self_select ON public.owner_admins FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY organizations_member_select ON public.organizations FOR SELECT TO authenticated
  USING (id = (SELECT private.current_organization_id()) OR (SELECT private.is_owner_admin()));
CREATE POLICY organization_members_org_select ON public.organization_members FOR SELECT TO authenticated
  USING (organization_id = (SELECT private.current_organization_id()) OR (SELECT private.is_owner_admin()));
CREATE POLICY plans_authenticated_select ON public.plans FOR SELECT TO authenticated USING (status = 'active' OR (SELECT private.is_owner_admin()));
CREATE POLICY plan_versions_authenticated_select ON public.plan_versions FOR SELECT TO authenticated USING (published_at IS NOT NULL OR (SELECT private.is_owner_admin()));
CREATE POLICY features_authenticated_select ON public.features FOR SELECT TO authenticated USING (active OR (SELECT private.is_owner_admin()));
CREATE POLICY plan_features_authenticated_select ON public.plan_features FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.plans p WHERE p.id = plan_id AND p.status = 'active') OR (SELECT private.is_owner_admin())
);
CREATE POLICY plan_limits_authenticated_select ON public.plan_limits FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.plans p WHERE p.id = plan_id AND p.status = 'active') OR (SELECT private.is_owner_admin())
);
CREATE POLICY subscriptions_subject_select ON public.subscriptions FOR SELECT TO authenticated USING (
  user_id = (SELECT auth.uid()) OR organization_id = (SELECT private.current_organization_id()) OR (SELECT private.is_owner_admin())
);
CREATE POLICY usage_subject_select ON public.usage_counters FOR SELECT TO authenticated USING (
  user_id = (SELECT auth.uid()) OR organization_id = (SELECT private.current_organization_id()) OR (SELECT private.is_owner_admin())
);
CREATE POLICY usage_events_subject_select ON public.usage_events FOR SELECT TO authenticated USING (
  user_id = (SELECT auth.uid()) OR organization_id = (SELECT private.current_organization_id()) OR (SELECT private.is_owner_admin())
);
CREATE POLICY sessions_org_select ON public.active_sessions FOR SELECT TO authenticated USING (
  user_id = (SELECT auth.uid())
  OR (organization_id = (SELECT private.current_organization_id()) AND (SELECT private.organization_role(organization_id)) IN ('owner','coordinator','supervisor'))
  OR (SELECT private.is_owner_admin())
);
CREATE POLICY invites_org_select ON public.organization_invites FOR SELECT TO authenticated USING (
  organization_id = (SELECT private.current_organization_id()) OR (SELECT private.is_owner_admin())
);
CREATE POLICY tickets_subject_select ON public.support_tickets FOR SELECT TO authenticated USING (
  requester_id = (SELECT auth.uid()) OR user_id = (SELECT auth.uid())
  OR organization_id = (SELECT private.current_organization_id()) OR (SELECT private.is_owner_admin())
);
CREATE POLICY ticket_events_subject_select ON public.support_ticket_events FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id)
);
CREATE POLICY support_sla_owner_select ON public.support_sla_policies FOR SELECT TO authenticated
  USING ((SELECT private.is_owner_admin()));
CREATE POLICY onboarding_org_select ON public.organization_onboarding FOR SELECT TO authenticated USING (
  organization_id = (SELECT private.current_organization_id()) OR (SELECT private.is_owner_admin())
);
CREATE POLICY audit_owner_or_org_admin_select ON public.subscription_audit_events FOR SELECT TO authenticated USING (
  (SELECT private.is_owner_admin()) OR (
    organization_id = (SELECT private.current_organization_id())
    AND (SELECT private.organization_role(organization_id)) IN ('owner','coordinator')
  )
);
CREATE POLICY settings_authenticated_select ON public.subscription_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY organizations_owner_write ON public.organizations FOR ALL TO authenticated
  USING ((SELECT private.is_owner_admin())) WITH CHECK ((SELECT private.is_owner_admin()));
CREATE POLICY plans_owner_write ON public.plans FOR ALL TO authenticated
  USING ((SELECT private.is_owner_admin())) WITH CHECK ((SELECT private.is_owner_admin()));
CREATE POLICY plan_versions_owner_write ON public.plan_versions FOR ALL TO authenticated
  USING ((SELECT private.is_owner_admin())) WITH CHECK ((SELECT private.is_owner_admin()));
CREATE POLICY features_owner_write ON public.features FOR ALL TO authenticated
  USING ((SELECT private.is_owner_admin())) WITH CHECK ((SELECT private.is_owner_admin()));
CREATE POLICY plan_features_owner_write ON public.plan_features FOR ALL TO authenticated
  USING ((SELECT private.is_owner_admin())) WITH CHECK ((SELECT private.is_owner_admin()));
CREATE POLICY plan_limits_owner_write ON public.plan_limits FOR ALL TO authenticated
  USING ((SELECT private.is_owner_admin())) WITH CHECK ((SELECT private.is_owner_admin()));
CREATE POLICY subscriptions_owner_write ON public.subscriptions FOR ALL TO authenticated
  USING ((SELECT private.is_owner_admin())) WITH CHECK ((SELECT private.is_owner_admin()));
CREATE POLICY tickets_owner_update ON public.support_tickets FOR UPDATE TO authenticated
  USING ((SELECT private.is_owner_admin())) WITH CHECK ((SELECT private.is_owner_admin()));
CREATE POLICY ticket_events_owner_write ON public.support_ticket_events FOR ALL TO authenticated
  USING ((SELECT private.is_owner_admin())) WITH CHECK ((SELECT private.is_owner_admin()));
CREATE POLICY support_sla_owner_write ON public.support_sla_policies FOR ALL TO authenticated
  USING ((SELECT private.is_owner_admin())) WITH CHECK ((SELECT private.is_owner_admin()));
CREATE POLICY onboarding_owner_write ON public.organization_onboarding FOR ALL TO authenticated
  USING ((SELECT private.is_owner_admin())) WITH CHECK ((SELECT private.is_owner_admin()));
CREATE POLICY settings_owner_update ON public.subscription_settings FOR UPDATE TO authenticated
  USING ((SELECT private.is_owner_admin())) WITH CHECK ((SELECT private.is_owner_admin()));

CREATE OR REPLACE FUNCTION private.audit_subscription_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
DECLARE v_new jsonb; v_old jsonb; v_org uuid; v_entity_id text;
BEGIN
  v_new := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  v_old := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_org := COALESCE(nullif(v_new->>'organization_id','')::uuid, nullif(v_old->>'organization_id','')::uuid);
  v_entity_id := COALESCE(v_new->>'id', v_old->>'id', v_new->>'code', v_old->>'code', TG_TABLE_NAME);
  INSERT INTO public.subscription_audit_events(organization_id, actor_id, event_type, entity_type, entity_id, metadata)
  VALUES (v_org, auth.uid(), lower(TG_OP), TG_TABLE_NAME, v_entity_id, jsonb_build_object('before', v_old, 'after', v_new));
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION private.audit_subscription_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER organizations_subscription_audit AFTER INSERT OR UPDATE OR DELETE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION private.audit_subscription_change();
CREATE TRIGGER plans_subscription_audit AFTER INSERT OR UPDATE OR DELETE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION private.audit_subscription_change();
CREATE TRIGGER plan_features_subscription_audit AFTER INSERT OR UPDATE OR DELETE ON public.plan_features
  FOR EACH ROW EXECUTE FUNCTION private.audit_subscription_change();
CREATE TRIGGER plan_limits_subscription_audit AFTER INSERT OR UPDATE OR DELETE ON public.plan_limits
  FOR EACH ROW EXECUTE FUNCTION private.audit_subscription_change();
CREATE TRIGGER subscriptions_subscription_audit AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION private.audit_subscription_change();
CREATE TRIGGER plan_versions_subscription_audit AFTER INSERT OR UPDATE OR DELETE ON public.plan_versions
  FOR EACH ROW EXECUTE FUNCTION private.audit_subscription_change();
CREATE TRIGGER support_sla_subscription_audit AFTER INSERT OR UPDATE OR DELETE ON public.support_sla_policies
  FOR EACH ROW EXECUTE FUNCTION private.audit_subscription_change();

CREATE OR REPLACE FUNCTION public.update_plan_commercial_configuration(
  p_plan_id uuid,
  p_plan jsonb,
  p_commercial jsonb,
  p_features jsonb,
  p_limits jsonb,
  p_sla jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_status text := p_plan->>'status';
  v_version integer;
  v_entry record;
BEGIN
  IF v_actor IS NULL OR NOT private.is_owner_admin(v_actor) THEN
    RAISE EXCEPTION 'owner_access_required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE id = p_plan_id AND audience <> 'compatibility') THEN
    RAISE EXCEPTION 'commercial_plan_not_found';
  END IF;
  IF COALESCE(jsonb_typeof(p_plan), '') <> 'object'
     OR COALESCE(jsonb_typeof(p_commercial), '') <> 'object'
     OR COALESCE(jsonb_typeof(p_features), '') <> 'object'
     OR COALESCE(jsonb_typeof(p_limits), '') <> 'object'
     OR COALESCE(jsonb_typeof(p_sla), '') <> 'object' THEN
    RAISE EXCEPTION 'invalid_commercial_payload';
  END IF;
  IF NULLIF(trim(p_plan->>'name'), '') IS NULL OR v_status NOT IN ('draft', 'active', 'retired') THEN
    RAISE EXCEPTION 'invalid_plan_details';
  END IF;
  IF COALESCE((p_commercial->>'trial_days')::integer, 0) NOT BETWEEN 0 AND 365
     OR COALESCE((p_commercial->>'grace_days')::integer, 0) NOT BETWEEN 0 AND 365
     OR COALESCE(p_commercial->>'currency', '') <> 'BRL'
     OR COALESCE(p_commercial->>'overage_policy', '') NOT IN ('block', 'manual_review', 'allow_and_bill', 'custom')
     OR COALESCE(p_commercial->>'support_tier', '') NOT IN ('standard', 'priority', 'specialized')
     OR COALESCE((p_commercial->>'monthly_price_cents')::bigint, 0) < 0
     OR COALESCE((p_commercial->>'annual_price_cents')::bigint, 0) < 0 THEN
    RAISE EXCEPTION 'invalid_commercial_rules';
  END IF;

  UPDATE public.plans
  SET name = left(trim(p_plan->>'name'), 120),
      description = left(NULLIF(trim(p_plan->>'description'), ''), 2000),
      status = v_status,
      current_version = current_version + 1,
      updated_at = now()
  WHERE id = p_plan_id
  RETURNING current_version INTO v_version;

  INSERT INTO public.plan_versions(plan_id, version, configuration, published_at, created_by)
  VALUES (
    p_plan_id,
    v_version,
    jsonb_build_object('commercial', p_commercial),
    CASE WHEN v_status = 'active' THEN now() ELSE NULL END,
    v_actor
  );

  DELETE FROM public.plan_features WHERE plan_id = p_plan_id;
  FOR v_entry IN SELECT key, value FROM jsonb_each_text(p_features) LOOP
    INSERT INTO public.plan_features(plan_id, feature_code, enabled)
    VALUES (p_plan_id, v_entry.key, v_entry.value::boolean);
  END LOOP;

  DELETE FROM public.plan_limits WHERE plan_id = p_plan_id;
  FOR v_entry IN SELECT key, value FROM jsonb_each(p_limits) LOOP
    IF v_entry.key NOT IN ('users', 'inspections', 'invitations', 'storage_bytes', 'sessions')
       OR COALESCE((v_entry.value->>'warning_percent')::integer, 80) NOT BETWEEN 1 AND 100
       OR COALESCE((v_entry.value->>'hard_limit')::bigint, 0) < 0 THEN
      RAISE EXCEPTION 'invalid_plan_limit';
    END IF;
    INSERT INTO public.plan_limits(plan_id, resource_code, hard_limit, warning_percent)
    VALUES (
      p_plan_id,
      v_entry.key,
      (v_entry.value->>'hard_limit')::bigint,
      COALESCE((v_entry.value->>'warning_percent')::integer, 80)
    );
  END LOOP;

  DELETE FROM public.support_sla_policies WHERE plan_id = p_plan_id;
  FOR v_entry IN SELECT key, value FROM jsonb_each(p_sla) LOOP
    IF v_entry.key NOT IN ('low', 'normal', 'high', 'critical')
       OR COALESCE((v_entry.value->>'response_minutes')::integer, 0) <= 0
       OR COALESCE((v_entry.value->>'resolution_minutes')::integer, 1) <= 0
       OR COALESCE((v_entry.value->>'escalation_minutes')::integer, 1) <= 0 THEN
      RAISE EXCEPTION 'invalid_support_sla';
    END IF;
    INSERT INTO public.support_sla_policies(plan_id, priority, response_minutes, resolution_minutes, escalation_minutes)
    VALUES (
      p_plan_id,
      v_entry.key,
      (v_entry.value->>'response_minutes')::integer,
      (v_entry.value->>'resolution_minutes')::integer,
      (v_entry.value->>'escalation_minutes')::integer
    );
  END LOOP;

  INSERT INTO public.subscription_audit_events(actor_id, event_type, entity_type, entity_id, metadata)
  VALUES (v_actor, 'commercial_plan_saved', 'plan', p_plan_id::text, jsonb_build_object('version', v_version, 'status', v_status));

  RETURN jsonb_build_object('saved', true, 'plan_id', p_plan_id, 'version', v_version);
END;
$$;
REVOKE ALL ON FUNCTION public.update_plan_commercial_configuration(uuid,jsonb,jsonb,jsonb,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_plan_commercial_configuration(uuid,jsonb,jsonb,jsonb,jsonb,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_subscription_context()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
DECLARE
  v_user uuid := auth.uid(); v_org uuid; v_subscription public.subscriptions; v_plan public.plans; v_version public.plan_versions; v_enforced boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  v_org := private.current_organization_id(v_user);
  SELECT entitlement_enforcement_enabled INTO v_enforced FROM public.subscription_settings WHERE singleton;
  SELECT * INTO v_subscription FROM public.subscriptions s
   WHERE (v_org IS NOT NULL AND s.organization_id = v_org) OR (v_org IS NULL AND s.user_id = v_user)
   ORDER BY CASE s.status WHEN 'active' THEN 1 WHEN 'trial' THEN 2 WHEN 'grace' THEN 3 WHEN 'past_due' THEN 4 ELSE 5 END, s.created_at DESC LIMIT 1;
  IF v_subscription.id IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.plans WHERE id = v_subscription.plan_id;
    SELECT * INTO v_version FROM public.plan_versions WHERE plan_id = v_plan.id AND version = v_plan.current_version;
  END IF;
  RETURN jsonb_build_object(
    'enforced', COALESCE(v_enforced, false),
    'organization', CASE WHEN v_org IS NULL THEN NULL ELSE (SELECT to_jsonb(o) FROM public.organizations o WHERE o.id = v_org) END,
    'membership', CASE WHEN v_org IS NULL THEN NULL ELSE (SELECT jsonb_build_object('role', om.role, 'status', om.status) FROM public.organization_members om WHERE om.user_id = v_user AND om.organization_id = v_org) END,
    'subscription', CASE WHEN v_subscription.id IS NULL THEN NULL ELSE jsonb_build_object('id', v_subscription.id, 'status', v_subscription.status, 'period_start', v_subscription.current_period_start, 'period_end', v_subscription.current_period_end, 'grace_ends_at', v_subscription.grace_ends_at) END,
    'plan', CASE WHEN v_plan.id IS NULL THEN NULL ELSE jsonb_build_object('id', v_plan.id, 'code', v_plan.code, 'name', v_plan.name, 'audience', v_plan.audience, 'version', v_plan.current_version, 'commercial', COALESCE(v_version.configuration->'commercial', '{}'::jsonb)) END,
    'features', COALESCE((SELECT jsonb_object_agg(pf.feature_code, pf.enabled) FROM public.plan_features pf WHERE pf.plan_id = v_plan.id), '{}'::jsonb),
    'usage', COALESCE((SELECT jsonb_agg(jsonb_build_object('resource', pl.resource_code, 'consumed', COALESCE(uc.consumed,0), 'limit', pl.hard_limit, 'warning_percent', pl.warning_percent))
      FROM public.plan_limits pl LEFT JOIN public.usage_counters uc ON uc.resource_code = pl.resource_code AND uc.period_start = v_subscription.current_period_start AND ((v_org IS NOT NULL AND uc.organization_id = v_org) OR (v_org IS NULL AND uc.user_id = v_user)) WHERE pl.plan_id = v_plan.id), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_subscription_feature(p_feature_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
DECLARE v_ctx jsonb;
BEGIN
  v_ctx := public.get_subscription_context();
  IF NOT COALESCE((v_ctx->>'enforced')::boolean, false) THEN RETURN true; END IF;
  RETURN COALESCE((v_ctx->'features'->>p_feature_code)::boolean, false)
    AND COALESCE(v_ctx->'subscription'->>'status', '') IN ('trial','active','grace');
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_subscription_usage(p_resource_code text, p_amount bigint DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
DECLARE
  v_user uuid := auth.uid(); v_org uuid; v_sub public.subscriptions; v_limit bigint; v_consumed bigint; v_warning integer; v_enforced boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'amount_must_be_positive'; END IF;
  v_org := private.current_organization_id(v_user);
  SELECT entitlement_enforcement_enabled INTO v_enforced FROM public.subscription_settings WHERE singleton;
  SELECT * INTO v_sub FROM public.subscriptions s WHERE (v_org IS NOT NULL AND s.organization_id = v_org) OR (v_org IS NULL AND s.user_id = v_user)
    ORDER BY s.created_at DESC LIMIT 1;
  IF v_sub.id IS NULL OR v_sub.status NOT IN ('trial','active','grace') THEN
    IF v_enforced THEN RETURN jsonb_build_object('allowed', false, 'reason', 'subscription_inactive'); END IF;
    RETURN jsonb_build_object('allowed', true, 'enforced', false);
  END IF;
  SELECT hard_limit, warning_percent INTO v_limit, v_warning FROM public.plan_limits WHERE plan_id = v_sub.plan_id AND resource_code = p_resource_code;
  IF v_org IS NOT NULL THEN
    INSERT INTO public.usage_counters(organization_id, resource_code, period_start, period_end, consumed)
    VALUES (v_org, p_resource_code, v_sub.current_period_start, COALESCE(v_sub.current_period_end, v_sub.current_period_start + interval '1 month'), 0)
    ON CONFLICT (organization_id, resource_code, period_start) WHERE organization_id IS NOT NULL DO NOTHING;
    SELECT consumed INTO v_consumed FROM public.usage_counters WHERE organization_id = v_org AND resource_code = p_resource_code AND period_start = v_sub.current_period_start FOR UPDATE;
    IF v_enforced AND v_limit IS NOT NULL AND v_consumed + p_amount > v_limit THEN RETURN jsonb_build_object('allowed', false, 'reason', 'limit_reached', 'consumed', v_consumed, 'limit', v_limit); END IF;
    UPDATE public.usage_counters SET consumed = consumed + p_amount, updated_at = now() WHERE organization_id = v_org AND resource_code = p_resource_code AND period_start = v_sub.current_period_start RETURNING consumed INTO v_consumed;
  ELSE
    INSERT INTO public.usage_counters(user_id, resource_code, period_start, period_end, consumed)
    VALUES (v_user, p_resource_code, v_sub.current_period_start, COALESCE(v_sub.current_period_end, v_sub.current_period_start + interval '1 month'), 0)
    ON CONFLICT (user_id, resource_code, period_start) WHERE user_id IS NOT NULL DO NOTHING;
    SELECT consumed INTO v_consumed FROM public.usage_counters WHERE user_id = v_user AND resource_code = p_resource_code AND period_start = v_sub.current_period_start FOR UPDATE;
    IF v_enforced AND v_limit IS NOT NULL AND v_consumed + p_amount > v_limit THEN RETURN jsonb_build_object('allowed', false, 'reason', 'limit_reached', 'consumed', v_consumed, 'limit', v_limit); END IF;
    UPDATE public.usage_counters SET consumed = consumed + p_amount, updated_at = now() WHERE user_id = v_user AND resource_code = p_resource_code AND period_start = v_sub.current_period_start RETURNING consumed INTO v_consumed;
  END IF;
  RETURN jsonb_build_object('allowed', true, 'consumed', v_consumed, 'limit', v_limit, 'warning', v_limit IS NOT NULL AND v_consumed * 100 >= v_limit * COALESCE(v_warning,80));
END;
$$;

CREATE OR REPLACE FUNCTION private.consume_once(p_resource_code text, p_operation_key text, p_amount bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
DECLARE v_user uuid := auth.uid(); v_org uuid; v_result jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.usage_events WHERE resource_code = p_resource_code AND operation_key = p_operation_key) THEN
    RETURN jsonb_build_object('allowed', true, 'already_counted', true);
  END IF;
  v_result := public.consume_subscription_usage(p_resource_code, p_amount);
  IF NOT COALESCE((v_result->>'allowed')::boolean, false) THEN RETURN v_result; END IF;
  v_org := private.current_organization_id(v_user);
  INSERT INTO public.usage_events(user_id, organization_id, resource_code, operation_key, amount)
  VALUES (CASE WHEN v_org IS NULL THEN v_user ELSE NULL END, v_org, p_resource_code, p_operation_key, p_amount)
  ON CONFLICT (resource_code, operation_key) DO NOTHING;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION private.consume_once(text,text,bigint) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_organization_invite(p_role text, p_email text DEFAULT NULL, p_expires_in_hours integer DEFAULT 72)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, extensions, pg_temp AS $$
DECLARE v_user uuid := auth.uid(); v_org uuid; v_role text; v_token text; v_id uuid; v_usage jsonb;
BEGIN
  v_org := private.current_organization_id(v_user); v_role := private.organization_role(v_org, v_user);
  IF v_org IS NULL OR v_role NOT IN ('owner','coordinator','supervisor') THEN RAISE EXCEPTION 'invite_not_allowed' USING ERRCODE = '42501'; END IF;
  IF p_role NOT IN ('coordinator','supervisor','agent') OR (v_role = 'supervisor' AND p_role <> 'agent') THEN RAISE EXCEPTION 'role_not_allowed' USING ERRCODE = '42501'; END IF;
  v_usage := public.consume_subscription_usage('invitations', 1);
  IF NOT COALESCE((v_usage->>'allowed')::boolean, false) THEN RETURN v_usage; END IF;
  v_token := upper(encode(extensions.gen_random_bytes(18), 'hex'));
  INSERT INTO public.organization_invites(organization_id, token_hash, email, role, expires_at, created_by)
  VALUES (v_org, encode(extensions.digest(v_token, 'sha256'), 'hex'), nullif(lower(trim(p_email)), ''), p_role, now() + make_interval(hours => greatest(1, least(p_expires_in_hours, 720))), v_user)
  RETURNING id INTO v_id;
  INSERT INTO public.subscription_audit_events(organization_id, actor_id, event_type, entity_type, entity_id, metadata)
  VALUES (v_org, v_user, 'invite_created', 'organization_invite', v_id::text, jsonb_build_object('role', p_role));
  RETURN jsonb_build_object('allowed', true, 'invite_id', v_id, 'token', v_token, 'expires_at', now() + make_interval(hours => greatest(1, least(p_expires_in_hours, 720))));
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_organization_invite(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, extensions, pg_temp AS $$
DECLARE
  v_user uuid := auth.uid(); v_invite public.organization_invites; v_sub public.subscriptions;
  v_limit bigint; v_members bigint; v_enforced boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_invite FROM public.organization_invites WHERE token_hash = encode(extensions.digest(upper(trim(p_token)), 'sha256'), 'hex') FOR UPDATE;
  IF v_invite.id IS NULL THEN RETURN jsonb_build_object('accepted', false, 'reason', 'invalid'); END IF;
  IF v_invite.status <> 'pending' THEN RETURN jsonb_build_object('accepted', false, 'reason', 'already_used'); END IF;
  IF v_invite.expires_at <= now() THEN UPDATE public.organization_invites SET status = 'expired' WHERE id = v_invite.id; RETURN jsonb_build_object('accepted', false, 'reason', 'expired'); END IF;
  IF EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = v_user AND status IN ('invited','active','suspended')) THEN RETURN jsonb_build_object('accepted', false, 'reason', 'already_member'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_invite.organization_id::text, 1));
  SELECT entitlement_enforcement_enabled INTO v_enforced FROM public.subscription_settings WHERE singleton;
  SELECT * INTO v_sub FROM public.subscriptions WHERE organization_id = v_invite.organization_id ORDER BY created_at DESC LIMIT 1;
  SELECT hard_limit INTO v_limit FROM public.plan_limits WHERE plan_id = v_sub.plan_id AND resource_code = 'users';
  SELECT count(*) INTO v_members FROM public.organization_members WHERE organization_id = v_invite.organization_id AND status IN ('active','invited');
  IF v_enforced AND (v_sub.id IS NULL OR v_sub.status NOT IN ('trial','active','grace')) THEN RETURN jsonb_build_object('accepted', false, 'reason', 'subscription_inactive'); END IF;
  IF v_enforced AND v_limit IS NOT NULL AND v_members >= v_limit THEN RETURN jsonb_build_object('accepted', false, 'reason', 'limit_reached', 'consumed', v_members, 'limit', v_limit); END IF;
  INSERT INTO public.organization_members(organization_id, user_id, role, status, joined_at) VALUES (v_invite.organization_id, v_user, v_invite.role, 'active', now());
  UPDATE public.users SET organization_id = v_invite.organization_id WHERE uid = v_user;
  UPDATE public.organization_invites SET status = 'accepted', accepted_by = v_user, accepted_at = now() WHERE id = v_invite.id;
  IF v_sub.id IS NOT NULL THEN
    INSERT INTO public.usage_counters(organization_id, resource_code, period_start, period_end, consumed)
    VALUES (v_invite.organization_id, 'users', v_sub.current_period_start, COALESCE(v_sub.current_period_end, v_sub.current_period_start + interval '1 month'), v_members + 1)
    ON CONFLICT (organization_id, resource_code, period_start) WHERE organization_id IS NOT NULL
    DO UPDATE SET consumed = EXCLUDED.consumed, updated_at = now();
  END IF;
  INSERT INTO public.subscription_audit_events(organization_id, actor_id, event_type, entity_type, entity_id)
  VALUES (v_invite.organization_id, v_user, 'invite_accepted', 'organization_invite', v_invite.id::text);
  RETURN jsonb_build_object('accepted', true, 'organization_id', v_invite.organization_id, 'role', v_invite.role);
END;
$$;

CREATE OR REPLACE FUNCTION public.register_active_session(p_device_id text, p_device_name text DEFAULT NULL, p_platform text DEFAULT 'unknown', p_replace boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
DECLARE v_user uuid := auth.uid(); v_auth_session uuid; v_org uuid; v_existing public.active_sessions; v_policy text := 'block'; v_enforced boolean; v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  v_auth_session := nullif(auth.jwt()->>'session_id','')::uuid;
  IF v_auth_session IS NULL THEN RAISE EXCEPTION 'session_id_missing' USING ERRCODE = '42501'; END IF;
  IF p_platform NOT IN ('android','ios','web','unknown') THEN RAISE EXCEPTION 'invalid_platform'; END IF;
  v_org := private.current_organization_id(v_user);
  SELECT session_enforcement_enabled INTO v_enforced FROM public.subscription_settings WHERE singleton;
  IF v_org IS NOT NULL THEN SELECT session_policy INTO v_policy FROM public.organizations WHERE id = v_org; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  UPDATE public.active_sessions SET status = 'expired', ended_at = now(), end_reason = 'heartbeat_timeout'
   WHERE user_id = v_user AND status = 'active' AND last_heartbeat_at < now() - COALESCE((SELECT make_interval(mins => o.session_timeout_minutes + o.offline_tolerance_minutes) FROM public.organizations o WHERE o.id = v_org), interval '24 hours');
  SELECT * INTO v_existing FROM public.active_sessions WHERE user_id = v_user AND status = 'active' LIMIT 1 FOR UPDATE;
  IF v_existing.id IS NOT NULL AND v_existing.auth_session_id <> v_auth_session THEN
    IF v_enforced AND NOT p_replace AND v_policy = 'block' THEN RETURN jsonb_build_object('allowed', false, 'reason', 'active_session_exists', 'device_name', v_existing.device_name); END IF;
    UPDATE public.active_sessions SET status = 'replaced', ended_at = now(), ended_by = v_user, end_reason = 'new_login' WHERE id = v_existing.id;
  END IF;
  INSERT INTO public.active_sessions(auth_session_id, user_id, organization_id, device_id, device_name, platform)
  VALUES (v_auth_session, v_user, v_org, p_device_id, p_device_name, p_platform)
  ON CONFLICT (auth_session_id) DO UPDATE SET last_heartbeat_at = now(), status = 'active', device_id = EXCLUDED.device_id, device_name = EXCLUDED.device_name
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('allowed', true, 'session_id', v_id, 'enforced', COALESCE(v_enforced,false));
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_active_session()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_rows integer; v_session uuid := nullif(auth.jwt()->>'session_id','')::uuid;
BEGIN
  UPDATE public.active_sessions SET last_heartbeat_at = now() WHERE auth_session_id = v_session AND user_id = auth.uid() AND status = 'active';
  GET DIAGNOSTICS v_rows = ROW_COUNT; RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_active_session(p_session_id uuid, p_reason text DEFAULT 'remote_termination')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
DECLARE v_target public.active_sessions; v_actor uuid := auth.uid();
BEGIN
  SELECT * INTO v_target FROM public.active_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_target.id IS NULL THEN RETURN false; END IF;
  IF v_target.user_id <> v_actor AND NOT private.is_owner_admin(v_actor)
     AND NOT (v_target.organization_id = private.current_organization_id(v_actor) AND private.organization_role(v_target.organization_id, v_actor) IN ('owner','coordinator','supervisor'))
  THEN RAISE EXCEPTION 'session_termination_not_allowed' USING ERRCODE = '42501'; END IF;
  UPDATE public.active_sessions SET status = 'revoked', ended_at = now(), ended_by = v_actor, end_reason = left(p_reason, 200) WHERE id = p_session_id AND status = 'active';
  INSERT INTO public.subscription_audit_events(organization_id, actor_id, event_type, entity_type, entity_id, metadata)
  VALUES (v_target.organization_id, v_actor, 'session_ended', 'active_session', p_session_id::text, jsonb_build_object('reason', p_reason));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.open_support_ticket(p_category text, p_subject text, p_description text, p_priority text DEFAULT 'normal')
RETURNS public.support_tickets LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
DECLARE v_user uuid := auth.uid(); v_org uuid; v_ticket public.support_tickets; v_plan uuid; v_sla public.support_sla_policies;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF p_priority NOT IN ('low','normal','high','critical') THEN RAISE EXCEPTION 'invalid_priority'; END IF;
  v_org := private.current_organization_id(v_user);
  SELECT plan_id INTO v_plan FROM public.subscriptions
  WHERE (v_org IS NOT NULL AND organization_id = v_org) OR (v_org IS NULL AND user_id = v_user)
  ORDER BY created_at DESC LIMIT 1;
  SELECT * INTO v_sla FROM public.support_sla_policies WHERE plan_id = v_plan AND priority = p_priority;
  INSERT INTO public.support_tickets(user_id, organization_id, plan_id, requester_id, category, subject, description, priority, assigned_to, response_due_at, resolution_due_at, escalate_at)
  VALUES (CASE WHEN v_org IS NULL THEN v_user ELSE NULL END, v_org, v_plan, v_user, left(trim(p_category),80), left(trim(p_subject),200), trim(p_description), p_priority,
    v_sla.default_assignee,
    CASE WHEN v_sla.response_minutes IS NULL THEN NULL ELSE now() + make_interval(mins => v_sla.response_minutes) END,
    CASE WHEN v_sla.resolution_minutes IS NULL THEN NULL ELSE now() + make_interval(mins => v_sla.resolution_minutes) END,
    CASE WHEN v_sla.escalation_minutes IS NULL THEN NULL ELSE now() + make_interval(mins => v_sla.escalation_minutes) END)
  RETURNING * INTO v_ticket;
  INSERT INTO public.support_ticket_events(ticket_id, actor_id, event_type, message) VALUES (v_ticket.id, v_user, 'created', 'Chamado aberto');
  RETURN v_ticket;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_denied_owner_access()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.subscription_audit_events(actor_id, event_type, entity_type, entity_id)
  VALUES (auth.uid(), 'owner_access_denied', 'owner_console', auth.uid()::text);
END;
$$;

CREATE OR REPLACE FUNCTION private.enforce_inspection_entitlement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
  v_result := private.consume_once('inspections', NEW.id::text, 1);
  IF NOT COALESCE((v_result->>'allowed')::boolean, false) THEN
    RAISE EXCEPTION 'inspection_creation_blocked' USING ERRCODE = 'P0001', DETAIL = v_result::text;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enforce_inspection_entitlement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS zz_vistorias_enforce_entitlement ON public.vistorias;
CREATE TRIGGER zz_vistorias_enforce_entitlement BEFORE INSERT ON public.vistorias
FOR EACH ROW EXECUTE FUNCTION private.enforce_inspection_entitlement();

CREATE OR REPLACE FUNCTION private.enforce_storage_entitlement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
DECLARE v_bytes bigint; v_result jsonb;
BEGIN
  IF NEW.bucket_id NOT IN ('fotos','laudos') OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  v_bytes := COALESCE(nullif(NEW.metadata->>'size','')::bigint, 0);
  IF v_bytes <= 0 THEN RETURN NEW; END IF;
  v_result := private.consume_once('storage_bytes', NEW.bucket_id || '/' || NEW.name, v_bytes);
  IF NOT COALESCE((v_result->>'allowed')::boolean, false) THEN
    RAISE EXCEPTION 'storage_limit_reached' USING ERRCODE = 'P0001', DETAIL = v_result::text;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enforce_storage_entitlement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS zz_storage_enforce_entitlement ON storage.objects;
CREATE TRIGGER zz_storage_enforce_entitlement BEFORE INSERT ON storage.objects
FOR EACH ROW EXECUTE FUNCTION private.enforce_storage_entitlement();

REVOKE ALL ON FUNCTION public.get_subscription_context(), public.has_subscription_feature(text),
  public.consume_subscription_usage(text,bigint), public.create_organization_invite(text,text,integer),
  public.accept_organization_invite(text), public.register_active_session(text,text,text,boolean),
  public.heartbeat_active_session(), public.end_active_session(uuid,text),
  public.open_support_ticket(text,text,text,text), public.record_denied_owner_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_subscription_context(), public.has_subscription_feature(text),
  public.consume_subscription_usage(text,bigint), public.create_organization_invite(text,text,integer),
  public.accept_organization_invite(text), public.register_active_session(text,text,text,boolean),
  public.heartbeat_active_session(), public.end_active_session(uuid,text),
  public.open_support_ticket(text,text,text,text), public.record_denied_owner_access() TO authenticated;

-- Replace municipality-based policies on the primary municipal tables.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('vistorias','agendamentos') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;
ALTER TABLE public.vistorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY vistorias_organization_select ON public.vistorias FOR SELECT TO authenticated USING (
  (SELECT private.is_owner_admin()) OR organization_id = (SELECT private.current_organization_id())
  OR (organization_id IS NULL AND "agenteUid" = (SELECT auth.uid()))
  OR (organization_id IS NULL AND (SELECT private.can_access_legacy_municipality(municipio)))
);
CREATE POLICY vistorias_organization_insert ON public.vistorias FOR INSERT TO authenticated WITH CHECK (
  (SELECT private.is_owner_admin()) OR organization_id = (SELECT private.current_organization_id())
  OR (organization_id IS NULL AND "agenteUid" = (SELECT auth.uid()))
);
CREATE POLICY vistorias_organization_update ON public.vistorias FOR UPDATE TO authenticated USING (
  (SELECT private.is_owner_admin()) OR organization_id = (SELECT private.current_organization_id())
  OR (organization_id IS NULL AND "agenteUid" = (SELECT auth.uid()))
  OR (organization_id IS NULL AND (SELECT private.can_access_legacy_municipality(municipio)))
) WITH CHECK (
  (SELECT private.is_owner_admin()) OR organization_id = (SELECT private.current_organization_id())
  OR (organization_id IS NULL AND "agenteUid" = (SELECT auth.uid()))
  OR (organization_id IS NULL AND (SELECT private.can_access_legacy_municipality(municipio)))
);
CREATE POLICY vistorias_organization_delete ON public.vistorias FOR DELETE TO authenticated USING (
  (SELECT private.is_owner_admin()) OR organization_id = (SELECT private.current_organization_id())
  OR (organization_id IS NULL AND "agenteUid" = (SELECT auth.uid()))
  OR (organization_id IS NULL AND (SELECT private.can_access_legacy_municipality(municipio)))
);
CREATE POLICY agendamentos_organization_select ON public.agendamentos FOR SELECT TO authenticated USING (
  (SELECT private.is_owner_admin()) OR organization_id = (SELECT private.current_organization_id())
  OR (organization_id IS NULL AND (agente_uid = (SELECT auth.uid()) OR criado_por_uid = (SELECT auth.uid())))
  OR (organization_id IS NULL AND (SELECT private.can_access_legacy_municipality(municipio)))
);
CREATE POLICY agendamentos_organization_insert ON public.agendamentos FOR INSERT TO authenticated WITH CHECK (
  (SELECT private.is_owner_admin()) OR organization_id = (SELECT private.current_organization_id())
  OR (organization_id IS NULL AND criado_por_uid = (SELECT auth.uid()))
);
CREATE POLICY agendamentos_organization_update ON public.agendamentos FOR UPDATE TO authenticated USING (
  (SELECT private.is_owner_admin()) OR organization_id = (SELECT private.current_organization_id())
  OR (organization_id IS NULL AND (agente_uid = (SELECT auth.uid()) OR criado_por_uid = (SELECT auth.uid())))
  OR (organization_id IS NULL AND (SELECT private.can_access_legacy_municipality(municipio)))
) WITH CHECK ((SELECT private.is_owner_admin()) OR organization_id = (SELECT private.current_organization_id()) OR (organization_id IS NULL AND (SELECT private.can_access_legacy_municipality(municipio))));
CREATE POLICY agendamentos_organization_delete ON public.agendamentos FOR DELETE TO authenticated USING (
  (SELECT private.is_owner_admin()) OR organization_id = (SELECT private.current_organization_id())
  OR (organization_id IS NULL AND criado_por_uid = (SELECT auth.uid()))
  OR (organization_id IS NULL AND (SELECT private.can_access_legacy_municipality(municipio)))
);

COMMENT ON TABLE public.subscription_settings IS 'Feature flags keep commercial/session enforcement off until owner approval and pilot validation.';
COMMENT ON COLUMN public.users.organization_id IS 'Compatibility cache only; authorization is derived from organization_members.';
