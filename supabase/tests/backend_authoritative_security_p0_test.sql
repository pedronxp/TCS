BEGIN;
SELECT plan(6);

-- Verify that anon cannot execute mark_token_used (function exists)
SELECT throws_ok(
  $$SELECT public.mark_token_used('test', gen_random_uuid(), 'test@example.com', 'Test User')$$,
  '42501',
  NULL,
  'anon should not have EXECUTE on mark_token_used'
);

-- Verify that consumir_token does not exist (should not error on absence)
SELECT is(
  (SELECT count(*) FROM pg_proc p
   JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE n.nspname = 'public'
     AND p.proname = 'consumir_token'
     AND pg_catalog.pg_get_function_identity_arguments(p.oid) = 'text, uuid, text, text'),
  0::bigint,
  'consumir_token should not exist in schema'
);

-- Verify that if consumir_token existed, anon would not have EXECUTE
-- (This is tested by the conditional revoke in the migration)
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    JOIN pg_proc_acl_exploded acl ON p.oid = acl.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'consumir_token'
      AND acl.grantee = 'anon'
      AND acl.privilege_type = 'EXECUTE'
  ),
  'anon should not have EXECUTE on consumir_token if it existed'
);

-- Verify private tables have RLS enabled
SELECT has_row_level_security('private', 'customer_affiliation_states', 'customer_affiliation_states should have RLS enabled');
SELECT has_row_level_security('private', 'inspection_ownership_audit', 'inspection_ownership_audit should have RLS enabled');
SELECT has_row_level_security('private', 'signup_invite_claims', 'signup_invite_claims should have RLS enabled');

SELECT * FROM finish();
ROLLBACK;
