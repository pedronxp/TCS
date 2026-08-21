-- Recursos da investigação são entregues apenas por URLs temporárias emitidas
-- pela Edge Function. A RPC nunca expõe caminhos de storage na consulta comum.

CREATE OR REPLACE FUNCTION public.authorize_internal_protocol_resource(
  p_inspection_id uuid,
  p_kind text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v public.vistorias%ROWTYPE;
  v_customer_key text;
  v_path text;
  v_resources jsonb := '[]'::jsonb;
  v_raw_photo text;
  v_bucket text;
  v_photo_path text;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_internal_permission('protocol.read') THEN
    RAISE EXCEPTION 'protocol_registry_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF p_kind NOT IN ('laudo', 'photo') THEN
    RAISE EXCEPTION 'unsupported_protocol_resource' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v FROM public.vistorias WHERE id = p_inspection_id;
  IF v.id IS NULL OR v.protocolo IS NULL THEN
    RAISE EXCEPTION 'protocol_inspection_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_customer_key := CASE
    WHEN v.organization_id IS NULL THEN 'user:' || v."agenteUid"
    ELSE 'organization:' || v.organization_id
  END;
  IF NOT private.can_access_sensitive_customer(v_customer_key) THEN
    RAISE EXCEPTION 'sensitive_support_access_required' USING ERRCODE = '42501';
  END IF;

  IF p_kind = 'laudo' THEN
    IF v.laudo_gerado_em IS NULL OR v.laudo_url IS NULL THEN
      RAISE EXCEPTION 'document_not_found' USING ERRCODE = 'P0002';
    END IF;
    v_path := CASE
      WHEN v.laudo_url LIKE 'laudos:%' THEN substring(v.laudo_url FROM char_length('laudos:') + 1)
      ELSE substring(v.laudo_url FROM '/object/(?:sign|authenticated|public)/laudos/([^?]+)')
    END;
    v_path := coalesce(
      nullif(v_path, ''),
      concat_ws('/', coalesce(nullif(v.municipio, ''), nullif(v.municipio_agente, ''), 'geral'), v.id || '.pdf')
    );
    IF v_path = '' OR v_path LIKE '/%' OR string_to_array(v_path, '/') @> ARRAY['..']
      OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'laudos' AND name = v_path) THEN
      RAISE EXCEPTION 'document_file_missing' USING ERRCODE = 'P0002';
    END IF;
    v_resources := jsonb_build_array(jsonb_build_object(
      'bucket', 'laudos', 'path', v_path,
      'filename', coalesce(v.protocolo, v.id::text) || '.pdf'
    ));
  ELSE
    FOR v_raw_photo IN
      SELECT DISTINCT value
      FROM (
        SELECT unnest(coalesce(v."fotosUrls", ARRAY[]::text[])) AS value
        UNION ALL
        SELECT v."fotoUrl"
      ) photos
      WHERE value IS NOT NULL AND btrim(value) <> ''
    LOOP
      v_bucket := CASE WHEN position(':' IN v_raw_photo) > 0 THEN split_part(v_raw_photo, ':', 1) ELSE 'fotos' END;
      v_photo_path := CASE WHEN position(':' IN v_raw_photo) > 0 THEN substring(v_raw_photo FROM position(':' IN v_raw_photo) + 1) ELSE v_raw_photo END;
      IF v_bucket = 'fotos' AND v_photo_path <> '' AND v_photo_path NOT LIKE '/%'
        AND NOT string_to_array(v_photo_path, '/') @> ARRAY['..']
        AND EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'fotos' AND name = v_photo_path) THEN
        v_resources := v_resources || jsonb_build_array(jsonb_build_object(
          'bucket', 'fotos', 'path', v_photo_path,
          'filename', regexp_replace(v_photo_path, '^.*/', '')
        ));
      END IF;
    END LOOP;
    IF jsonb_array_length(v_resources) = 0 THEN
      RAISE EXCEPTION 'photo_not_found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, metadata)
  VALUES (
    auth.uid(), private.current_internal_role(auth.uid()), 'protocol.resource.authorize',
    'inspection_resource', v.id::text, 'allowed',
    jsonb_build_object('protocol', v.protocolo, 'kind', p_kind, 'resource_count', jsonb_array_length(v_resources))
  );
  RETURN jsonb_build_object('kind', p_kind, 'expires_in', 60, 'resources', v_resources);
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_internal_protocol_resource(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authorize_internal_protocol_resource(uuid, text) TO authenticated;
NOTIFY pgrst, 'reload schema';
