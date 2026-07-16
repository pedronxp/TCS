-- Repair the four already-deployed functions while keeping their complete
-- definitions in the original migrations correct for clean installations.
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
    definition := replace(definition, 'request_hash text', 'v_request_hash text');
    definition := replace(definition, 'request_hash:=', 'v_request_hash:=');
    definition := replace(definition, 'request_hash :=', 'v_request_hash :=');
    definition := replace(definition, 'io.request_hash=request_hash', 'io.request_hash=v_request_hash');
    definition := replace(definition, ',request_hash);', ',v_request_hash);');
    EXECUTE definition;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
