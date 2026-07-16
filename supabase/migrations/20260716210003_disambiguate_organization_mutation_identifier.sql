DO $$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.mutate_internal_organization(text,text,jsonb,text,uuid)'::regprocedure) INTO definition;
  definition := replace(definition, E'\n  organization_id uuid;', E'\n  v_organization_id uuid;');
  definition := replace(definition, 'BEGIN organization_id := p_organization_id::uuid;', 'BEGIN v_organization_id := p_organization_id::uuid;');
  definition := replace(definition, 'WHERE id = organization_id FOR UPDATE', 'WHERE id = v_organization_id FOR UPDATE');
  definition := replace(definition, 'WHERE id = organization_id RETURNING', 'WHERE id = v_organization_id RETURNING');
  EXECUTE definition;
END;
$$;

NOTIFY pgrst, 'reload schema';
