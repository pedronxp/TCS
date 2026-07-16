BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(9);

INSERT INTO auth.users(id, email, raw_user_meta_data)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'coord-a@example.test', '{}'::jsonb),
  ('10000000-0000-4000-8000-000000000002', 'agent-b@example.test', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organizations(id, slug, display_name, municipality_name, status)
VALUES
  ('20000000-0000-4000-8000-000000000001', 'cataguases-test', 'Cataguases Teste', 'Cataguases', 'pilot'),
  ('20000000-0000-4000-8000-000000000002', 'uba-test', 'Ubá Teste', 'Ubá', 'pilot');

INSERT INTO public.organization_members(organization_id, user_id, role, status, joined_at)
VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'coordinator', 'active', now()),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'agent', 'active', now());

SELECT extensions.is(
  private.current_organization_id('10000000-0000-4000-8000-000000000001'),
  '20000000-0000-4000-8000-000000000001'::uuid,
  'membership resolves Cataguases organization server-side'
);
SELECT extensions.is(
  private.current_organization_id('10000000-0000-4000-8000-000000000002'),
  '20000000-0000-4000-8000-000000000002'::uuid,
  'membership resolves Uba organization server-side'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"30000000-0000-4000-8000-000000000001"}', true);
SELECT extensions.is((SELECT count(*) FROM public.organizations), 1::bigint, 'RLS exposes one organization only');
SELECT extensions.is((SELECT display_name FROM public.organizations), 'Cataguases Teste', 'RLS does not expose Uba');

CREATE TEMP TABLE invite_result AS SELECT public.create_organization_invite('agent', NULL, 72) AS payload;
SELECT extensions.ok((SELECT (payload->>'allowed')::boolean FROM invite_result), 'coordinator creates organization-scoped invite');

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"30000000-0000-4000-8000-000000000002"}', true);
SELECT extensions.is(
  (SELECT public.accept_organization_invite(payload->>'token')->>'reason' FROM invite_result),
  'already_member',
  'Cataguases invite cannot move a Uba member'
);

RESET ROLE;
INSERT INTO public.plan_features(plan_id, feature_code, enabled)
SELECT id, 'inspection_standard', true FROM public.plans WHERE code = 'compatibility';
INSERT INTO public.plan_limits(plan_id, resource_code, hard_limit, warning_percent)
SELECT id, 'inspections', 1, 80 FROM public.plans WHERE code = 'compatibility';
INSERT INTO public.subscriptions(plan_id, organization_id, status, current_period_start, current_period_end)
SELECT id, '20000000-0000-4000-8000-000000000001', 'active', date_trunc('month', now()), date_trunc('month', now()) + interval '1 month'
FROM public.plans WHERE code = 'compatibility';
UPDATE public.subscription_settings SET entitlement_enforcement_enabled = true WHERE singleton;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"30000000-0000-4000-8000-000000000001"}', true);
SELECT extensions.ok(public.has_subscription_feature('inspection_standard'), 'enabled feature is available');
SELECT extensions.ok((public.consume_subscription_usage('inspections', 1)->>'allowed')::boolean, 'last quota unit succeeds');
SELECT extensions.is((public.consume_subscription_usage('inspections', 1)->>'reason'), 'limit_reached', 'next quota unit is blocked');

SELECT * FROM extensions.finish();
ROLLBACK;
