BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(30);

CREATE TEMP TABLE bootstrap_tap_output(line text);
CREATE TEMP TABLE bootstrap_results(label text PRIMARY KEY, payload jsonb);
GRANT SELECT, INSERT, UPDATE ON bootstrap_tap_output, bootstrap_results TO authenticated;

INSERT INTO auth.users(id, email, email_confirmed_at, raw_user_meta_data)
VALUES
  ('71000000-0000-4000-8000-000000000001', 'individual-bootstrap@example.test', now(), '{"name":"Individual Bootstrap"}'::jsonb),
  ('71000000-0000-4000-8000-000000000002', 'municipal-bootstrap@example.test', now(), '{"name":"Municipal Bootstrap"}'::jsonb),
  ('71000000-0000-4000-8000-000000000003', 'second-municipal@example.test', now(), '{"name":"Second Municipal"}'::jsonb),
  ('71000000-0000-4000-8000-000000000004', 'unverified-bootstrap@example.test', NULL, '{"name":"Unverified"}'::jsonb),
  ('71000000-0000-4000-8000-000000000005', 'reconcile-bootstrap@example.test', now(), '{"name":"Reconcile"}'::jsonb),
  ('71000000-0000-4000-8000-000000000006', 'audit-rollback@example.test', now(), '{"name":"Audit Rollback"}'::jsonb);

UPDATE public.subscription_settings
SET individual_bootstrap_enabled = true,
    municipal_bootstrap_enabled = true
WHERE singleton;
UPDATE public.plans
SET status = 'active'
WHERE code IN ('individual_basic', 'municipal_basic');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
INSERT INTO bootstrap_tap_output
SELECT extensions.is(
  public.get_customer_entry_context()->>'entry_state',
  'account_choice_required',
  'verified neutral identity starts at the server-side account choice'
);
INSERT INTO bootstrap_results(label, payload)
VALUES (
  'individual-first',
  public.bootstrap_individual_customer('individual-idempotency-0001', 'terms-2026-08')
);
INSERT INTO bootstrap_tap_output
SELECT extensions.is(
  (SELECT payload->>'account_kind' FROM bootstrap_results WHERE label = 'individual-first'),
  'individual',
  'individual bootstrap returns an individual context'
);
RESET ROLE;

INSERT INTO bootstrap_tap_output
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.users
    WHERE uid = '71000000-0000-4000-8000-000000000001'
      AND role = 'agent'
      AND "isApproved" = true
      AND municipio IS NULL
      AND organization_id IS NULL
  ),
  'individual bootstrap activates only the neutral agent profile'
);
INSERT INTO bootstrap_tap_output
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = '71000000-0000-4000-8000-000000000001'
      AND organization_id IS NULL
      AND status = 'trial'
      AND trial_ends_at BETWEEN now() + interval '13 days 23 hours' AND now() + interval '14 days 1 hour'
  ),
  'individual bootstrap creates the provisional 14-day trial'
);
INSERT INTO bootstrap_tap_output
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM private.customer_bootstrap_states
    WHERE user_id = '71000000-0000-4000-8000-000000000001'
      AND account_kind = 'individual'
      AND status = 'in_progress'
      AND current_step = 'configuration'
      AND checklist->>'identity' = 'true'
      AND checklist->>'configuration' = 'false'
  ),
  'individual activation preserves a resumable server-side onboarding checklist'
);
INSERT INTO bootstrap_tap_output
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.subscription_audit_events
    WHERE actor_id = '71000000-0000-4000-8000-000000000001'
      AND event_type = 'customer_bootstrap_completed'
  ),
  'individual bootstrap is audited in its transaction'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
INSERT INTO bootstrap_results(label, payload)
VALUES (
  'individual-retry',
  public.bootstrap_individual_customer('individual-idempotency-0001', 'terms-2026-08')
);
RESET ROLE;
INSERT INTO bootstrap_tap_output
SELECT extensions.is(
  (SELECT payload->'subscription'->>'id' FROM bootstrap_results WHERE label = 'individual-retry'),
  (SELECT payload->'subscription'->>'id' FROM bootstrap_results WHERE label = 'individual-first'),
  'individual retry returns the original customer context'
);
INSERT INTO bootstrap_tap_output
SELECT extensions.ok(
  (SELECT count(*) FROM public.subscriptions WHERE user_id = '71000000-0000-4000-8000-000000000001') = 1
  AND (SELECT count(*) FROM private.customer_bootstrap_states WHERE user_id = '71000000-0000-4000-8000-000000000001') = 1,
  'individual retry creates no duplicate state or subscription'
);
INSERT INTO bootstrap_tap_output
SELECT extensions.is(
  (SELECT count(*) FROM public.organization_members WHERE user_id = '71000000-0000-4000-8000-000000000001'),
  0::bigint,
  'individual bootstrap creates no municipal membership'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
INSERT INTO bootstrap_tap_output
SELECT extensions.throws_ok(
  $$
    SELECT public.bootstrap_municipal_customer(
      'municipal-forbidden-0001',
      '{"display_name":"Prefeitura Teste","municipality_name":"Nova Aurora Teste","state_code":"MG","responsible_name":"Responsável","terms_version":"terms-2026-08","internal_role":"owner"}'::jsonb
    )
  $$,
  '42501',
  'forbidden_authorization_field',
  'municipal bootstrap rejects client-supplied authorization fields'
);
INSERT INTO bootstrap_results(label, payload)
VALUES (
  'municipal-first',
  public.bootstrap_municipal_customer(
    'municipal-idempotency-0001',
    '{"display_name":"Prefeitura Nova Aurora","municipality_name":"Nova Aurora Teste","state_code":"MG","responsible_name":"Responsável Municipal","terms_version":"terms-2026-08"}'::jsonb
  )
);
INSERT INTO bootstrap_tap_output
SELECT extensions.ok(
  (SELECT payload->>'account_kind' = 'organization' FROM bootstrap_results WHERE label = 'municipal-first')
  AND (SELECT payload->'membership'->>'role' = 'owner' FROM bootstrap_results WHERE label = 'municipal-first'),
  'municipal bootstrap returns the first owner membership context'
);
RESET ROLE;

INSERT INTO bootstrap_tap_output
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = (
      SELECT organization_id FROM private.customer_bootstrap_states
      WHERE user_id = '71000000-0000-4000-8000-000000000002'
    )
      AND status = 'pilot'
      AND metadata->>'provisional' = 'true'
      AND metadata->>'contractually_active' = 'false'
  ),
  'self-service municipality is provisional pilot, not contractually active'
);
INSERT INTO bootstrap_tap_output
SELECT extensions.is(
  (
    SELECT count(*)
    FROM public.organization_members
    WHERE organization_id = (
      SELECT organization_id FROM private.customer_bootstrap_states
      WHERE user_id = '71000000-0000-4000-8000-000000000002'
    )
      AND role = 'owner'
      AND status = 'active'
  ),
  1::bigint,
  'municipal bootstrap creates exactly one first owner'
);
INSERT INTO bootstrap_tap_output
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.users
    WHERE uid = '71000000-0000-4000-8000-000000000002'
      AND role = 'admin'
      AND municipio = 'Nova Aurora Teste'
      AND "isApproved" = true
      AND organization_id IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.owner_admins
    WHERE user_id = '71000000-0000-4000-8000-000000000002'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.internal_staff
    WHERE user_id = '71000000-0000-4000-8000-000000000002'
  ),
  'mobile compatibility is populated without internal TCS authority'
);
INSERT INTO bootstrap_tap_output
SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.organization_onboarding AS onboarding
    JOIN private.customer_bootstrap_states AS state
      ON state.organization_id = onboarding.organization_id
    WHERE state.user_id = '71000000-0000-4000-8000-000000000002'
      AND state.current_step = 'team'
      AND onboarding.checklist->>'identity' = 'true'
      AND onboarding.checklist->>'team' = 'false'
  ),
  'municipal checklist resumes at team setup'
);
INSERT INTO bootstrap_tap_output
SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.subscriptions AS subscription
    JOIN private.customer_bootstrap_states AS state
      ON state.organization_id = subscription.organization_id
    WHERE state.user_id = '71000000-0000-4000-8000-000000000002'
      AND subscription.status = 'trial'
      AND subscription.trial_ends_at BETWEEN now() + interval '29 days 23 hours' AND now() + interval '30 days 1 hour'
  ),
  'municipal bootstrap creates the provisional 30-day trial'
);
INSERT INTO bootstrap_tap_output
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM private.customer_bootstrap_states
    WHERE user_id = '71000000-0000-4000-8000-000000000002'
      AND account_kind = 'organization'
      AND status = 'in_progress'
      AND municipality_key = 'nova aurora teste:mg'
  ),
  'municipal onboarding state is persisted by account'
);
INSERT INTO bootstrap_tap_output
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.subscription_audit_events
    WHERE actor_id = '71000000-0000-4000-8000-000000000002'
      AND event_type = 'first_organization_administrator_created'
      AND metadata->>'membership_role' = 'owner'
  ),
  'first organization administrator is audited atomically'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
INSERT INTO bootstrap_results(label, payload)
VALUES (
  'municipal-retry',
  public.bootstrap_municipal_customer(
    'municipal-idempotency-0001',
    '{"display_name":"Prefeitura Nova Aurora","municipality_name":"Nova Aurora Teste","state_code":"MG","responsible_name":"Responsável Municipal","terms_version":"terms-2026-08"}'::jsonb
  )
);
RESET ROLE;
INSERT INTO bootstrap_tap_output
SELECT extensions.is(
  (SELECT payload->'organization'->>'id' FROM bootstrap_results WHERE label = 'municipal-retry'),
  (SELECT payload->'organization'->>'id' FROM bootstrap_results WHERE label = 'municipal-first'),
  'municipal retry resolves to the original organization'
);
INSERT INTO bootstrap_tap_output
SELECT extensions.ok(
  (SELECT count(*) FROM private.customer_bootstrap_states WHERE user_id = '71000000-0000-4000-8000-000000000002') = 1
  AND (
    SELECT count(*) FROM public.organization_members
    WHERE user_id = '71000000-0000-4000-8000-000000000002'
  ) = 1,
  'municipal retry creates no duplicate state or first owner'
);

UPDATE public.organization_members
SET status = 'suspended'
WHERE user_id = '71000000-0000-4000-8000-000000000002';
INSERT INTO bootstrap_tap_output
SELECT extensions.is(
  (SELECT "isApproved" FROM public.users WHERE uid = '71000000-0000-4000-8000-000000000002'),
  false,
  'suspending authoritative membership closes legacy mobile approval'
);
UPDATE public.organization_members
SET status = 'active'
WHERE user_id = '71000000-0000-4000-8000-000000000002';
INSERT INTO bootstrap_tap_output
SELECT extensions.is(
  (SELECT "isApproved" FROM public.users WHERE uid = '71000000-0000-4000-8000-000000000002'),
  true,
  'reactivating authoritative membership restores compatible mobile access'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
INSERT INTO bootstrap_tap_output
SELECT extensions.throws_ok(
  $$
    SELECT public.bootstrap_municipal_customer(
      'municipal-idempotency-0002',
      '{"display_name":"Outra Prefeitura","municipality_name":"Nova Aurora Teste","state_code":"MG","responsible_name":"Outro Responsável","terms_version":"terms-2026-08"}'::jsonb
    )
  $$,
  '23505',
  'municipality_onboarding_exists_use_invitation',
  'an existing municipality directs later administrators to invitation'
);
RESET ROLE;
INSERT INTO bootstrap_tap_output
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = '71000000-0000-4000-8000-000000000003'
  )
  AND NOT EXISTS (
    SELECT 1 FROM private.customer_bootstrap_states
    WHERE user_id = '71000000-0000-4000-8000-000000000003'
  ),
  'denied second first-admin request leaves no partial privilege'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-4000-8000-000000000004","role":"authenticated"}',
  true
);
INSERT INTO bootstrap_tap_output
SELECT extensions.throws_ok(
  $$ SELECT public.bootstrap_individual_customer('unverified-idempotency-01', 'terms-2026-08') $$,
  '42501',
  'verified_email_required',
  'unverified identity cannot bootstrap a customer'
);
RESET ROLE;

DELETE FROM public.users
WHERE uid = '71000000-0000-4000-8000-000000000005';
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-4000-8000-000000000005","role":"authenticated"}',
  true
);
INSERT INTO bootstrap_results(label, payload)
VALUES ('reconciled', public.reconcile_customer_identity());
RESET ROLE;
INSERT INTO bootstrap_tap_output
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.users
    WHERE uid = '71000000-0000-4000-8000-000000000005'
      AND role = 'agent'
      AND "isApproved" = false
      AND organization_id IS NULL
  ),
  'identity reconciliation recreates only a neutral pending profile'
);

CREATE OR REPLACE FUNCTION pg_temp.force_authoritative_audit_failure()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.event_type = 'individual_customer_bootstrapped' THEN
    RAISE EXCEPTION 'forced_audit_failure' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER force_authoritative_audit_failure
BEFORE INSERT ON public.subscription_audit_events
FOR EACH ROW EXECUTE FUNCTION pg_temp.force_authoritative_audit_failure();

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-4000-8000-000000000006","role":"authenticated"}',
  true
);
INSERT INTO bootstrap_tap_output
SELECT extensions.throws_ok(
  $$ SELECT public.bootstrap_individual_customer('audit-rollback-0001', 'terms-2026-08') $$,
  'P0001',
  'forced_audit_failure',
  'critical bootstrap aborts when its authoritative audit cannot be written'
);
RESET ROLE;
DROP TRIGGER force_authoritative_audit_failure ON public.subscription_audit_events;

INSERT INTO bootstrap_tap_output
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM private.customer_bootstrap_states
    WHERE user_id = '71000000-0000-4000-8000-000000000006'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = '71000000-0000-4000-8000-000000000006'
  )
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE uid = '71000000-0000-4000-8000-000000000006'
      AND "isApproved" = false
      AND organization_id IS NULL
  ),
  'audit failure leaves no approved profile, subscription or bootstrap state'
);

INSERT INTO bootstrap_tap_output
SELECT extensions.ok(
  pg_get_functiondef('public.bootstrap_municipal_customer(text,jsonb)'::regprocedure)
    NOT LIKE '%INSERT INTO public.owner_admins%'
  AND pg_get_functiondef('public.bootstrap_municipal_customer(text,jsonb)'::regprocedure)
    NOT LIKE '%INSERT INTO public.internal_staff%',
  'public bootstrap implementation contains no internal authorization write'
);
INSERT INTO bootstrap_tap_output
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.bootstrap_individual_customer(text,text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.bootstrap_municipal_customer(text,jsonb)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.get_customer_entry_context()', 'EXECUTE'),
  'anonymous clients cannot invoke customer bootstrap or read customer context'
);

SELECT line FROM bootstrap_tap_output;
SELECT * FROM extensions.finish();
ROLLBACK;
