-- Every concluded inspection must be represented in the document lifecycle.
-- A report can be available, waiting for generation, or marked as missing when
-- legacy metadata points to a file that no longer exists.

CREATE OR REPLACE FUNCTION public.authorize_inspection_laudo_generation(
  p_inspection_id uuid,
  p_customer_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inspection public.vistorias;
  app_profile public.users;
  customer_kind text;
  customer_target uuid;
  storage_path text;
  file_exists boolean;
  internal_request boolean := p_customer_id IS NOT NULL;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO inspection
  FROM public.vistorias
  WHERE id = p_inspection_id;

  IF inspection.id IS NULL THEN
    RAISE EXCEPTION 'inspection_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF inspection.status IS DISTINCT FROM 'concluida' THEN
    RAISE EXCEPTION 'inspection_not_completed' USING ERRCODE = 'P0002';
  END IF;

  IF internal_request THEN
    IF NOT private.has_internal_permission('customer.write', auth.uid())
      OR NOT private.can_access_sensitive_customer(p_customer_id, auth.uid())
    THEN
      RAISE EXCEPTION 'customer_document_generation_not_allowed' USING ERRCODE = '42501';
    END IF;

    customer_kind := split_part(p_customer_id, ':', 1);
    IF customer_kind NOT IN ('organization', 'user') THEN
      RAISE EXCEPTION 'invalid_customer_id';
    END IF;
    BEGIN
      customer_target := split_part(p_customer_id, ':', 2)::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'invalid_customer_id';
    END;

    IF NOT (
      (customer_kind = 'organization' AND inspection.organization_id = customer_target)
      OR (
        customer_kind = 'user'
        AND inspection.organization_id IS NULL
        AND inspection."agenteUid"::text = customer_target::text
      )
    ) THEN
      RAISE EXCEPTION 'inspection_customer_mismatch' USING ERRCODE = '42501';
    END IF;
  ELSE
    SELECT * INTO app_profile
    FROM public.users
    WHERE uid = auth.uid();

    IF inspection."agenteUid"::text IS DISTINCT FROM auth.uid()::text
      AND NOT (
        app_profile."isApproved" IS TRUE
        AND (
          app_profile.role = 'master_admin'
          OR (
            app_profile.role = 'admin'
            AND nullif(app_profile.municipio, '') IS NOT DISTINCT FROM
              coalesce(nullif(inspection.municipio, ''), nullif(inspection.municipio_agente, ''))
          )
        )
      )
    THEN
      RAISE EXCEPTION 'inspection_document_generation_not_allowed' USING ERRCODE = '42501';
    END IF;
  END IF;

  storage_path := CASE
    WHEN inspection.laudo_url LIKE 'laudos:%'
      THEN substring(inspection.laudo_url FROM char_length('laudos:') + 1)
    ELSE substring(
      inspection.laudo_url
      FROM '/object/(?:sign|authenticated|public)/laudos/([^?]+)'
    )
  END;
  storage_path := coalesce(
    nullif(storage_path, ''),
    concat_ws(
      '/',
      coalesce(nullif(inspection.municipio, ''), nullif(inspection.municipio_agente, ''), 'geral'),
      inspection.id || '.pdf'
    )
  );

  SELECT EXISTS (
    SELECT 1
    FROM storage.objects
    WHERE bucket_id = 'laudos' AND name = storage_path
  ) INTO file_exists;

  IF internal_request THEN
    INSERT INTO public.internal_access_events (
      actor_id, actor_role, action, target_type, target_id, result, metadata
    ) VALUES (
      auth.uid(),
      private.current_internal_role(auth.uid()),
      'customer.document.generate.authorize',
      'inspection_document',
      inspection.id || ':laudo',
      'allowed',
      jsonb_build_object(
        'customer_id', p_customer_id,
        'document_status', CASE
          WHEN file_exists THEN 'available'
          WHEN inspection.laudo_gerado_em IS NOT NULL THEN 'missing_file'
          ELSE 'pending_generation'
        END
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'inspection_id', inspection.id,
    'path', storage_path,
    'document_status', CASE
      WHEN file_exists THEN 'available'
      WHEN inspection.laudo_gerado_em IS NOT NULL THEN 'missing_file'
      ELSE 'pending_generation'
    END,
    'already_available', file_exists
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.authorize_internal_customer_document(
  p_customer_id text,
  p_inspection_id uuid,
  p_kind text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  customer_kind text := split_part(p_customer_id, ':', 1);
  customer_target uuid;
  inspection public.vistorias;
  storage_path text;
BEGIN
  IF NOT private.can_access_sensitive_customer(p_customer_id, auth.uid()) THEN
    RAISE EXCEPTION 'sensitive_support_access_required' USING ERRCODE = '42501';
  END IF;
  IF p_kind <> 'laudo' THEN
    RAISE EXCEPTION 'document_preview_unavailable' USING ERRCODE = 'P0002';
  END IF;
  IF customer_kind NOT IN ('organization', 'user') THEN
    RAISE EXCEPTION 'invalid_customer_id';
  END IF;
  BEGIN
    customer_target := split_part(p_customer_id, ':', 2)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'invalid_customer_id';
  END;

  SELECT * INTO inspection
  FROM public.vistorias v
  WHERE v.id = p_inspection_id
    AND (
      (customer_kind = 'organization' AND v.organization_id = customer_target)
      OR (
        customer_kind = 'user'
        AND v.organization_id IS NULL
        AND v."agenteUid"::text = customer_target::text
      )
    );

  IF inspection.id IS NULL OR inspection.laudo_gerado_em IS NULL THEN
    RAISE EXCEPTION 'document_preview_unavailable' USING ERRCODE = 'P0002';
  END IF;

  storage_path := CASE
    WHEN inspection.laudo_url LIKE 'laudos:%'
      THEN substring(inspection.laudo_url FROM char_length('laudos:') + 1)
    ELSE substring(
      inspection.laudo_url
      FROM '/object/(?:sign|authenticated|public)/laudos/([^?]+)'
    )
  END;
  storage_path := coalesce(
    nullif(storage_path, ''),
    concat_ws(
      '/',
      coalesce(nullif(inspection.municipio, ''), nullif(inspection.municipio_agente, ''), 'geral'),
      inspection.id || '.pdf'
    )
  );

  IF NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id = 'laudos' AND name = storage_path
  ) THEN
    RAISE EXCEPTION 'document_file_missing' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.internal_access_events (
    actor_id, actor_role, action, target_type, target_id, result, metadata
  ) VALUES (
    auth.uid(),
    private.current_internal_role(auth.uid()),
    'customer.document.authorize',
    'inspection_document',
    inspection.id || ':laudo',
    'allowed',
    jsonb_build_object('customer_id', p_customer_id, 'expires_in_seconds', 60)
  );

  RETURN jsonb_build_object(
    'bucket', 'laudos',
    'path', storage_path,
    'expires_in', 60,
    'filename', coalesce(inspection.protocolo, inspection.id::text) || '.pdf'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_internal_customer_operations(p_customer_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  customer_kind text := split_part(p_customer_id, ':', 1);
  customer_target uuid;
  can_sensitive boolean;
  can_generate boolean;
  result jsonb;
BEGIN
  IF NOT private.has_internal_permission('customer.read') THEN
    RAISE EXCEPTION 'customer_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  BEGIN
    customer_target := split_part(p_customer_id, ':', 2)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'invalid_customer_id';
  END;
  IF customer_kind NOT IN ('organization', 'user') THEN
    RAISE EXCEPTION 'invalid_customer_id';
  END IF;

  can_sensitive := private.can_access_sensitive_customer(p_customer_id);
  can_generate := can_sensitive AND private.has_internal_permission('customer.write');

  SELECT jsonb_build_object(
    'appointments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'title', a.titulo, 'status', a.status,
        'scheduled_at', a.data_agendada, 'agent_name', a.agente_nome,
        'address', CASE WHEN can_sensitive THEN a.endereco END,
        'latitude', CASE WHEN can_sensitive THEN a.lat END,
        'longitude', CASE WHEN can_sensitive THEN a.lng END,
        'origin', a.origem
      ) ORDER BY a.data_agendada DESC)
      FROM (
        SELECT * FROM public.agendamentos
        WHERE (customer_kind = 'organization' AND organization_id = customer_target)
          OR (customer_kind = 'user' AND agente_uid = customer_target)
        ORDER BY data_agendada DESC LIMIT 100
      ) a
    ), '[]'::jsonb),
    'map_points', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', v.id, 'protocol', v.protocolo, 'risk', v."nivelRisco",
        'status', v.status, 'occurred_at', v."dataVistoria",
        'latitude', CASE WHEN can_sensitive THEN v.latitude END,
        'longitude', CASE WHEN can_sensitive THEN v.longitude END,
        'address', CASE WHEN can_sensitive
          THEN COALESCE(v.endereco, concat_ws(' ', v."enderecoRua", v."enderecoNumero"))
        END
      ) ORDER BY v."dataVistoria" DESC)
      FROM (
        SELECT * FROM public.vistorias
        WHERE (customer_kind = 'organization' AND organization_id = customer_target)
          OR (customer_kind = 'user' AND "agenteUid" = customer_target::text)
        ORDER BY "dataVistoria" DESC LIMIT 250
      ) v
    ), '[]'::jsonb),
    'documents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', scoped.id,
        'inspection_id', scoped.id,
        'protocol', scoped.protocolo,
        'risk', scoped."nivelRisco",
        'occurred_at', scoped."dataVistoria",
        'generated_at', scoped.laudo_gerado_em,
        'storage_location', CASE WHEN object_id IS NOT NULL THEN 'supabase' ELSE scoped.storage_location END,
        'document_status', CASE
          WHEN object_id IS NOT NULL THEN 'available'
          WHEN scoped.laudo_gerado_em IS NOT NULL THEN 'missing_file'
          ELSE 'pending_generation'
        END,
        'downloadable', can_sensitive AND object_id IS NOT NULL,
        'can_generate', can_generate
      ) ORDER BY scoped."dataVistoria" DESC)
      FROM (
        SELECT
          v.*,
          o.id AS object_id
        FROM public.vistorias v
        LEFT JOIN LATERAL (
          SELECT id
          FROM storage.objects
          WHERE bucket_id = 'laudos'
            AND name = coalesce(
              CASE
                WHEN v.laudo_url LIKE 'laudos:%'
                  THEN substring(v.laudo_url FROM char_length('laudos:') + 1)
                ELSE substring(
                  v.laudo_url
                  FROM '/object/(?:sign|authenticated|public)/laudos/([^?]+)'
                )
              END,
              concat_ws(
                '/',
                coalesce(nullif(v.municipio, ''), nullif(v.municipio_agente, ''), 'geral'),
                v.id || '.pdf'
              )
            )
          LIMIT 1
        ) o ON TRUE
        WHERE (
          (customer_kind = 'organization' AND v.organization_id = customer_target)
          OR (customer_kind = 'user' AND v."agenteUid" = customer_target::text)
        )
          AND (v.status = 'concluida' OR v.laudo_gerado_em IS NOT NULL)
        ORDER BY v."dataVistoria" DESC
        LIMIT 100
      ) scoped
    ), '[]'::jsonb),
    'reports', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', v.id, 'protocol', v.protocolo, 'risk', v."nivelRisco",
        'score', v."pontuacaoTotal", 'form_id', v."formularioId",
        'form_version', v."formularioVersao", 'generated_at', v.relatorio_gerado_em
      ) ORDER BY COALESCE(v.relatorio_gerado_em, v."dataVistoria") DESC)
      FROM (
        SELECT * FROM public.vistorias
        WHERE (customer_kind = 'organization' AND organization_id = customer_target)
          OR (customer_kind = 'user' AND "agenteUid" = customer_target::text)
        ORDER BY "dataVistoria" DESC LIMIT 250
      ) v
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_inspection_laudo_generation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authorize_inspection_laudo_generation(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.authorize_internal_customer_document(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authorize_internal_customer_document(text, uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_internal_customer_operations(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_internal_customer_operations(text) TO authenticated;
