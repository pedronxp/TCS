BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(4);
SELECT extensions.ok(NOT has_function_privilege('anon', 'public.list_operational_users(text,text,boolean,integer,integer)', 'EXECUTE'), 'operational directory is not anonymous');
SELECT extensions.ok(has_function_privilege('authenticated', 'public.list_operational_users(text,text,boolean,integer,integer)', 'EXECUTE'), 'operational directory is authenticated');
SELECT extensions.ok(NOT has_function_privilege('anon', 'public.get_operational_user(uuid)', 'EXECUTE'), 'operational user detail is not anonymous');
SELECT extensions.ok(has_function_privilege('authenticated', 'public.get_operational_user(uuid)', 'EXECUTE'), 'operational user detail is authenticated');
SELECT * FROM extensions.finish();
ROLLBACK;
