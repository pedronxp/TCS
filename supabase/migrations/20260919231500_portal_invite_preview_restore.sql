-- Restaura portal_get_invite_preview (usado por InviteAcceptancePage do portal)
-- que ficou órfã junto com as RPCs do commit restore_portal_orphan_rpcs.
-- Também ajusta portal_create_appointment: p_inspection_id passa a ter
-- DEFAULT NULL (o portal cria agendamentos sem vistoria vinculada).

CREATE OR REPLACE FUNCTION public.portal_create_appointment(
  p_inspection_id uuid DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_scheduled_at timestamptz DEFAULT NULL,
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
  IF p_title IS NULL OR p_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'invalid_appointment';
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

-- (A assinatura é idêntica à versão anterior; CREATE OR REPLACE atualiza os
-- defaults sem precisar de DROP, preservando as grants já concedidas.)

CREATE OR REPLACE FUNCTION public.portal_get_invite_preview(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite public.organization_invites;
  v_organization public.organizations;
  v_local text;
  v_domain text;
BEGIN
  SELECT * INTO v_invite
  FROM public.organization_invites
  WHERE token_hash = encode(extensions.digest(upper(trim(p_token)), 'sha256'), 'hex');
  IF v_invite.id IS NULL THEN RETURN NULL; END IF;
  IF v_invite.status = 'pending' AND v_invite.expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;
  SELECT * INTO v_organization FROM public.organizations WHERE id = v_invite.organization_id;
  v_local := split_part(v_invite.email, '@', 1);
  v_domain := split_part(v_invite.email, '@', 2);
  RETURN jsonb_build_object(
    'organization_name', v_organization.display_name,
    'email_hint', left(v_local, 2) || repeat('*', greatest(length(v_local) - 2, 1)) || '@' || v_domain,
    'role', v_invite.role,
    'expires_at', v_invite.expires_at,
    'status', v_invite.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.portal_get_invite_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_get_invite_preview(text) TO anon, authenticated;
