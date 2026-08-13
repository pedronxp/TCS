BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(3);
SELECT extensions.ok(to_regprocedure('public.get_my_user_profile()') IS NOT NULL, 'self profile RPC exists');
SELECT extensions.ok(NOT has_function_privilege('anon', 'public.get_my_user_profile()', 'EXECUTE'), 'self profile RPC is not anonymous');
SELECT extensions.ok(has_function_privilege('authenticated', 'public.get_my_user_profile()', 'EXECUTE'), 'authenticated users may render their own profile');
SELECT * FROM extensions.finish();
ROLLBACK;
