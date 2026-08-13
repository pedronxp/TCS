BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(2);
SELECT extensions.ok(CASE WHEN to_regprocedure('public.save_municipio_risk_config(jsonb)') IS NULL THEN false ELSE NOT has_function_privilege('anon', 'public.save_municipio_risk_config(jsonb)', 'EXECUTE') END, 'risk configuration save is not anonymous');
SELECT extensions.ok(CASE WHEN to_regprocedure('public.reset_municipio_risk_config()') IS NULL THEN false ELSE NOT has_function_privilege('anon', 'public.reset_municipio_risk_config()', 'EXECUTE') END, 'risk configuration reset is not anonymous');
SELECT * FROM extensions.finish(); ROLLBACK;
