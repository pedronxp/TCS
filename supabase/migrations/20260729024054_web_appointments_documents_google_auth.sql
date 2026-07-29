-- Web operations: appointments created in the console, short-lived document
-- previews, and safe pending profiles for first-time Google accounts.

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'app';

ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_origem_check;

ALTER TABLE public.agendamentos
  ADD CONSTRAINT agendamentos_origem_check
  CHECK (origem IN ('app', 'web'));

CREATE INDEX IF NOT EXISTS agendamentos_origem_data_idx
  ON public.agendamentos (origem, data_agendada DESC);

CREATE OR REPLACE FUNCTION public.create_internal_customer_appointment(
  p_customer_id text,
  p_title text,
  p_scheduled_at timestamptz,
  p_address text DEFAULT NULL,
  p_agent_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_operation_id uuid DEFAULT gen_random_uuid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  kind text := split_part(p_customer_id, ':', 1);
  target_id uuid;
  target_org_id uuid;
  target_municipality text;
  assigned_agent_id uuid;
  assigned_agent_name text;
  actor_name text;
  actor_public_id uuid;
  appointment public.agendamentos;
  request_hash text;
  previous_result jsonb;
  result jsonb;
BEGIN
  IF NOT private.has_internal_permission('customer.write', actor) THEN
    RAISE EXCEPTION 'customer_write_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF kind NOT IN ('organization', 'user') THEN
    RAISE EXCEPTION 'invalid_customer_id';
  END IF;
  BEGIN
    target_id := split_part(p_customer_id, ':', 2)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'invalid_customer_id';
  END;
  IF char_length(trim(coalesce(p_title, ''))) < 3 OR char_length(trim(p_title)) > 160 THEN
    RAISE EXCEPTION 'invalid_appointment_title';
  END IF;
  IF p_scheduled_at IS NULL OR p_scheduled_at < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'invalid_appointment_date';
  END IF;
  IF char_length(coalesce(p_address, '')) > 500 OR char_length(coalesce(p_notes, '')) > 2000 THEN
    RAISE EXCEPTION 'appointment_content_too_long';
  END IF;

  IF kind = 'organization' THEN
    SELECT o.id, nullif(trim(o.municipality_name), '')
      INTO target_org_id, target_municipality
    FROM public.organizations o
    WHERE o.id = target_id AND o.status <> 'archived';

    IF target_org_id IS NULL THEN
      RAISE EXCEPTION 'customer_not_found';
    END IF;

    assigned_agent_id := p_agent_id;
    IF assigned_agent_id IS NOT NULL THEN
      SELECT u.name INTO assigned_agent_name
      FROM public.users u
      WHERE u.uid = assigned_agent_id
        AND u.organization_id = target_org_id
        AND u.role = 'agent'
        AND coalesce(u."isApproved", false);
      IF assigned_agent_name IS NULL THEN
        RAISE EXCEPTION 'agent_not_in_customer_scope' USING ERRCODE = '42501';
      END IF;
    END IF;
  ELSE
    SELECT u.organization_id, nullif(trim(u.municipio), ''), u.uid, u.name
      INTO target_org_id, target_municipality, assigned_agent_id, assigned_agent_name
    FROM public.users u
    WHERE u.uid = target_id AND coalesce(u."isApproved", false);

    IF assigned_agent_id IS NULL THEN
      RAISE EXCEPTION 'customer_not_found';
    END IF;
    IF p_agent_id IS NOT NULL AND p_agent_id <> assigned_agent_id THEN
      RAISE EXCEPTION 'agent_not_in_customer_scope' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF target_municipality IS NULL THEN
    RAISE EXCEPTION 'customer_municipality_required';
  END IF;

  SELECT s.display_name INTO actor_name
  FROM public.internal_staff s
  WHERE s.user_id = actor AND s.status = 'active';
  SELECT u.uid INTO actor_public_id FROM public.users u WHERE u.uid = actor;

  request_hash := md5(concat_ws(
    '|', p_customer_id, trim(p_title), p_scheduled_at,
    coalesce(trim(p_address), ''), coalesce(p_agent_id::text, ''),
    coalesce(trim(p_notes), '')
  ));
  SELECT io.result INTO previous_result
  FROM public.internal_operations io
  WHERE io.actor_id = actor
    AND io.operation_id = p_operation_id
    AND io.request_hash = request_hash;
  IF previous_result IS NOT NULL THEN
    RETURN previous_result;
  END IF;

  INSERT INTO public.internal_operations (
    operation_id, actor_id, action, request_hash
  ) VALUES (
    p_operation_id, actor, 'customer.appointment.create', request_hash
  );

  INSERT INTO public.agendamentos (
    titulo, endereco, municipio, data_agendada,
    criado_por_uid, criado_por_nome, agente_uid, agente_nome,
    observacoes, status, organization_id, origem
  ) VALUES (
    trim(p_title), nullif(trim(p_address), ''), target_municipality, p_scheduled_at,
    actor_public_id, coalesce(actor_name, 'TCS Console'), assigned_agent_id, assigned_agent_name,
    nullif(trim(p_notes), ''), 'pendente', target_org_id, 'web'
  )
  RETURNING * INTO appointment;

  result := jsonb_build_object(
    'id', appointment.id,
    'title', appointment.titulo,
    'status', appointment.status,
    'scheduled_at', appointment.data_agendada,
    'agent_name', appointment.agente_nome,
    'address', appointment.endereco,
    'origin', appointment.origem
  );

  UPDATE public.internal_operations
  SET status = 'succeeded', result = result, completed_at = now()
  WHERE actor_id = actor AND operation_id = p_operation_id;

  INSERT INTO public.internal_access_events (
    actor_id, actor_role, action, target_type, target_id, result, metadata
  ) VALUES (
    actor, private.current_internal_role(actor), 'customer.appointment.create',
    'appointment', appointment.id::text, 'allowed',
    jsonb_build_object('customer_id', p_customer_id, 'origin', 'web')
  );

  RETURN result;
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
  kind text := split_part(p_customer_id, ':', 1);
  target_id uuid;
  inspection public.vistorias;
  storage_path text;
BEGIN
  IF NOT private.can_access_sensitive_customer(p_customer_id, auth.uid()) THEN
    RAISE EXCEPTION 'sensitive_support_access_required' USING ERRCODE = '42501';
  END IF;
  IF p_kind <> 'laudo' THEN
    RAISE EXCEPTION 'document_preview_unavailable' USING ERRCODE = 'P0002';
  END IF;
  IF kind NOT IN ('organization', 'user') THEN
    RAISE EXCEPTION 'invalid_customer_id';
  END IF;
  BEGIN
    target_id := split_part(p_customer_id, ':', 2)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'invalid_customer_id';
  END;

  SELECT * INTO inspection
  FROM public.vistorias v
  WHERE v.id = p_inspection_id
    AND (
      (kind = 'organization' AND v.organization_id = target_id)
      OR (kind = 'user' AND v.organization_id IS NULL AND v."agenteUid"::text = target_id::text)
    );

  IF inspection.id IS NULL
    OR inspection.laudo_gerado_em IS NULL
    OR inspection.storage_location <> 'supabase'
  THEN
    RAISE EXCEPTION 'document_preview_unavailable' USING ERRCODE = 'P0002';
  END IF;

  storage_path := substring(
    inspection.laudo_url
    FROM '/object/(?:sign|authenticated|public)/laudos/([^?]+)'
  );
  storage_path := coalesce(
    storage_path,
    concat_ws('/', coalesce(nullif(inspection.municipio, ''), 'geral'), inspection.id || '.pdf')
  );

  INSERT INTO public.internal_access_events (
    actor_id, actor_role, action, target_type, target_id, result, metadata
  ) VALUES (
    auth.uid(), private.current_internal_role(auth.uid()), 'customer.document.authorize',
    'inspection_document', inspection.id || ':laudo', 'allowed',
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
  kind text := split_part(p_customer_id, ':', 1);
  target_id uuid;
  can_sensitive boolean;
  result jsonb;
BEGIN
  IF NOT private.has_internal_permission('customer.read') THEN
    RAISE EXCEPTION 'customer_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  BEGIN
    target_id := split_part(p_customer_id, ':', 2)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'invalid_customer_id';
  END;
  IF kind NOT IN ('organization', 'user') THEN
    RAISE EXCEPTION 'invalid_customer_id';
  END IF;
  can_sensitive := private.can_access_sensitive_customer(p_customer_id);

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
        WHERE (kind = 'organization' AND organization_id = target_id)
          OR (kind = 'user' AND agente_uid = target_id)
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
        WHERE (kind = 'organization' AND organization_id = target_id)
          OR (kind = 'user' AND "agenteUid" = target_id::text)
        ORDER BY "dataVistoria" DESC LIMIT 250
      ) v
    ), '[]'::jsonb),
    'documents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', v.id, 'inspection_id', v.id, 'protocol', v.protocolo,
        'risk', v."nivelRisco", 'generated_at', v.laudo_gerado_em,
        'storage_location', v.storage_location,
        'downloadable', can_sensitive
          AND v.laudo_gerado_em IS NOT NULL
          AND v.storage_location = 'supabase'
      ) ORDER BY v.laudo_gerado_em DESC)
      FROM (
        SELECT * FROM public.vistorias
        WHERE (
          (kind = 'organization' AND organization_id = target_id)
          OR (kind = 'user' AND "agenteUid" = target_id::text)
        )
          AND laudo_gerado_em IS NOT NULL
        ORDER BY laudo_gerado_em DESC LIMIT 100
      ) v
    ), '[]'::jsonb),
    'reports', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', v.id, 'protocol', v.protocolo, 'risk', v."nivelRisco",
        'score', v."pontuacaoTotal", 'form_id', v."formularioId",
        'form_version', v."formularioVersao", 'generated_at', v.relatorio_gerado_em
      ) ORDER BY COALESCE(v.relatorio_gerado_em, v."dataVistoria") DESC)
      FROM (
        SELECT * FROM public.vistorias
        WHERE (kind = 'organization' AND organization_id = target_id)
          OR (kind = 'user' AND "agenteUid" = target_id::text)
        ORDER BY "dataVistoria" DESC LIMIT 250
      ) v
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

-- Existing password/invite registrations keep their current approval behavior.
-- A first-time Google identity receives only a pending app profile: no internal
-- role, organization or console permission is granted automatically.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  provider text := coalesce(NEW.raw_app_meta_data->>'provider', '');
  requested_role text := meta->>'role';
  safe_name text := left(coalesce(nullif(trim(meta->>'name'), ''), nullif(trim(meta->>'full_name'), ''), split_part(NEW.email, '@', 1)), 150);
  safe_username text := left(
    coalesce(nullif(trim(meta->>'username'), ''), split_part(NEW.email, '@', 1))
      || CASE WHEN requested_role IS NULL THEN '_' || left(NEW.id::text, 6) ELSE '' END,
    120
  );
BEGIN
  IF requested_role IS NOT NULL THEN
    INSERT INTO public.users (
      uid, name, username, email, phone, role, municipio, "isApproved", "createdAt"
    ) VALUES (
      NEW.id, safe_name, safe_username, lower(trim(NEW.email)),
      meta->>'phone', requested_role, meta->>'municipio',
      CASE WHEN requested_role = 'admin' THEN false ELSE true END, now()
    )
    ON CONFLICT (uid) DO NOTHING;
  ELSIF provider = 'google' THEN
    INSERT INTO public.users (
      uid, name, username, email, role, municipio, "isApproved", "createdAt"
    ) VALUES (
      NEW.id, safe_name, safe_username, lower(trim(NEW.email)),
      'agent', NULL, false, now()
    )
    ON CONFLICT (uid) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_internal_customer_appointment(
  text, text, timestamptz, text, uuid, text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_internal_customer_appointment(
  text, text, timestamptz, text, uuid, text, uuid
) TO authenticated;

REVOKE ALL ON FUNCTION public.authorize_internal_customer_document(
  text, uuid, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authorize_internal_customer_document(
  text, uuid, text
) TO authenticated;
