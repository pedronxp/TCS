-- Restaura a consulta do portal após identificar uma versão vazia em produção.
-- O escopo continua validado no contexto da conta e por portal_agent_allowed.
BEGIN;

CREATE OR REPLACE FUNCTION public.portal_get_dashboard()
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
  v_inspections bigint;
  v_appointments bigint;
  v_documents bigint;
  v_usage bigint;
  v_team bigint := 0;
  v_high_risk bigint := 0;
  v_recent jsonb;
  v_upcoming jsonb;
BEGIN
  v_context := public.get_portal_access_context();
  IF v_context IS NULL THEN
    RAISE EXCEPTION 'portal_access_required' USING ERRCODE = '42501';
  END IF;
  v_org := NULLIF(v_context->>'organization_id', '')::uuid;

  SELECT count(*) INTO v_inspections
  FROM public.vistorias
  WHERE (
    (v_org IS NULL AND organization_id IS NULL AND "agenteUid"::text = v_user::text)
    OR (v_org IS NOT NULL AND organization_id = v_org AND private.portal_agent_allowed(v_org, "agenteUid"::text, v_user))
  );
  SELECT count(*) INTO v_appointments
  FROM public.agendamentos
  WHERE data_agendada >= now()
    AND (
      (v_org IS NULL AND organization_id IS NULL AND (agente_uid = v_user OR criado_por_uid = v_user))
      OR (v_org IS NOT NULL AND organization_id = v_org AND private.portal_agent_allowed(v_org, COALESCE(agente_uid, criado_por_uid)::text, v_user))
    );
  SELECT count(*) INTO v_documents
  FROM public.vistorias
  WHERE laudo_url IS NOT NULL
    AND (
      (v_org IS NULL AND organization_id IS NULL AND "agenteUid"::text = v_user::text)
      OR (v_org IS NOT NULL AND organization_id = v_org AND private.portal_agent_allowed(v_org, "agenteUid"::text, v_user))
    );
  v_usage := COALESCE((v_context->'usage'->>'inspections')::bigint, 0);
  IF v_org IS NOT NULL AND v_context->>'role' IN ('master', 'admin', 'coordinator', 'supervisor') THEN
    SELECT count(*) INTO v_team FROM public.organization_members
    WHERE organization_id = v_org AND status = 'active';
    SELECT count(*) INTO v_high_risk FROM public.vistorias AS inspection
    WHERE inspection.organization_id = v_org
      AND private.portal_agent_allowed(v_org, inspection."agenteUid"::text, v_user)
      AND lower(COALESCE(inspection."nivelRisco", '')) IN ('r3', 'r4', 'critico', 'crítico', 'alto', 'muito_alto', 'muito alto');
  END IF;

  SELECT COALESCE(jsonb_agg(item ORDER BY item->>'occurredAt' DESC), '[]'::jsonb)
  INTO v_recent
  FROM (
    SELECT jsonb_build_object(
      'id', inspection.id,
      'protocol', COALESCE(inspection.protocolo, inspection.id::text),
      'status', inspection.status,
      'riskLevel', inspection."nivelRisco",
      'occurredAt', COALESCE(inspection."dataVistoria", inspection."criadoEm")
    ) AS item
    FROM public.vistorias AS inspection
    WHERE (
      (v_org IS NULL AND inspection.organization_id IS NULL AND inspection."agenteUid"::text = v_user::text)
      OR (v_org IS NOT NULL AND inspection.organization_id = v_org AND private.portal_agent_allowed(v_org, inspection."agenteUid"::text, v_user))
    )
    ORDER BY COALESCE(inspection."dataVistoria", inspection."criadoEm") DESC NULLS LAST
    LIMIT 6
  ) AS recent;

  SELECT COALESCE(jsonb_agg(item ORDER BY item->>'scheduledAt'), '[]'::jsonb)
  INTO v_upcoming
  FROM (
    SELECT jsonb_build_object(
      'id', appointment.id,
      'title', appointment.titulo,
      'scheduledAt', appointment.data_agendada,
      'status', COALESCE(appointment.status, 'scheduled')
    ) AS item
    FROM public.agendamentos AS appointment
    WHERE appointment.data_agendada >= now()
      AND (
        (v_org IS NULL AND appointment.organization_id IS NULL AND (appointment.agente_uid = v_user OR appointment.criado_por_uid = v_user))
        OR (v_org IS NOT NULL AND appointment.organization_id = v_org AND private.portal_agent_allowed(v_org, COALESCE(appointment.agente_uid, appointment.criado_por_uid)::text, v_user))
      )
    ORDER BY appointment.data_agendada
    LIMIT 6
  ) AS upcoming;

  RETURN jsonb_build_object(
    'metrics', jsonb_build_array(
      jsonb_build_object('key', 'inspections', 'label', 'Vistorias no escopo', 'value', v_inspections),
      jsonb_build_object('key', 'appointments', 'label', 'Próximos agendamentos', 'value', v_appointments),
      jsonb_build_object('key', 'documents', 'label', 'Documentos disponíveis', 'value', v_documents),
      jsonb_build_object('key', 'usage', 'label', 'Uso no período', 'value', v_usage)
    ) || CASE WHEN v_org IS NOT NULL AND v_context->>'role' IN ('master', 'admin', 'coordinator', 'supervisor')
      THEN jsonb_build_array(
        jsonb_build_object('key', 'team', 'label', 'Pessoas ativas', 'value', v_team),
        jsonb_build_object('key', 'high_risk', 'label', 'Risco alto no escopo', 'value', v_high_risk)
      )
      ELSE '[]'::jsonb
    END,
    'recent_inspections', v_recent,
    'upcoming', v_upcoming
  );
END;
$$;

REVOKE ALL ON FUNCTION public.portal_get_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_get_dashboard() TO authenticated;
COMMIT;
