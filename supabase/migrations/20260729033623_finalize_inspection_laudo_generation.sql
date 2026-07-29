-- Finalize generated laudos through a tightly scoped SECURITY DEFINER RPC.
-- Direct service-role updates to vistorias execute an invoker trigger in the
-- private schema and therefore fail after the PDF has already been uploaded.

CREATE OR REPLACE FUNCTION public.finalize_inspection_laudo_generation(
  p_inspection_id uuid,
  p_storage_path text,
  p_generated_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inspection public.vistorias;
  expected_path text;
  effective_generated_at timestamptz := coalesce(p_generated_at, now());
BEGIN
  SELECT * INTO inspection
  FROM public.vistorias
  WHERE id = p_inspection_id
  FOR UPDATE;

  IF inspection.id IS NULL THEN
    RAISE EXCEPTION 'inspection_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF inspection.status IS DISTINCT FROM 'concluida' THEN
    RAISE EXCEPTION 'inspection_not_completed' USING ERRCODE = 'P0002';
  END IF;

  expected_path := CASE
    WHEN inspection.laudo_url LIKE 'laudos:%'
      THEN substring(inspection.laudo_url FROM char_length('laudos:') + 1)
    ELSE substring(
      inspection.laudo_url
      FROM '/object/(?:sign|authenticated|public)/laudos/([^?]+)'
    )
  END;
  expected_path := coalesce(
    nullif(expected_path, ''),
    concat_ws(
      '/',
      coalesce(nullif(inspection.municipio, ''), nullif(inspection.municipio_agente, ''), 'geral'),
      inspection.id || '.pdf'
    )
  );

  IF p_storage_path IS DISTINCT FROM expected_path
    OR p_storage_path = ''
    OR p_storage_path LIKE '/%'
    OR string_to_array(p_storage_path, '/') @> ARRAY['..']
  THEN
    RAISE EXCEPTION 'invalid_storage_path' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.objects
    WHERE bucket_id = 'laudos'
      AND name = p_storage_path
  ) THEN
    RAISE EXCEPTION 'document_file_missing' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.vistorias
  SET laudo_url = 'laudos:' || p_storage_path,
      laudo_gerado_em = effective_generated_at,
      storage_location = 'supabase'
  WHERE id = p_inspection_id;

  RETURN jsonb_build_object(
    'inspection_id', p_inspection_id,
    'path', p_storage_path,
    'generated_at', effective_generated_at,
    'document_status', 'available'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_inspection_laudo_generation(uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_inspection_laudo_generation(uuid, text, timestamptz)
  TO service_role;

COMMENT ON FUNCTION public.finalize_inspection_laudo_generation(uuid, text, timestamptz) IS
  'Finalizes laudo metadata only for an existing, expected Storage object; executable only by service_role.';

-- Repair files uploaded by an earlier generation attempt that failed during
-- the metadata update. The object path is deterministically tied to the row.
UPDATE public.vistorias v
SET laudo_url = 'laudos:' || o.name,
    laudo_gerado_em = coalesce(v.laudo_gerado_em, o.created_at, now()),
    storage_location = 'supabase'
FROM storage.objects o
WHERE o.bucket_id = 'laudos'
  AND v.status = 'concluida'
  AND o.name = concat_ws(
    '/',
    coalesce(nullif(v.municipio, ''), nullif(v.municipio_agente, ''), 'geral'),
    v.id || '.pdf'
  )
  AND (
    v.laudo_gerado_em IS NULL
    OR v.laudo_url IS NULL
    OR v.storage_location IS DISTINCT FROM 'supabase'
  );
