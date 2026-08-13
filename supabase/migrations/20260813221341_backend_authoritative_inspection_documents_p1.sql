CREATE OR REPLACE FUNCTION public.update_inspection_media(
  p_inspection_id uuid,
  p_primary_photo text DEFAULT NULL,
  p_extra_photos text[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_role text;
  v_municipio text;
  v_path text;
  v_paths text[] := array_remove(array_prepend(p_primary_photo, coalesce(p_extra_photos, ARRAY[]::text[])), NULL);
BEGIN
  IF auth.uid() IS NULL OR p_inspection_id IS NULL OR cardinality(v_paths) > 8 THEN
    RAISE EXCEPTION 'invalid_inspection_media' USING ERRCODE = '22023';
  END IF;
  SELECT role, municipio INTO v_role, v_municipio FROM public.users WHERE uid=auth.uid() AND coalesce("isApproved",false);
  IF v_role IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  FOREACH v_path IN ARRAY v_paths LOOP
    IF v_path !~ '^fotos:[^/][^[:cntrl:]]*$' OR v_path LIKE '%..%' THEN
      RAISE EXCEPTION 'invalid_media_path' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='fotos' AND name=substring(v_path FROM 7)) THEN
      RAISE EXCEPTION 'media_file_missing' USING ERRCODE = 'P0002';
    END IF;
  END LOOP;
  UPDATE public.vistorias SET "fotoUrl"=p_primary_photo,"fotosUrls"=nullif(p_extra_photos,ARRAY[]::text[])
  WHERE id=p_inspection_id
    AND ("agenteUid"=auth.uid()::text OR v_role='master_admin' OR (v_role='admin' AND municipio=v_municipio));
  IF NOT FOUND THEN RAISE EXCEPTION 'inspection_not_found_or_forbidden' USING ERRCODE='42501'; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_inspection_document_generated(p_inspection_id uuid,p_document_type text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE v_role text;v_municipio text;v_generated_at timestamptz:=now();
BEGIN
  IF p_document_type NOT IN ('relatorio','termo') THEN RAISE EXCEPTION 'invalid_document_type' USING ERRCODE='22023'; END IF;
  SELECT role,municipio INTO v_role,v_municipio FROM public.users WHERE uid=auth.uid() AND coalesce("isApproved",false);
  UPDATE public.vistorias
  SET relatorio_gerado_em=CASE WHEN p_document_type='relatorio' THEN v_generated_at ELSE relatorio_gerado_em END,
      termo_gerado_em=CASE WHEN p_document_type='termo' THEN v_generated_at ELSE termo_gerado_em END
  WHERE id=p_inspection_id AND ("agenteUid"=auth.uid()::text OR v_role='master_admin' OR (v_role='admin' AND municipio=v_municipio));
  IF NOT FOUND THEN RAISE EXCEPTION 'inspection_not_found_or_forbidden' USING ERRCODE='42501'; END IF;
  RETURN v_generated_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_operational_inspection(p_inspection_id uuid,p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE v_role text; v_reason text:=btrim(coalesce(p_reason,''));
BEGIN
  SELECT role INTO v_role FROM public.users WHERE uid=auth.uid() AND coalesce("isApproved",false);
  IF v_role IS DISTINCT FROM 'master_admin' OR char_length(v_reason) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'forbidden_or_invalid_deletion_reason' USING ERRCODE='42501';
  END IF;
  DELETE FROM public.vistorias WHERE id=p_inspection_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'inspection_not_found' USING ERRCODE='P0002'; END IF;
END;
$function$;

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
  IF p_storage_path IS DISTINCT FROM expected_path OR p_storage_path='' OR p_storage_path LIKE '/%' OR string_to_array(p_storage_path,'/') @> ARRAY['..'] THEN RAISE EXCEPTION 'invalid_storage_path' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='laudos' AND name=p_storage_path) THEN RAISE EXCEPTION 'document_file_missing' USING ERRCODE='P0002'; END IF;
  UPDATE public.vistorias SET laudo_url='laudos:'||p_storage_path,laudo_gerado_em=effective_generated_at,storage_location='supabase' WHERE id=p_inspection_id;
  RETURN jsonb_build_object('inspection_id',p_inspection_id,'path',p_storage_path,'generated_at',effective_generated_at,'document_status','available');
END;
$function$;

REVOKE ALL ON FUNCTION public.update_inspection_media(uuid,text,text[]) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.mark_inspection_document_generated(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.delete_operational_inspection(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.finalize_inspection_laudo_generation(uuid,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_inspection_media(uuid,text,text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_inspection_document_generated(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_operational_inspection(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_inspection_laudo_generation(uuid,text,timestamptz) TO authenticated;
