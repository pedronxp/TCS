BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(4);
SELECT extensions.ok(CASE WHEN to_regprocedure('public.update_inspection_media(uuid,text,text[])') IS NULL THEN false ELSE NOT has_function_privilege('anon','public.update_inspection_media(uuid,text,text[])','EXECUTE') END, 'inspection media changes are not anonymous');
SELECT extensions.ok(CASE WHEN to_regprocedure('public.mark_inspection_document_generated(uuid,text)') IS NULL THEN false ELSE NOT has_function_privilege('anon','public.mark_inspection_document_generated(uuid,text)','EXECUTE') END, 'inspection document markers are not anonymous');
SELECT extensions.ok(CASE WHEN to_regprocedure('public.delete_operational_inspection(uuid,text)') IS NULL THEN false ELSE NOT has_function_privilege('anon','public.delete_operational_inspection(uuid,text)','EXECUTE') END, 'inspection deletion is not anonymous');
SELECT extensions.ok(NOT has_function_privilege('anon','public.finalize_inspection_laudo_generation(uuid,text,timestamp with time zone)','EXECUTE'), 'laudo finalization is not anonymous');
SELECT * FROM extensions.finish(); ROLLBACK;
