BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(4);
SELECT extensions.ok(NOT has_function_privilege('anon', 'public.enforce_my_operational_rate_limit(text)', 'EXECUTE'), 'authoritative rate limit is not anonymous');
SELECT extensions.ok(has_function_privilege('authenticated', 'public.enforce_my_operational_rate_limit(text)', 'EXECUTE'), 'authoritative rate limit is authenticated');
SELECT extensions.ok(NOT has_function_privilege('authenticated', 'public.check_rate_limit(uuid,text,integer,integer)', 'EXECUTE'), 'legacy caller-chosen rate limit is unavailable');
SELECT extensions.ok(NOT has_function_privilege('anon', 'public.get_my_role()', 'EXECUTE'), 'anonymous callers cannot query a role helper');
SELECT * FROM extensions.finish();
ROLLBACK;
