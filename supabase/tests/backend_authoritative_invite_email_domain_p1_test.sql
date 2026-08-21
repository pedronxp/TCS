BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(4);
-- check_email_domain is absent from the versioned history. The test passes when
-- the RPC is missing (no oracle to harden); when present on a legacy catalog,
-- neither anon nor authenticated may have EXECUTE (the conditional revoke in the
-- migration revokes PUBLIC, anon and authenticated), mirroring the P0 pattern
-- for consumir_token/master_delete_user.
SELECT extensions.ok(
  CASE WHEN to_regprocedure('public.check_email_domain(text,text)') IS NULL THEN true
       ELSE NOT has_function_privilege('anon', 'public.check_email_domain(text,text)', 'EXECUTE') END,
  'anon cannot execute check_email_domain when present'
);
SELECT extensions.ok(
  CASE WHEN to_regprocedure('public.check_email_domain(text,text)') IS NULL THEN true
       ELSE NOT has_function_privilege('authenticated', 'public.check_email_domain(text,text)', 'EXECUTE') END,
  'authenticated cannot execute check_email_domain when present'
);
SELECT extensions.ok(has_function_privilege('anon', 'public.prepare_legacy_invite_signup(text,text)', 'EXECUTE'), 'invite claim remains the narrow public signup entrypoint');
SELECT extensions.ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.prepare_legacy_invite_signup(text,text)'::regprocedure), 'invite claim is server-controlled');
SELECT * FROM extensions.finish();
ROLLBACK;
