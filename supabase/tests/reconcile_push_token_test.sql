BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(5);

-- 1. public.users owns the "fcmToken" text column recovered as an operational
--    dependency by the reconcile migration (consumed by update_my_push_token,
--    the notification Edge Functions and get_push_token_by_uid).
SELECT col_type_is('public', 'users', 'fcmToken', 'text', 'public.users has fcmToken text column');

-- 2. The recovered RPC exists on a clean catalog after the reset.
SELECT extensions.ok(
  to_regprocedure('public.get_push_token_by_uid(uuid)') IS NOT NULL,
  'get_push_token_by_uid exists after reset'
);

-- 3. anon must never resolve another user's push token.
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.get_push_token_by_uid(uuid)', 'EXECUTE'),
  'anon cannot execute get_push_token_by_uid'
);

-- 4. authenticated must never resolve another user's push token either.
SELECT extensions.ok(
  NOT has_function_privilege('authenticated', 'public.get_push_token_by_uid(uuid)', 'EXECUTE'),
  'authenticated cannot execute get_push_token_by_uid'
);

-- 5. service_role retains EXECUTE so the notify-expiring-tokens Edge Function
--    can resolve device tokens server-side.
SELECT extensions.ok(
  has_function_privilege('service_role', 'public.get_push_token_by_uid(uuid)', 'EXECUTE'),
  'service_role can execute get_push_token_by_uid'
);

SELECT * FROM extensions.finish();
ROLLBACK;
