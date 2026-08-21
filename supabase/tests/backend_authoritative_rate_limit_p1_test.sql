BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(8);

-- The authoritative rate-limit RPC is server-owned and authenticated-only.
SELECT extensions.ok(NOT has_function_privilege('anon', 'public.enforce_my_operational_rate_limit(text)', 'EXECUTE'), 'authoritative rate limit is not anonymous');
SELECT extensions.ok(has_function_privilege('authenticated', 'public.enforce_my_operational_rate_limit(text)', 'EXECUTE'), 'authoritative rate limit is authenticated');

-- Legacy caller-chosen check_rate_limit must not be exposed to browsers. Pass
-- when absent from the catalog; when present on a legacy catalog, enforce that
-- neither anon nor authenticated can execute it.
SELECT extensions.ok(
  CASE WHEN to_regprocedure('public.check_rate_limit(uuid, text, integer, integer)') IS NULL THEN true
       ELSE NOT has_function_privilege('anon', 'public.check_rate_limit(uuid, text, integer, integer)', 'EXECUTE') END,
  'anon cannot execute legacy check_rate_limit when present'
);
SELECT extensions.ok(
  CASE WHEN to_regprocedure('public.check_rate_limit(uuid, text, integer, integer)') IS NULL THEN true
       ELSE NOT has_function_privilege('authenticated', 'public.check_rate_limit(uuid, text, integer, integer)', 'EXECUTE') END,
  'authenticated cannot execute legacy check_rate_limit when present'
);

-- get_my_role is absent from the versioned history on this branch. Pass when
-- missing; when present on a legacy catalog, enforce that anon cannot execute it.
SELECT extensions.ok(
  CASE WHEN to_regprocedure('public.get_my_role()') IS NULL THEN true
       ELSE NOT has_function_privilege('anon', 'public.get_my_role()', 'EXECUTE') END,
  'anonymous callers cannot query a role helper when present'
);

-- public.rate_limits is a hard runtime dependency of the authoritative
-- enforce_my_operational_rate_limit RPC and must exist after reconciliation.
SELECT extensions.is(to_regclass('public.rate_limits'), 'public.rate_limits'::regclass, 'rate_limits table exists');

SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'rate_limits'
      AND con.conname = 'rate_limits_pkey'
      AND pg_get_constraintdef(con.oid, true) = 'PRIMARY KEY (uid, action, window_start)'
  ),
  'rate_limits has primary key rate_limits_pkey (uid, action, window_start)'
);

SELECT extensions.is(
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.rate_limits'::regclass
  ),
  true,
  'rate_limits has row level security enabled'
);

SELECT * FROM extensions.finish();
ROLLBACK;
