BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(2);

SELECT extensions.ok(
  CASE WHEN to_regprocedure('public.create_legacy_invite_token(text,text,integer)') IS NULL THEN false
       ELSE NOT has_function_privilege('anon', 'public.create_legacy_invite_token(text,text,integer)', 'EXECUTE') END,
  'invite creation is server-owned and unavailable to anonymous callers'
);

SELECT extensions.ok(
  CASE WHEN to_regprocedure('public.cancel_legacy_invite_tokens(text[])') IS NULL THEN false
       ELSE NOT has_function_privilege('anon', 'public.cancel_legacy_invite_tokens(text[])', 'EXECUTE') END,
  'invite cancellation is server-owned and unavailable to anonymous callers'
);

SELECT * FROM extensions.finish();
ROLLBACK;
