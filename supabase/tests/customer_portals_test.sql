BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(32);
CREATE TEMP TABLE portal_tap_output(line text);
CREATE TEMP TABLE portal_direct_checks(name text PRIMARY KEY, passed boolean NOT NULL);
GRANT SELECT, INSERT ON portal_tap_output, portal_direct_checks TO authenticated;

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

INSERT INTO public.users(uid, email, name, username, role, "isApproved")
VALUES
  ('51000000-0000-4000-8000-000000000001', 'individual-a@example.test', 'Individual A', 'individual-a', 'agent', true),
  ('51000000-0000-4000-8000-000000000002', 'coordinator-a@example.test', 'Coordinator A', 'coordinator-a', 'coordinator', true),
  ('51000000-0000-4000-8000-000000000003', 'agent-a@example.test', 'Agent A', 'agent-a', 'agent', true),
  ('51000000-0000-4000-8000-000000000004', 'supervisor-a@example.test', 'Supervisor A', 'supervisor-a', 'supervisor', true),
  ('51000000-0000-4000-8000-000000000005', 'coordinator-b@example.test', 'Coordinator B', 'coordinator-b', 'coordinator', true),
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
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000002', 'coordinator', 'active', now(), '{}'::jsonb),
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000003', 'agent', 'active', now(), '{}'::jsonb),
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000004', 'supervisor', 'active', now(), '{"agent_ids":["51000000-0000-4000-8000-000000000003"]}'::jsonb),
  ('52000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000005', 'coordinator', 'active', now(), '{}'::jsonb)
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
  ('individual_basic', '51000000-0000-4000-8000-000000000001'::uuid),
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
SELECT extensions.is(public.get_portal_access_context()->>'role', 'coordinator', 'coordinator role comes from active membership');
INSERT INTO portal_tap_output
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(public.get_portal_access_context()->'permissions') AS permission(value)
    WHERE permission.value LIKE 'internal_%'
  ),
  'coordinator context never receives internal permissions'
);
INSERT INTO portal_tap_output
SELECT extensions.is((SELECT count(*) FROM public.organizations), 1::bigint, 'coordinator cannot read another organization');
INSERT INTO portal_tap_output
SELECT extensions.is((SELECT display_name FROM public.organizations), 'Portal Org A', 'organization A does not leak organization B');
INSERT INTO portal_tap_output
SELECT extensions.is((SELECT count(*) FROM public.subscriptions), 1::bigint, 'coordinator sees only own organization subscription');
INSERT INTO portal_tap_output
SELECT extensions.is((SELECT count(*) FROM public.organization_invites), 2::bigint, 'coordinator sees own organization invitations');

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
  'coordinator can access an active agent in the same organization'
);
INSERT INTO portal_tap_output
SELECT extensions.ok(
  NOT COALESCE(private.portal_agent_allowed(
    '52000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000005',
    '51000000-0000-4000-8000-000000000002'
  ), false),
  'coordinator cannot authorize an identity outside the organization'
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

INSERT INTO portal_tap_output SELECT * FROM extensions.finish();
SELECT jsonb_agg(line) AS tap_results FROM portal_tap_output;
ROLLBACK;
