BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(3);
SELECT extensions.ok(NOT has_function_privilege('anon', 'public.check_email_domain(text,text)', 'EXECUTE'), 'email domain helper is not public');
SELECT extensions.ok(has_function_privilege('anon', 'public.prepare_legacy_invite_signup(text,text)', 'EXECUTE'), 'invite claim remains the narrow public signup entrypoint');
SELECT extensions.ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.prepare_legacy_invite_signup(text,text)'::regprocedure), 'invite claim is server-controlled');
SELECT * FROM extensions.finish();
ROLLBACK;
