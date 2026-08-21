BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(5);
SELECT extensions.ok(CASE WHEN to_regprocedure('public.create_operational_form(text,text)') IS NULL THEN false ELSE NOT has_function_privilege('anon','public.create_operational_form(text,text)','EXECUTE') END, 'form creation is not anonymous');
SELECT extensions.ok(CASE WHEN to_regprocedure('public.set_operational_form_publication(uuid,boolean)') IS NULL THEN false ELSE NOT has_function_privilege('anon','public.set_operational_form_publication(uuid,boolean)','EXECUTE') END, 'form publication is not anonymous');
SELECT extensions.ok(CASE WHEN to_regprocedure('public.duplicate_operational_form(uuid)') IS NULL THEN false ELSE NOT has_function_privilege('anon','public.duplicate_operational_form(uuid)','EXECUTE') END, 'form duplication is not anonymous');
SELECT extensions.ok(CASE WHEN to_regprocedure('public.delete_operational_form(uuid)') IS NULL THEN false ELSE NOT has_function_privilege('anon','public.delete_operational_form(uuid)','EXECUTE') END, 'form deletion is not anonymous');
SELECT extensions.ok(CASE WHEN to_regprocedure('public.update_operational_form_questions(uuid,jsonb,text,jsonb)') IS NULL THEN false ELSE NOT has_function_privilege('anon','public.update_operational_form_questions(uuid,jsonb,text,jsonb)','EXECUTE') END, 'form questions are not writable anonymously');
SELECT * FROM extensions.finish(); ROLLBACK;
