-- Apply the same PL/pgSQL result-variable correction to mutations introduced
-- before the final console migration.
DO $$
DECLARE
  function_name regprocedure;
  definition text;
BEGIN
  FOREACH function_name IN ARRAY ARRAY[
    'public.mutate_internal_organization(text,text,jsonb,text,uuid)'::regprocedure,
    'public.mutate_internal_subscription(text,text,text,jsonb,text,uuid)'::regprocedure,
    'public.finalize_internal_individual_provisioning(uuid,text,text,text,text,uuid)'::regprocedure
  ] LOOP
    SELECT pg_get_functiondef(function_name) INTO definition;
    IF definition NOT LIKE '%v_result jsonb%' THEN
      definition := replace(definition, E'\n  result jsonb;', E'\n  v_result jsonb;');
      definition := replace(definition, 'result := jsonb_build_object', 'v_result := jsonb_build_object');
      definition := replace(definition, 'result = result', 'result = v_result');
      definition := replace(definition, 'RETURN result;', 'RETURN v_result;');
      EXECUTE definition;
    END IF;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
