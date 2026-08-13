-- Accept only the short-lived, server-issued laudo path for the authenticated
-- owner/admin in addition to the legacy path used by historic inspections.
CREATE OR REPLACE FUNCTION public.finalize_inspection_laudo_generation(
  p_inspection_id uuid,
  p_storage_path text,
  p_generated_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  inspection public.vistorias;
  app_profile public.users;
  expected_path text;
  scoped_path text;
  effective_generated_at timestamptz := coalesce(p_generated_at, now());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
  SELECT * INTO inspection FROM public.vistorias WHERE id=p_inspection_id FOR UPDATE;
  IF inspection.id IS NULL OR inspection.status IS DISTINCT FROM 'concluida' THEN RAISE EXCEPTION 'inspection_not_completed' USING ERRCODE='P0002'; END IF;
  SELECT * INTO app_profile FROM public.users WHERE uid=auth.uid();
  IF inspection."agenteUid"::text IS DISTINCT FROM auth.uid()::text
    AND NOT (app_profile."isApproved" IS TRUE AND (app_profile.role='master_admin' OR (app_profile.role='admin' AND nullif(app_profile.municipio,'') IS NOT DISTINCT FROM coalesce(nullif(inspection.municipio,''),nullif(inspection.municipio_agente,''))))) THEN
    RAISE EXCEPTION 'inspection_document_generation_not_allowed' USING ERRCODE='42501';
  END IF;
  expected_path := coalesce(nullif(CASE WHEN inspection.laudo_url LIKE 'laudos:%' THEN substring(inspection.laudo_url FROM 8) ELSE substring(inspection.laudo_url FROM '/object/(?:sign|authenticated|public)/laudos/([^?]+)') END,''),concat_ws('/',coalesce(nullif(inspection.municipio,''),nullif(inspection.municipio_agente,''),'geral'),inspection.id || '.pdf'));
  scoped_path := concat_ws('/', 'users', auth.uid()::text, coalesce(nullif(inspection.municipio,''),nullif(inspection.municipio_agente,''),'geral'), inspection.id || '.pdf');
  IF p_storage_path NOT IN (expected_path, scoped_path) OR p_storage_path='' OR p_storage_path LIKE '/%' OR string_to_array(p_storage_path,'/') @> ARRAY['..'] THEN RAISE EXCEPTION 'invalid_storage_path' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='laudos' AND name=p_storage_path) THEN RAISE EXCEPTION 'document_file_missing' USING ERRCODE='P0002'; END IF;
  UPDATE public.vistorias SET laudo_url='laudos:'||p_storage_path,laudo_gerado_em=effective_generated_at,storage_location='supabase' WHERE id=p_inspection_id;
  RETURN jsonb_build_object('inspection_id',p_inspection_id,'path',p_storage_path,'generated_at',effective_generated_at,'document_status','available');
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_inspection_laudo_generation(uuid,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finalize_inspection_laudo_generation(uuid,text,timestamptz) TO authenticated;
