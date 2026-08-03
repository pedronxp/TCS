BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(10);

CREATE TEMP TABLE auth_capability_tap_output(line text);
GRANT SELECT, INSERT ON auth_capability_tap_output TO anon, authenticated;

SET LOCAL ROLE anon;
INSERT INTO auth_capability_tap_output
SELECT extensions.is(
  public.get_public_auth_capabilities()->>'google_auth',
  'false',
  'Google customer auth starts behind a disabled public flag'
);
INSERT INTO auth_capability_tap_output
SELECT extensions.is(
  public.get_public_auth_capabilities()->>'password_recovery',
  'false',
  'password recovery starts behind a disabled public flag'
);
INSERT INTO auth_capability_tap_output
SELECT extensions.is(
  (SELECT count(*) FROM jsonb_object_keys(public.get_public_auth_capabilities())),
  2::bigint,
  'public capability discovery exposes no customer or account data'
);
RESET ROLE;

INSERT INTO auth_capability_tap_output
SELECT extensions.ok(
  has_function_privilege('anon', 'public.get_public_auth_capabilities()', 'EXECUTE'),
  'anonymous entry screens can read only public auth flags'
);
INSERT INTO auth_capability_tap_output
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.record_password_recovery_completed(boolean)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.record_google_identity_reconciled()', 'EXECUTE'),
  'anonymous clients cannot forge completed identity events'
);

INSERT INTO auth.users(id, email, email_confirmed_at, raw_user_meta_data)
VALUES (
  '91000000-0000-4000-8000-000000000001',
  'recovery-audit@example.test',
  now(),
  '{}'::jsonb
);
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
INSERT INTO auth_capability_tap_output
SELECT extensions.ok(
  public.record_password_recovery_completed(true),
  'authenticated recovery session can record completion'
);
INSERT INTO auth_capability_tap_output
SELECT extensions.is(
  public.get_portal_access_context(),
  NULL::jsonb,
  'neutral identity receives no portal permission context'
);
INSERT INTO auth_capability_tap_output
SELECT extensions.throws_ok(
  $$ SELECT public.record_google_identity_reconciled() $$,
  '42501',
  'google_identity_required',
  'Google reconciliation event requires a real Google identity'
);
RESET ROLE;

INSERT INTO auth_capability_tap_output
SELECT extensions.ok(
  has_function_privilege('authenticated', 'public.get_portal_access_context()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.get_portal_access_context()', 'EXECUTE'),
  'guarded portal context remains authenticated-only'
);

INSERT INTO auth_capability_tap_output
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.subscription_audit_events
    WHERE actor_id = '91000000-0000-4000-8000-000000000001'
      AND event_type = 'password_recovery_completed'
      AND metadata->>'other_sessions_revoked' = 'true'
  ),
  'password recovery completion is persisted server-side'
);

SELECT line FROM auth_capability_tap_output;
SELECT * FROM extensions.finish();
ROLLBACK;
