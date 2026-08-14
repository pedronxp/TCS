BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(61);
CREATE TEMP TABLE portal_tap_output(line text);
CREATE TEMP TABLE portal_direct_checks(name text PRIMARY KEY, passed boolean NOT NULL);
CREATE TEMP TABLE protocol_direct_checks(name text PRIMARY KEY, passed boolean NOT NULL, value text);
GRANT SELECT, INSERT ON portal_tap_output, portal_direct_checks, protocol_direct_checks TO authenticated;

INSERT INTO auth.users(id, email, email_confirmed_at, raw_user_meta_data)
VALUES
  ('51000000-0000-4000-8000-000000000001', 'individual-a@example.test', now(), '{}'::jsonb),
  ('51000000-0000-4000-8000-000000000002', 'coordinator-a@example.test', now(), '{}'::jsonb),
  ('51000000-0000-4000-8000-000000000003', 'agent-a@example.test', now(), '{}'::jsonb),
  ('51000000-0000-4000-8000-000000000004', 'supervisor-a@example.test', now(), '{}'::jsonb),
  ('51000000-0000-4000-8000-000000000005', 'coordinator-b@example.test', now(), '{}'::jsonb),
  ('51000000-0000-4000-8000-000000000006', 'internal@example.test', now(), '{}'::jsonb),
  ('51000000-0000-4000-8000-000000000007', 'individual-b@example.test', now(), '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- The hardened Auth trigger now creates every identity as a neutral pending
-- customer. This fixture replaces those neutral profiles with its explicit
-- authorization scenarios.
DELETE FROM public.users
WHERE uid IN (
  '51000000-0000-4000-8000-000000000001',
  '51000000-0000-4000-8000-000000000002',
  '51000000-0000-4000-8000-000000000003',
  '51000000-0000-4000-8000-000000000004',
  '51000000-0000-4000-8000-000000000005',
  '51000000-0000-4000-8000-000000000006',
  '51000000-0000-4000-8000-000000000007'
);

INSERT INTO public.users(uid, email, name, username, role, "isApproved")
VALUES
  ('51000000-0000-4000-8000-000000000001', 'individual-a@example.test', 'Individual A', 'individual-a', 'agent', true),
  ('51000000-0000-4000-8000-000000000002', 'coordinator-a@example.test', 'Master A', 'coordinator-a', 'admin', true),
  ('51000000-0000-4000-8000-000000000003', 'agent-a@example.test', 'Agent A', 'agent-a', 'agent', true),
  ('51000000-0000-4000-8000-000000000004', 'supervisor-a@example.test', 'Supervisor A', 'supervisor-a', 'supervisor', true),
  ('51000000-0000-4000-8000-000000000005', 'coordinator-b@example.test', 'Master B', 'coordinator-b', 'admin', true),
  ('51000000-0000-4000-8000-000000000006', 'internal@example.test', 'Internal', 'internal', 'agent', true),
  ('51000000-0000-4000-8000-000000000007', 'individual-b@example.test', 'Individual B', 'individual-b', 'agent', true)
ON CONFLICT (uid) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name;

INSERT INTO public.internal_staff(user_id, role, status, display_name)
VALUES ('51000000-0000-4000-8000-000000000006', 'developer', 'active', 'Internal')
ON CONFLICT (user_id) DO UPDATE SET status = 'active';

INSERT INTO public.organizations(id, slug, display_name, municipality_name, status)
VALUES
  ('52000000-0000-4000-8000-000000000001', 'portal-org-a', 'Portal Org A', 'Município A', 'pilot'),
  ('52000000-0000-4000-8000-000000000002', 'portal-org-b', 'Portal Org B', 'Município B', 'pilot')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organization_members(organization_id, user_id, role, status, joined_at, scope)
VALUES
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000002', 'master', 'active', now(), '{}'::jsonb),
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000003', 'agent', 'active', now(), '{}'::jsonb),
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000004', 'supervisor', 'active', now(), '{"agent_ids":["51000000-0000-4000-8000-000000000003"]}'::jsonb),
  ('52000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000005', 'master', 'active', now(), '{}'::jsonb)
ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active', scope = EXCLUDED.scope;

INSERT INTO public.subscriptions(plan_id, plan_version_id, organization_id, status, current_period_start, current_period_end)
SELECT plan.id, version.id, subject.organization_id, 'active', date_trunc('month', now()), date_trunc('month', now()) + interval '1 month'
FROM (VALUES
  ('municipal_basic', '52000000-0000-4000-8000-000000000001'::uuid),
  ('municipal_basic', '52000000-0000-4000-8000-000000000002'::uuid)
) AS subject(plan_code, organization_id)
JOIN public.plans AS plan ON plan.code = subject.plan_code
JOIN public.plan_versions AS version ON version.plan_id = plan.id AND version.version = plan.current_version
ON CONFLICT DO NOTHING;

INSERT INTO public.subscriptions(plan_id, plan_version_id, user_id, status, current_period_start, current_period_end)
SELECT plan.id, version.id, subject.user_id, 'active', date_trunc('month', now()), date_trunc('month', now()) + interval '1 month'
FROM (VALUES
  ('individual_professional', '51000000-0000-4000-8000-000000000001'::uuid),
  ('individual_basic', '51000000-0000-4000-8000-000000000007'::uuid)
) AS subject(plan_code, user_id)
JOIN public.plans AS plan ON plan.code = subject.plan_code
JOIN public.plan_versions AS version ON version.plan_id = plan.id AND version.version = plan.current_version
ON CONFLICT DO NOTHING;

INSERT INTO public.organization_invites(
  organization_id, token_hash, email, role, status, expires_at, created_by
)
VALUES (
  '52000000-0000-4000-8000-000000000001',
  encode(extensions.digest('PORTAL-INVITE-A', 'sha256'), 'hex'),
  'recipient@example.test',
  'agent',
  'pending',
  now() + interval '72 hours',
  '51000000-0000-4000-8000-000000000002'
), (
  '52000000-0000-4000-8000-000000000001',
  encode(extensions.digest('PORTAL-INVITE-B', 'sha256'), 'hex'),
  'individual-b@example.test',
  'agent',
  'pending',
  now() + interval '72 hours',
  '51000000-0000-4000-8000-000000000002'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
INSERT INTO portal_tap_output
SELECT extensions.is(public.get_portal_access_context()->>'account_kind', 'individual', 'individual context is server-derived');
INSERT INTO portal_tap_output
SELECT extensions.is((SELECT count(*) FROM public.subscriptions), 1::bigint, 'individual A cannot read individual B subscription');

RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
INSERT INTO portal_tap_output
SELECT extensions.is(public.get_portal_access_context()->>'account_kind', 'organization', 'municipal context is server-derived');
INSERT INTO portal_tap_output
SELECT extensions.is(public.get_portal_access_context()->>'role', 'master', 'master role comes from active membership');
INSERT INTO portal_tap_output
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(public.get_portal_access_context()->'permissions') AS permission(value)
    WHERE permission.value LIKE 'internal_%'
  ),
  'master context never receives internal permissions'
);
INSERT INTO portal_tap_output
SELECT extensions.is((SELECT count(*) FROM public.organizations), 1::bigint, 'master cannot read another organization');
INSERT INTO portal_tap_output
SELECT extensions.is((SELECT display_name FROM public.organizations), 'Portal Org A', 'organization A does not leak organization B');
INSERT INTO portal_tap_output
SELECT extensions.is((SELECT count(*) FROM public.subscriptions), 1::bigint, 'master sees own organization subscription');
INSERT INTO portal_tap_output
SELECT extensions.is((SELECT count(*) FROM public.organization_invites), 2::bigint, 'master sees own organization invitations');

RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
INSERT INTO portal_tap_output
SELECT extensions.is((SELECT count(*) FROM public.organization_members), 1::bigint, 'agent sees only own membership');
INSERT INTO portal_tap_output
SELECT extensions.is((SELECT count(*) FROM public.subscriptions), 0::bigint, 'agent cannot read organization billing directly');
INSERT INTO portal_tap_output
SELECT extensions.is((SELECT count(*) FROM public.organization_invites), 0::bigint, 'agent cannot read invitations directly');
DO $$ BEGIN
  PERFORM public.portal_update_organization_member(
    '00000000-0000-0000-0000-000000000000', 'agent', 'active',
    'attempt outside allowed role', 'CONFIRMAR'
  );
  INSERT INTO portal_direct_checks VALUES ('agent_team_manage', false);
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO portal_direct_checks VALUES ('agent_team_manage', true);
END $$;
INSERT INTO portal_tap_output
SELECT extensions.ok((SELECT passed FROM portal_direct_checks WHERE name = 'agent_team_manage'), 'agent direct team mutation is rejected');
DO $$ BEGIN
  PERFORM public.portal_accept_organization_invite('PORTAL-INVITE-A');
  INSERT INTO portal_direct_checks VALUES ('forwarded_invite', false);
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO portal_direct_checks VALUES ('forwarded_invite', true);
END $$;
INSERT INTO portal_tap_output
SELECT extensions.ok((SELECT passed FROM portal_direct_checks WHERE name = 'forwarded_invite'), 'forwarded invitation is rejected when verified email differs');

RESET ROLE;
INSERT INTO portal_tap_output
SELECT extensions.ok(
  private.portal_agent_allowed(
    '52000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000003',
    '51000000-0000-4000-8000-000000000002'
  ),
  'master can access an active agent in the same organization'
);
INSERT INTO portal_tap_output
SELECT extensions.ok(
  NOT COALESCE(private.portal_agent_allowed(
    '52000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000005',
    '51000000-0000-4000-8000-000000000002'
  ), false),
  'master cannot authorize an identity outside the organization'
);
INSERT INTO portal_tap_output
SELECT extensions.ok(
  private.portal_agent_allowed(
    '52000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000003',
    '51000000-0000-4000-8000-000000000004'
  ),
  'supervisor can access an explicitly assigned agent'
);
INSERT INTO portal_tap_output
SELECT extensions.ok(
  NOT COALESCE(private.portal_agent_allowed(
    '52000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000005',
    '51000000-0000-4000-8000-000000000004'
  ), false),
  'supervisor cannot expand scope with a client filter'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
INSERT INTO portal_tap_output
SELECT extensions.ok(
  NOT (public.get_portal_access_context()->'permissions' ? 'team.manage')
  AND NOT (public.get_portal_access_context()->'permissions' ? 'billing.read'),
  'supervisor cannot expand team or billing permissions'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
INSERT INTO portal_tap_output
SELECT extensions.is(public.get_portal_access_context(), NULL::jsonb, 'active internal identity receives no customer portal context');

RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
DO $$ BEGIN
  PERFORM public.portal_create_checkout('individual_basic', 'monthly', '53000000-0000-4000-8000-000000000001');
  INSERT INTO portal_direct_checks VALUES ('billing_rollout', false);
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO portal_direct_checks VALUES ('billing_rollout', true);
END $$;
INSERT INTO portal_tap_output
SELECT extensions.ok((SELECT passed FROM portal_direct_checks WHERE name = 'billing_rollout'), 'billing remains closed while rollout flag is disabled');

RESET ROLE;
INSERT INTO portal_tap_output
SELECT extensions.ok(
  NOT has_function_privilege('authenticated', 'public.portal_process_payment_event(text,text,timestamptz,text,text,text,text,text)', 'EXECUTE'),
  'authenticated client cannot process payment events'
);

RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000007","role":"authenticated"}', true);
INSERT INTO portal_tap_output
SELECT extensions.is(
  public.portal_accept_organization_invite('PORTAL-INVITE-B')->>'accepted',
  'true',
  'matching verified recipient accepts invitation once'
);
INSERT INTO portal_tap_output
SELECT extensions.is(
  public.portal_accept_organization_invite('PORTAL-INVITE-B')->>'reason',
  'already_used',
  'accepted invitation token cannot be reused'
);

RESET ROLE;
INSERT INTO portal_tap_output
SELECT extensions.ok(
  pg_get_functiondef('public.portal_accept_organization_invite(text)'::regprocedure) LIKE '%pg_advisory_xact_lock%'
  AND pg_get_functiondef('public.portal_accept_organization_invite(text)'::regprocedure) LIKE '%FOR UPDATE%',
  'invitation acceptance serializes the last-seat and token checks'
);

INSERT INTO portal_tap_output
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'allow_self_insert_on_signup'
  ),
  'legacy public user-profile insert policy is removed'
);

INSERT INTO portal_tap_output
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'invite_tokens'
      AND policyname = 'allow_mark_token_used'
  ),
  'legacy direct invitation-token update policy is removed'
);

INSERT INTO portal_tap_output
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'leitura_publica_fotos'
  ),
  'legacy public photo listing policy is removed'
);

INSERT INTO portal_tap_output
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Vistorias Public Read'
  ),
  'legacy public inspection listing policy is removed'
);

INSERT INTO portal_tap_output
SELECT extensions.ok(
  NOT has_function_privilege(
    'anon',
    'public.admin_reset_password(uuid,text)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute administrative password reset'
);

INSERT INTO portal_tap_output
SELECT extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.admin_reset_password(uuid,text)',
    'EXECUTE'
  ),
  'authenticated staff retain access to the database-authorized password reset'
);

INSERT INTO portal_tap_output
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc AS procedure
    JOIN pg_namespace AS namespace
      ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname IN ('public', 'private')
      AND procedure.prosecdef
      AND procedure.prorettype = 'trigger'::regtype
      AND (
        has_function_privilege('anon', procedure.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      )
  ),
  'API roles cannot invoke SECURITY DEFINER trigger functions directly'
);

INSERT INTO portal_tap_output
SELECT extensions.ok(
  pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conrelid = 'public.organization_members'::regclass AND conname = 'organization_members_role_check'))
    LIKE '%master%'
  AND pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conrelid = 'public.organization_members'::regclass AND conname = 'organization_members_role_check'))
    LIKE '%admin%',
  'municipal membership accepts the master and admin hierarchy'
);

INSERT INTO portal_tap_output
SELECT extensions.ok(
  private.portal_invite_role_allowed('master', 'admin')
  AND private.portal_invite_role_allowed('admin', 'supervisor')
  AND private.portal_invite_role_allowed('supervisor', 'agent')
  AND NOT private.portal_invite_role_allowed('admin', 'admin'),
  'invite authority follows master admin supervisor hierarchy'
);

INSERT INTO portal_tap_output
SELECT extensions.is(
  private.mask_session_ip('203.0.113.17'::inet),
  '203.0.113.***',
  'device IP hides the final segment'
);

INSERT INTO portal_tap_output
SELECT extensions.is(
  private.mask_session_mac('AA:BB:CC:DD:EE:FF'),
  'AA:BB:CC:**:**:**',
  'device MAC hides the identifying final octets'
);

INSERT INTO portal_tap_output
SELECT extensions.ok(
  NOT has_function_privilege('authenticated', 'public.portal_end_own_session(uuid)', 'EXECUTE'),
  'portal users cannot terminate device registers'
);

INSERT INTO auth.users(id, email, email_confirmed_at, raw_user_meta_data)
VALUES ('51000000-0000-4000-8000-000000000008', 'master-pending@example.test', now(), '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.users WHERE uid = '51000000-0000-4000-8000-000000000008';
INSERT INTO public.users(uid, email, name, username, role, "isApproved")
VALUES ('51000000-0000-4000-8000-000000000008', 'master-pending@example.test', 'Master Pendente', 'master-pending', 'agent', false);

INSERT INTO public.organization_members(organization_id, user_id, role, status, joined_at, scope)
VALUES ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000008', 'master', 'active', now(), '{}'::jsonb);

INSERT INTO portal_tap_output
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.users
    WHERE uid = '51000000-0000-4000-8000-000000000008'
      AND organization_id = '52000000-0000-4000-8000-000000000001'
      AND role = 'admin'
      AND "isApproved" = true
  ),
  'a master membership activates a pending profile with the compatible admin projection'
);

-- A non-affiliated individual is a valid operational identity. The server must
-- allocate its own immutable annual series rather than rejecting the inspection.
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
DO $$
DECLARE result jsonb;
BEGIN
  result := public.sync_finalized_inspection(jsonb_build_object(
    'id', '61000000-0000-4000-8000-000000000001',
    'agenteUid', '51000000-0000-4000-8000-000000000001',
    'agenteNome', 'Individual A',
    'status', 'concluida',
    'dataVistoria', '2026-08-13T12:00:00Z',
    'formularioId', 'risco_inundacao_v1'
  ));
  INSERT INTO protocol_direct_checks VALUES ('individual_protocol_allocated', result->>'protocol' LIKE 'TCS-IND-2026-%', result->>'protocol');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO protocol_direct_checks VALUES ('individual_protocol_allocated', false, SQLERRM);
END $$;
INSERT INTO portal_tap_output
SELECT extensions.ok((SELECT passed FROM protocol_direct_checks WHERE name = 'individual_protocol_allocated'), 'individual finalized inspection receives an official IND protocol');

DO $$
DECLARE result jsonb;
BEGIN
  result := public.sync_finalized_inspection(jsonb_build_object(
    'id', '61000000-0000-4000-8000-000000000001',
    'agenteUid', '51000000-0000-4000-8000-000000000001',
    'agenteNome', 'Individual A',
    'status', 'concluida',
    'dataVistoria', '2026-08-13T12:00:00Z',
    'formularioId', 'risco_inundacao_v1'
  ));
  INSERT INTO protocol_direct_checks VALUES ('individual_protocol_idempotent', result->>'protocol' = (SELECT value FROM protocol_direct_checks WHERE name = 'individual_protocol_allocated'), result->>'protocol');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO protocol_direct_checks VALUES ('individual_protocol_idempotent', false, SQLERRM);
END $$;
INSERT INTO portal_tap_output
SELECT extensions.ok((SELECT passed FROM protocol_direct_checks WHERE name = 'individual_protocol_idempotent'), 'retrying an individual finalized inspection preserves its protocol');

INSERT INTO portal_tap_output
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(public.get_subscription_context()->'usage') AS item
    WHERE item->>'resource' IN ('invitations', 'storage_bytes')
  ),
  'individual plan context omits invitations and storage usage'
);

INSERT INTO portal_tap_output
SELECT extensions.ok(
  COALESCE((public.get_subscription_context()->'features'->>'municipal_coordination')::boolean, false) = false,
  'individual plan context does not expose municipal coordination'
);

RESET ROLE;
UPDATE public.vistorias
SET latitude = -21.2406,
    longitude = -42.0001,
    endereco = 'Rua Marlene, 531 - Dico Leite'
WHERE id = '61000000-0000-4000-8000-000000000001';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
INSERT INTO portal_tap_output
SELECT extensions.is(
  (public.portal_get_workspace('mapa')->'items'->0->>'id')::uuid,
  '61000000-0000-4000-8000-000000000001'::uuid,
  'mapa retorna a vistoria individual sincronizada'
);
INSERT INTO portal_tap_output
SELECT extensions.is(
  public.portal_get_workspace('mapa')->'items'->0->>'formulario_id',
  'risco_inundacao_v1',
  'mapa expõe o formulário da vistoria autorizada'
);
INSERT INTO portal_tap_output
SELECT extensions.is(
  (public.portal_get_workspace('relatorios')->'summary'->>'inspections')::integer,
  1,
  'relatórios contam a vistoria individual sincronizada'
);

-- === ENTREGA A1: contexto de acesso tipado ===
-- Fixtures dedicados aos quatro cenários contratuais. Uma organização sem
-- assinatura isola o "Master sem assinatura"; um agente suspenso isola o
-- "membership_inactive". O histórico de subscriptions é preservado.

RESET ROLE;
INSERT INTO auth.users(id, email, email_confirmed_at, raw_user_meta_data)
VALUES
  ('51000000-0000-4000-8000-000000000009', 'master-no-sub@example.test', now(), '{}'::jsonb),
  ('51000000-0000-4000-8000-000000000010', 'agent-suspended@example.test', now(), '{}'::jsonb),
  ('51000000-0000-4000-8000-000000000011', 'master-pastdue@example.test', now(), '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.users WHERE uid IN (
  '51000000-0000-4000-8000-000000000009',
  '51000000-0000-4000-8000-000000000010',
  '51000000-0000-4000-8000-000000000011'
);
INSERT INTO public.users(uid, email, name, username, role, "isApproved")
VALUES
  ('51000000-0000-4000-8000-000000000009', 'master-no-sub@example.test', 'Master Sem Assinatura', 'master-no-sub', 'admin', true),
  ('51000000-0000-4000-8000-000000000010', 'agent-suspended@example.test', 'Agent Suspenso', 'agent-suspended', 'agent', true),
  ('51000000-0000-4000-8000-000000000011', 'master-pastdue@example.test', 'Master Past Due', 'master-pastdue', 'admin', true)
ON CONFLICT (uid) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name;

-- Organização C: master ativo (009), porém sem assinatura alguma (cenário 2).
-- Organização D: master ativo (011) com assinatura past_due (cenário 2b).
-- Organização A mantém sua assinatura ativa original; nada é removido.
INSERT INTO public.organizations(id, slug, display_name, municipality_name, status)
VALUES
  ('52000000-0000-4000-8000-000000000003', 'portal-org-c', 'Portal Org C', 'Município C', 'pilot'),
  ('52000000-0000-4000-8000-000000000004', 'portal-org-d', 'Portal Org D', 'Município D', 'pilot')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organization_members(organization_id, user_id, role, status, joined_at, scope)
VALUES
  ('52000000-0000-4000-8000-000000000003', '51000000-0000-4000-8000-000000000009', 'master', 'active', now(), '{}'::jsonb),
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000010', 'agent', 'suspended', now(), '{}'::jsonb),
  ('52000000-0000-4000-8000-000000000004', '51000000-0000-4000-8000-000000000011', 'master', 'active', now(), '{}'::jsonb)
ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, scope = EXCLUDED.scope;

-- Assinatura past_due para a organização D (cenário de causa subscription_past_due
-- para um master). O histórico permanece; nenhum registro ativo é removido.
-- A org C permanece deliberadamente sem assinatura.
INSERT INTO public.subscriptions(plan_id, plan_version_id, organization_id, status, current_period_start, current_period_end)
SELECT plan.id, version.id, '52000000-0000-4000-8000-000000000004'::uuid, 'past_due', date_trunc('month', now()), date_trunc('month', now()) + interval '1 month'
FROM public.plans plan
JOIN public.plan_versions version ON version.plan_id = plan.id AND version.version = plan.current_version
WHERE plan.code = 'municipal_basic'
ON CONFLICT DO NOTHING;

-- Cenário 1: Master ativo com assinatura ativa (reutiliza Master A / Org A).
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
INSERT INTO portal_tap_output
SELECT extensions.is(
  public.get_portal_access_context()->>'creation_allowed',
  'true',
  'A1.1 master ativo com assinatura ativa permite criação'
);
INSERT INTO portal_tap_output
SELECT extensions.is(
  public.get_portal_access_context()->>'restriction_cause',
  NULL::text,
  'A1.2 master ativo com assinatura ativa não possui causa de restrição'
);
INSERT INTO portal_tap_output
SELECT extensions.is(
  public.get_portal_access_context()->>'role',
  'master',
  'A1.3 master ativo recebe o papel master no contrato tipado'
);
INSERT INTO portal_tap_output
SELECT extensions.ok(
  (public.get_portal_access_context()->'invite_permissions'->>'can_invite')::boolean,
  'A1.4 master ativo possui permissão efetiva de convite'
);
INSERT INTO portal_tap_output
SELECT extensions.ok(
  (public.get_portal_access_context()->'invite_permissions'->'target_roles' ? 'admin')::boolean,
  'A1.5 master ativo convida admin, supervisor e agent'
);

-- Cenário 2: Master ativo sem assinatura (Org C sem nenhuma assinatura ativa).
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000009","role":"authenticated"}', true);
INSERT INTO portal_tap_output
SELECT extensions.is(
  public.get_portal_access_context()->>'creation_allowed',
  'false',
  'A1.6 master sem assinatura não permite criação'
);
INSERT INTO portal_tap_output
SELECT extensions.is(
  public.get_portal_access_context()->>'restriction_cause',
  'subscription_inactive',
  'A1.7 master sem assinatura recebe causa subscription_inactive'
);
INSERT INTO portal_tap_output
SELECT extensions.is(
  public.get_portal_access_context()->>'subscription_status',
  'none',
  'A1.8 master sem assinatura recebe status none'
);

-- Cenário 2b: Master com assinatura past_due mantém consulta, bloqueia criação.
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
INSERT INTO portal_tap_output
SELECT extensions.is(
  public.get_portal_access_context()->>'creation_allowed',
  'false',
  'A1.9 master com assinatura past_due não permite criação'
);
INSERT INTO portal_tap_output
SELECT extensions.is(
  public.get_portal_access_context()->>'restriction_cause',
  'subscription_past_due',
  'A1.10 master com assinatura past_due recebe causa subscription_past_due'
);
INSERT INTO portal_tap_output
SELECT extensions.is(
  public.get_portal_access_context()->>'subscription_status',
  'past_due',
  'A1.11 master past_due mantém o status legível para consulta'
);

-- Cenário 3: Agent suspenso (membership_inactive tem precedência sobre assinatura).
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000010","role":"authenticated"}', true);
INSERT INTO portal_tap_output
SELECT extensions.is(
  public.get_portal_access_context()->>'creation_allowed',
  'false',
  'A1.12 agent suspenso não permite criação'
);
INSERT INTO portal_tap_output
SELECT extensions.is(
  public.get_portal_access_context()->>'restriction_cause',
  'membership_inactive',
  'A1.13 agent suspenso recebe causa membership_inactive'
);
INSERT INTO portal_tap_output
SELECT extensions.is(
  public.get_portal_access_context()->>'membership_status',
  'suspended',
  'A1.14 agent suspenso recebe status de membership suspenso'
);

-- Cenário 4: Dono interno (internal_staff) não recebe contexto de portal de cliente.
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"51000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
INSERT INTO portal_tap_output
SELECT extensions.is(
  public.get_portal_access_context(),
  NULL::jsonb,
  'A1.15 dono interno não recebe contexto de portal de cliente'
);

-- O histórico de subscriptions permanece intacto: a org A ainda possui sua
-- assinatura ativa original além das novas inserções.
INSERT INTO portal_tap_output
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE organization_id = '52000000-0000-4000-8000-000000000001' AND status = 'active'
  ),
  'A1.16 histórico de assinaturas ativas é preservado'
);

INSERT INTO portal_tap_output SELECT * FROM extensions.finish();
SELECT line FROM portal_tap_output;
ROLLBACK;
