-- PL/pgSQL also treats an unqualified `result=result` assignment as
-- ambiguous. Rename the local result variable in the already-deployed
-- idempotent mutations.
DO $$
DECLARE
  function_name regprocedure;
  definition text;
BEGIN
  FOREACH function_name IN ARRAY ARRAY[
    'public.mutate_internal_plan(uuid,jsonb,jsonb,jsonb,jsonb,jsonb,text,uuid)'::regprocedure,
    'public.mutate_internal_form(text,text,jsonb,text,uuid)'::regprocedure,
    'public.mutate_internal_risk_config(text,text,jsonb,integer,text,uuid)'::regprocedure,
    'public.mutate_internal_release(text,text,text,text,uuid)'::regprocedure
  ] LOOP
    SELECT pg_get_functiondef(function_name) INTO definition;
    definition := replace(definition, E'\n  result jsonb;', E'\n  v_result jsonb;');
    definition := replace(definition, '; result jsonb;', '; v_result jsonb;');
    definition := replace(definition, 'SELECT io.result INTO result', 'SELECT io.result INTO v_result');
    definition := replace(definition, 'IF result IS NOT NULL THEN RETURN result;', 'IF v_result IS NOT NULL THEN RETURN v_result;');
    definition := replace(definition, 'result:=jsonb_build_object', 'v_result:=jsonb_build_object');
    definition := replace(definition, 'result := jsonb_build_object', 'v_result := jsonb_build_object');
    definition := replace(definition, 'result=result', 'result=v_result');
    definition := replace(definition, 'RETURN result;', 'RETURN v_result;');
    EXECUTE definition;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
