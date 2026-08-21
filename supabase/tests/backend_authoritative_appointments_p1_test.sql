BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(3);
SELECT extensions.ok(CASE WHEN to_regprocedure('public.upsert_operational_appointment(jsonb)') IS NULL THEN false ELSE NOT has_function_privilege('anon', 'public.upsert_operational_appointment(jsonb)', 'EXECUTE') END, 'appointment writes are not anonymous');
SELECT extensions.ok(CASE WHEN to_regprocedure('public.transition_operational_appointment(uuid,text,uuid)') IS NULL THEN false ELSE NOT has_function_privilege('anon', 'public.transition_operational_appointment(uuid,text,uuid)', 'EXECUTE') END, 'appointment transitions are not anonymous');
SELECT extensions.ok(CASE WHEN to_regprocedure('public.delete_operational_appointment(uuid)') IS NULL THEN false ELSE NOT has_function_privilege('anon', 'public.delete_operational_appointment(uuid)', 'EXECUTE') END, 'appointment deletion is not anonymous');
SELECT * FROM extensions.finish();
ROLLBACK;
