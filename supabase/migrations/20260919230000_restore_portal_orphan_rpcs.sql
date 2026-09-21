-- Restaura 4 RPCs do portal do cliente que ficaram órfãs.
-- As migrations originais (20260729150000_customer_portals_foundation e
-- 20260801143939_customer_auth_capabilities_audit) nunca foram aplicadas ao
-- banco remoto, mas o frontend do portal (dashboard) continua chamando:
--   - portal_get_inspection
--   - portal_create_appointment
--   - portal_update_organization_settings
--   - record_google_identity_reconciled
-- Todas as dependências (get_portal_access_context, private.portal_agent_allowed,
-- private.current_organization_id, private.organization_role e colunas de
-- vistorias/agendamentos/organizations/subscription_audit_events) foram
-- verificadas contra o schema atual antes desta restauração.

CREATE OR REPLACE FUNCTION public.portal_create_appointment(
  p_inspection_id uuid,
  p_title text,
  p_scheduled_at timestamptz,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_context jsonb;
  v_org uuid;
  v_inspection public.vistorias;
  v_agent uuid;
  v_municipality text;
  v_appointment public.agendamentos;
BEGIN
  v_context := public.get_portal_access_context();
  IF v_context IS NULL
     OR NOT (v_context->'permissions') ? 'appointment.read'
     OR NOT COALESCE((v_context->>'creation_allowed')::boolean, false) THEN
    RAISE EXCEPTION 'appointment_create_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF char_length(trim(p_title)) NOT BETWEEN 3 AND 150 OR p_scheduled_at <= now() THEN
    RAISE EXCEPTION 'invalid_appointment';
  END IF;
  v_org := NULLIF(v_context->>'organization_id', '')::uuid;
  IF p_inspection_id IS NOT NULL THEN
    SELECT * INTO v_inspection FROM public.vistorias AS inspection
    WHERE inspection.id = p_inspection_id
      AND (
        (v_org IS NULL AND inspection.organization_id IS NULL AND inspection."agenteUid"::text = v_user::text)
        OR (
          v_org IS NOT NULL
          AND inspection.organization_id = v_org
          AND private.portal_agent_allowed(v_org, inspection."agenteUid"::text, v_user)
        )
      );
    IF v_inspection.id IS NULL THEN
      RAISE EXCEPTION 'inspection_not_found' USING ERRCODE = 'P0002';
    END IF;
    BEGIN v_agent := v_inspection."agenteUid"::uuid;
    EXCEPTION WHEN invalid_text_representation THEN v_agent := v_user; END;
  ELSE
    v_agent := v_user;
  END IF;
  v_municipality := CASE
    WHEN v_org IS NOT NULL THEN (SELECT COALESCE(municipality_name, display_name) FROM public.organizations WHERE id = v_org)
    ELSE (SELECT COALESCE(municipio, 'Não informado') FROM public.users WHERE uid = v_user)
  END;
  INSERT INTO public.agendamentos(
    inspection_id, organization_id, agente_uid, agente_nome, criado_por_uid,
    criado_por_nome, data_agendada, municipio, titulo, observacoes, status
  ) VALUES (
    p_inspection_id, v_org, v_agent,
    COALESCE(v_inspection."agenteNome", v_context->>'display_name'),
    v_user, v_context->>'display_name', p_scheduled_at,
    COALESCE(v_municipality, 'Não informado'), trim(p_title), NULLIF(trim(p_notes), ''), 'agendado'
  )
  RETURNING * INTO v_appointment;
  INSERT INTO public.subscription_audit_events(
    organization_id, actor_id, event_type, entity_type, entity_id, metadata
  ) VALUES (
    v_org, v_user, 'portal_appointment_created', 'appointment', v_appointment.id::text,
    jsonb_build_object('inspection_id', p_inspection_id)
  );
  RETURN jsonb_build_object('created', true, 'appointment_id', v_appointment.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_get_inspection(p_inspection_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_context jsonb;
  v_org uuid;
  v_inspection public.vistorias;
BEGIN
  v_context := public.get_portal_access_context();
  IF v_context IS NULL OR NOT (v_context->'permissions') ? 'inspection.read' THEN
    RAISE EXCEPTION 'inspection_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  v_org := NULLIF(v_context->>'organization_id', '')::uuid;
  SELECT * INTO v_inspection
  FROM public.vistorias AS inspection
  WHERE inspection.id = p_inspection_id
    AND (
      (v_org IS NULL AND inspection.organization_id IS NULL AND inspection."agenteUid"::text = v_user::text)
      OR (
        v_org IS NOT NULL
        AND inspection.organization_id = v_org
        AND private.portal_agent_allowed(v_org, inspection."agenteUid"::text, v_user)
      )
    );
  IF v_inspection.id IS NULL THEN
    RAISE EXCEPTION 'inspection_not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object(
    'id', v_inspection.id,
    'protocol', COALESCE(v_inspection.protocolo, v_inspection.id::text),
    'status', v_inspection.status,
    'risk_level', v_inspection."nivelRisco",
    'score', v_inspection."pontuacaoTotal",
    'occurred_at', COALESCE(v_inspection."dataVistoria", v_inspection."criadoEm"),
    'address', COALESCE(v_inspection.endereco, concat_ws(' ', v_inspection."enderecoRua", v_inspection."enderecoNumero")),
    'municipality', v_inspection.municipio,
    'agent_name', v_inspection."agenteNome",
    'latitude', v_inspection.latitude,
    'longitude', v_inspection.longitude,
    'document_available', v_inspection.laudo_gerado_em IS NOT NULL AND v_inspection.laudo_url IS NOT NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_update_organization_settings(
  p_display_name text,
  p_contact_name text,
  p_contact_email text,
  p_session_timeout_minutes integer,
  p_reason text,
  p_confirmation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_org uuid := private.current_organization_id(v_actor);
  v_actor_role text := private.organization_role(v_org, v_actor);
  v_organization public.organizations;
  v_previous jsonb;
  v_email text := lower(trim(COALESCE(p_contact_email, '')));
BEGIN
  IF v_actor IS NULL OR v_org IS NULL OR v_actor_role NOT IN ('owner', 'coordinator') THEN
    RAISE EXCEPTION 'settings_manage_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF p_confirmation <> 'CONFIRMAR' OR char_length(trim(COALESCE(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'confirmation_and_reason_required' USING ERRCODE = '22023';
  END IF;
  IF char_length(trim(COALESCE(p_display_name, ''))) NOT BETWEEN 3 AND 120
     OR p_session_timeout_minutes NOT BETWEEN 5 AND 43200
     OR (v_email <> '' AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN
    RAISE EXCEPTION 'invalid_organization_settings' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('portal-settings:' || v_org::text, 0));
  SELECT * INTO v_organization
  FROM public.organizations
  WHERE id = v_org
  FOR UPDATE;
  IF v_organization.id IS NULL THEN
    RAISE EXCEPTION 'organization_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_previous := jsonb_build_object(
    'display_name', v_organization.display_name,
    'contact_name', v_organization.contact_name,
    'contact_email', v_organization.contact_email,
    'session_timeout_minutes', v_organization.session_timeout_minutes
  );
  UPDATE public.organizations
  SET display_name = trim(p_display_name),
      contact_name = NULLIF(trim(COALESCE(p_contact_name, '')), ''),
      contact_email = NULLIF(v_email, ''),
      session_timeout_minutes = p_session_timeout_minutes,
      updated_at = now()
  WHERE id = v_org;

  INSERT INTO public.subscription_audit_events(
    organization_id, actor_id, event_type, entity_type, entity_id, metadata
  ) VALUES (
    v_org,
    v_actor,
    'portal_organization_settings_changed',
    'organization',
    v_org::text,
    jsonb_build_object(
      'previous', v_previous,
      'next', jsonb_build_object(
        'display_name', trim(p_display_name),
        'contact_name', NULLIF(trim(COALESCE(p_contact_name, '')), ''),
        'contact_email', NULLIF(v_email, ''),
        'session_timeout_minutes', p_session_timeout_minutes
      ),
      'reason', trim(p_reason)
    )
  );
  RETURN jsonb_build_object('updated', true, 'organization_id', v_org);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_google_identity_reconciled()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM auth.identities AS identity
    WHERE identity.user_id = v_user
      AND identity.provider = 'google'
  ) THEN
    RAISE EXCEPTION 'google_identity_required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.subscription_audit_events AS event
    WHERE event.actor_id = v_user
      AND event.event_type = 'google_identity_reconciled'
  ) THEN
    INSERT INTO public.subscription_audit_events(
      actor_id,
      event_type,
      entity_type,
      entity_id,
      metadata
    ) VALUES (
      v_user,
      'google_identity_reconciled',
      'customer_identity',
      v_user::text,
      jsonb_build_object('provider', 'google', 'recorded_at_source', 'database')
    );
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.portal_create_appointment(uuid, text, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_create_appointment(uuid, text, timestamptz, text) TO authenticated;

REVOKE ALL ON FUNCTION public.portal_get_inspection(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_get_inspection(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.portal_update_organization_settings(text, text, text, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_update_organization_settings(text, text, text, integer, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.record_google_identity_reconciled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_google_identity_reconciled() TO authenticated;
