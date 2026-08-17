BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(7);

SELECT extensions.ok(
  CASE WHEN to_regprocedure('public.update_my_display_name(text)') IS NULL THEN false
       ELSE NOT has_function_privilege('anon', 'public.update_my_display_name(text)', 'EXECUTE') END,
  'display-name mutation is server-owned and unavailable to anonymous callers'
);

SELECT extensions.ok(
  CASE WHEN to_regprocedure('public.update_my_phone(text)') IS NULL THEN false
       ELSE NOT has_function_privilege('anon', 'public.update_my_phone(text)', 'EXECUTE') END,
  'phone mutation is server-owned and unavailable to anonymous callers'
);

SELECT extensions.ok(
  CASE WHEN to_regprocedure('public.update_my_push_token(text)') IS NULL THEN false
       ELSE NOT has_function_privilege('anon', 'public.update_my_push_token(text)', 'EXECUTE') END,
  'device-token mutation is server-owned and unavailable to anonymous callers'
);

SELECT extensions.ok(
  to_regprocedure('public.set_user_approval(uuid,boolean)') IS NULL,
  'legacy approval bypass without reason/AAL2/operation_id cannot return'
);

SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.set_user_approval(uuid,boolean,text,uuid)', 'EXECUTE'),
  'audited approval transition cannot be invoked anonymously'
);

SELECT extensions.ok(
  CASE WHEN to_regprocedure('public.create_municipio(text,text,text)') IS NULL THEN false
       ELSE NOT has_function_privilege('anon', 'public.create_municipio(text,text,text)', 'EXECUTE') END,
  'municipality creation is server-owned and unavailable to anonymous callers'
);

SELECT extensions.ok(
  CASE WHEN to_regprocedure('public.set_municipio_email_domains(text,text[])') IS NULL THEN false
       ELSE NOT has_function_privilege('anon', 'public.set_municipio_email_domains(text,text[])', 'EXECUTE') END,
  'municipality email-domain configuration is server-owned and unavailable to anonymous callers'
);

SELECT * FROM extensions.finish();
ROLLBACK;
