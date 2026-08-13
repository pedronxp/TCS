-- Restores all customer workspace sections after the support-details migration
-- inadvertently replaced the operational branches with empty results.
CREATE OR REPLACE FUNCTION public.portal_get_workspace(p_section text)
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
  v_items jsonb := '[]'::jsonb;
  v_summary jsonb := '{}'::jsonb;
BEGIN
  IF p_section NOT IN (
    'vistorias', 'mapa', 'agenda', 'documentos', 'relatorios', 'equipe',
    'convites', 'consumo', 'assinatura', 'suporte', 'configuracoes', 'perfil'
  ) THEN
    RAISE EXCEPTION 'invalid_portal_section';
  END IF;

  v_context := public.get_portal_access_context();
  IF v_context IS NULL THEN
    RAISE EXCEPTION 'portal_access_required' USING ERRCODE = '42501';
  END IF;

  v_org := NULLIF(v_context->>'organization_id', '')::uuid;

  IF p_section IN ('vistorias', 'mapa', 'documentos') THEN
    SELECT COALESCE(jsonb_agg(item ORDER BY item->>'occurred_at' DESC), '[]'::jsonb)
    INTO v_items
    FROM (
      SELECT jsonb_build_object(
        'id', inspection.id,
        'title', COALESCE(inspection.protocolo, inspection.id::text),
        'protocol', inspection.protocolo,
        'status', inspection.status,
        'subtitle', COALESCE(inspection.endereco, inspection.municipio, 'Local não informado'),
        'address', COALESCE(inspection.endereco, inspection.municipio, 'Local não informado'),
        'occurred_at', COALESCE(inspection."dataVistoria", inspection."criadoEm"),
        'latitude', inspection.latitude,
        'longitude', inspection.longitude,
        'formulario_id', inspection."formularioId",
        'document_available', inspection.laudo_url IS NOT NULL
      ) AS item
      FROM public.vistorias AS inspection
      WHERE (p_section <> 'documentos' OR inspection.laudo_url IS NOT NULL)
        AND (
          (v_org IS NULL AND inspection.organization_id IS NULL AND inspection."agenteUid"::text = v_user::text)
          OR (
            v_org IS NOT NULL
            AND inspection.organization_id = v_org
            AND private.portal_agent_allowed(v_org, inspection."agenteUid"::text, v_user)
          )
        )
      ORDER BY COALESCE(inspection."dataVistoria", inspection."criadoEm") DESC NULLS LAST
      LIMIT 100
    ) AS scoped;
  ELSIF p_section = 'agenda' THEN
    SELECT COALESCE(jsonb_agg(item ORDER BY item->>'scheduled_at'), '[]'::jsonb)
    INTO v_items
    FROM (
      SELECT jsonb_build_object(
        'id', appointment.id,
        'title', appointment.titulo,
        'subtitle', appointment.endereco,
        'status', COALESCE(appointment.status, 'scheduled'),
        'scheduled_at', appointment.data_agendada,
        'inspection_id', appointment.inspection_id
      ) AS item
      FROM public.agendamentos AS appointment
      WHERE (
        (v_org IS NULL AND appointment.organization_id IS NULL AND (appointment.agente_uid = v_user OR appointment.criado_por_uid = v_user))
        OR (
          v_org IS NOT NULL
          AND appointment.organization_id = v_org
          AND private.portal_agent_allowed(v_org, COALESCE(appointment.agente_uid, appointment.criado_por_uid)::text, v_user)
        )
      )
      ORDER BY appointment.data_agendada DESC
      LIMIT 100
    ) AS scoped;
  ELSIF p_section = 'equipe' AND v_org IS NOT NULL AND (v_context->'permissions') ? 'team.read' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', member.id,
      'user_id', member.user_id,
      'title', COALESCE(profile.name, profile.email, member.user_id::text),
      'subtitle', member.role,
      'status', member.status
    ) ORDER BY member.created_at DESC), '[]'::jsonb)
    INTO v_items
    FROM public.organization_members AS member
    LEFT JOIN public.users AS profile ON profile.uid = member.user_id
    WHERE member.organization_id = v_org;
  ELSIF p_section = 'convites' AND v_org IS NOT NULL AND (v_context->'permissions') ? 'invite.agent' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', invitation.id,
      'title', invitation.email,
      'subtitle', invitation.role,
      'status', invitation.status
    ) ORDER BY invitation.created_at DESC), '[]'::jsonb)
    INTO v_items
    FROM public.organization_invites AS invitation
    WHERE invitation.organization_id = v_org
      AND (
        v_context->>'role' IN ('master', 'admin')
        OR (v_context->>'role' = 'supervisor' AND invitation.role = 'agent')
      );
  ELSIF p_section = 'consumo' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', counter.id,
      'title', counter.resource_code,
      'subtitle', counter.consumed::text || ' de ' || COALESCE(v_context->'limits'->>counter.resource_code, 'ilimitado'),
      'status', 'current'
    ) ORDER BY counter.resource_code), '[]'::jsonb)
    INTO v_items
    FROM public.usage_counters AS counter
    WHERE (v_org IS NULL AND counter.user_id = v_user)
       OR (v_org IS NOT NULL AND counter.organization_id = v_org);
  ELSIF p_section = 'assinatura' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', subscription.id,
      'title', plan.name,
      'subtitle', subscription.status,
      'status', subscription.status,
      'period_end', subscription.current_period_end,
      'cancel_at_period_end', subscription.cancel_at_period_end
    )), '[]'::jsonb)
    INTO v_items
    FROM public.subscriptions AS subscription
    JOIN public.plans AS plan ON plan.id = subscription.plan_id
    WHERE (v_org IS NULL AND subscription.user_id = v_user)
       OR (v_org IS NOT NULL AND subscription.organization_id = v_org);
  ELSIF p_section = 'suporte' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', ticket.id,
      'title', ticket.subject,
      'subtitle', ticket.public_code,
      'status', ticket.status,
      'priority', ticket.priority,
      'category', ticket.category,
      'description', ticket.description,
      'created_at', ticket.created_at
    ) ORDER BY ticket.created_at DESC), '[]'::jsonb)
    INTO v_items
    FROM public.support_tickets AS ticket
    WHERE (v_org IS NOT NULL AND ticket.organization_id = v_org)
       OR (v_org IS NULL AND ticket.user_id = v_user);

    SELECT jsonb_build_object(
      'total', count(*),
      'open', count(*) FILTER (WHERE status NOT IN ('resolved', 'closed', 'canceled')),
      'overdue', count(*) FILTER (WHERE resolution_due_at IS NOT NULL AND resolution_due_at < now() AND status NOT IN ('resolved', 'closed'))
    )
    INTO v_summary
    FROM public.support_tickets AS ticket
    WHERE (v_org IS NOT NULL AND ticket.organization_id = v_org)
       OR (v_org IS NULL AND ticket.user_id = v_user);
  ELSIF p_section = 'perfil' THEN
    SELECT jsonb_build_array(jsonb_build_object(
      'id', profile.uid,
      'title', COALESCE(profile.name, profile.email, 'Cliente TCS'),
      'subtitle', profile.email,
      'status', 'active'
    )) INTO v_items
    FROM public.users AS profile
    WHERE profile.uid = v_user;
  ELSIF p_section = 'configuracoes' AND v_org IS NOT NULL THEN
    SELECT jsonb_build_array(jsonb_build_object(
      'id', organization.id,
      'title', organization.display_name,
      'subtitle', COALESCE(organization.municipality_name, organization.state_code),
      'status', organization.status,
      'display_name', organization.display_name,
      'contact_name', organization.contact_name,
      'contact_email', organization.contact_email,
      'session_timeout_minutes', organization.session_timeout_minutes
    )) INTO v_items
    FROM public.organizations AS organization
    WHERE organization.id = v_org;
  END IF;

  IF p_section = 'relatorios' THEN
    SELECT jsonb_build_object(
      'inspections', count(*),
      'generated_at', now()
    )
    INTO v_summary
    FROM public.vistorias AS inspection
    WHERE (v_org IS NULL AND inspection.organization_id IS NULL AND inspection."agenteUid"::text = v_user::text)
       OR (
         v_org IS NOT NULL
         AND inspection.organization_id = v_org
         AND private.portal_agent_allowed(v_org, inspection."agenteUid"::text, v_user)
       );
  END IF;

  RETURN jsonb_build_object('section', p_section, 'items', v_items, 'summary', v_summary);
END;
$$;

COMMENT ON FUNCTION public.portal_get_workspace(text) IS 'Retorna workspace do portal no escopo autorizado, incluindo suporte detalhado e registros operacionais.';

REVOKE ALL ON FUNCTION public.portal_get_workspace(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_get_workspace(text) TO authenticated;
