BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(2);
SELECT extensions.ok(CASE WHEN to_regprocedure('public.create_training_class(text,text,integer,timestamp with time zone,timestamp with time zone)') IS NULL THEN false ELSE NOT has_function_privilege('anon','public.create_training_class(text,text,integer,timestamp with time zone,timestamp with time zone)','EXECUTE') END, 'training class creation is not anonymous');
SELECT extensions.ok(CASE WHEN to_regprocedure('public.close_training_class(uuid)') IS NULL THEN false ELSE NOT has_function_privilege('anon','public.close_training_class(uuid)','EXECUTE') END, 'training class closure is not anonymous');
SELECT * FROM extensions.finish(); ROLLBACK;
