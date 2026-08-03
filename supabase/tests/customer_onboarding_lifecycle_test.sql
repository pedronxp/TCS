BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(10);

SELECT extensions.ok(
  has_function_privilege('authenticated', 'public.update_customer_onboarding_checklist(text,boolean,uuid,text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.update_customer_onboarding_checklist(text,boolean,uuid,text)', 'EXECUTE'),
  'only authenticated customers can call the checklist RPC'
);
SELECT extensions.ok(
  has_function_privilege('authenticated', 'public.get_customer_onboarding_timeline()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.get_customer_onboarding_timeline()', 'EXECUTE'),
  'authoritative timeline is authenticated-only'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'public.subscription_audit_events', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.subscription_audit_events', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.subscription_audit_events', 'DELETE'),
  'customers cannot write authoritative audit rows directly'
);
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.subscription_audit_events'::regclass
      AND tgname = 'subscription_audit_events_append_only'
      AND NOT tgisinternal
  ),
  'authoritative audit has an append-only trigger'
);

INSERT INTO auth.users(id, email, email_confirmed_at, raw_user_meta_data)
VALUES ('93000000-0000-4000-8000-000000000001', 'lifecycle@example.test', now(), '{}'::jsonb);
UPDATE public.subscription_settings SET individual_bootstrap_enabled = true WHERE singleton;
UPDATE public.plans SET status = 'active' WHERE code = 'individual_basic';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"93000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SELECT public.bootstrap_individual_customer('lifecycle-individual-0001', 'terms-2026-08');

SELECT extensions.is(
  public.get_customer_entry_context()->>'lifecycle_state',
  'trial',
  'trial is distinct from definitive commercial activation'
);
SELECT extensions.is(
  public.get_customer_entry_context()#>>'{onboarding,current_step}',
  'configuration',
  'individual onboarding resumes at configuration'
);
SELECT extensions.throws_ok(
  $$ SELECT public.update_customer_onboarding_checklist('identity', true, gen_random_uuid(), 'web') $$,
  '42501',
  'onboarding_item_is_server_managed',
  'customer cannot forge server-managed checklist items'
);
SELECT extensions.lives_ok(
  $$ SELECT public.update_customer_onboarding_checklist('configuration', true, gen_random_uuid(), 'web') $$,
  'customer can complete the explicit configuration step'
);
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.subscription_audit_events
    WHERE actor_id = '93000000-0000-4000-8000-000000000001'
      AND event_type = 'customer_onboarding_item_updated'
      AND request_id IS NOT NULL
      AND source = 'web'
  ),
  'checklist update is audited inside the server transaction'
);
RESET ROLE;

SELECT extensions.throws_ok(
  $$ UPDATE public.subscription_audit_events SET outcome = 'failed' WHERE actor_id = '93000000-0000-4000-8000-000000000001' $$,
  '42501',
  'authoritative_audit_is_append_only',
  'authoritative events cannot be changed after insertion'
);

SELECT * FROM extensions.finish();
ROLLBACK;
