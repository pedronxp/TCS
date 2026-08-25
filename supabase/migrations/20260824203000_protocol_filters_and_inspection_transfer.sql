-- Protocol research and municipal affiliation history import.

DROP FUNCTION IF EXISTS public.search_internal_protocol_registry(text, uuid, text, text, text, integer, integer);

CREATE FUNCTION public.search_internal_protocol_registry(
  p_search text DEFAULT NULL,
  p_organization_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_uf text DEFAULT NULL,
  p_municipio text DEFAULT NULL,
  p_agent_user_id uuid DEFAULT NULL,
  p_order text DEFAULT 'recent',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_items jsonb;
  v_total bigint;
  v_term text := nullif(trim(p_search), '');
  v_status text := nullif(trim(p_status), '');
  v_uf text := nullif(upper(trim(p_uf)), '');
  v_municipio text := nullif(trim(p_municipio), '');
  v_order text := lower(coalesce(nullif(trim(p_order), ''), 'recent'));
BEGIN
  IF NOT private.has_internal_permission('protocol.read') THEN
    RAISE EXCEPTION 'protocol_registry_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF p_limit NOT BETWEEN 1 AND 100 OR p_offset < 0 THEN
    RAISE EXCEPTION 'invalid_pagination' USING ERRCODE = '22023';
  END IF;
  IF v_order NOT IN ('recent', 'oldest') THEN
    RAISE EXCEPTION 'invalid_protocol_order' USING ERRCODE = '22023';
  END IF;

  WITH records AS (
    SELECT v.id, v.protocolo, v.protocol_series, v.protocol_year, v.protocol_seq, v.organization_id,
      CASE WHEN v."agenteUid" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN v."agenteUid"::uuid END AS agent_user_id,
      coalesce(o.municipality_name, o.display_name, v.municipio, 'Agente individual') AS city,
      coalesce(nullif(v."agenteNome", ''), u.name, u.username, 'Usuário não identificado') AS agent_name,
      v."dataVistoria" AS inspected_at, v.status, v."nivelRisco" AS risk_level,
      v.laudo_gerado_em IS NOT NULL AS has_laudo, v.relatorio_gerado_em IS NOT NULL AS has_report,
      CASE WHEN v.organization_id IS NULL THEN 'individual' ELSE 'municipal' END AS subject_kind
    FROM public.vistorias v
    LEFT JOIN public.organizations o ON o.id = v.organization_id
    LEFT JOIN public.users u ON u.uid::text = v."agenteUid"::text
    LEFT JOIN public.municipios m ON lower(m.nome) = lower(coalesce(v.municipio, o.municipality_name))
    WHERE v.protocolo IS NOT NULL
      AND (p_organization_id IS NULL OR v.organization_id = p_organization_id)
      AND (p_agent_user_id IS NULL OR v."agenteUid"::text = p_agent_user_id::text)
      AND (v_status IS NULL OR lower(v.status) = lower(v_status))
      AND (v_uf IS NULL OR m.uf = v_uf)
      AND (v_municipio IS NULL OR lower(coalesce(v.municipio, o.municipality_name, '')) = lower(v_municipio))
      AND (v_term IS NULL OR v.protocolo ILIKE '%' || v_term || '%'
        OR coalesce(o.display_name, '') ILIKE '%' || v_term || '%'
        OR coalesce(o.municipality_name, '') ILIKE '%' || v_term || '%'
        OR coalesce(v."agenteNome", '') ILIKE '%' || v_term || '%'
        OR coalesce(u.name, '') ILIKE '%' || v_term || '%'
        OR coalesce(v."nivelRisco", '') ILIKE '%' || v_term || '%')
  ), ranked AS (
    SELECT * FROM records
    ORDER BY
      CASE WHEN v_order = 'recent' THEN inspected_at END DESC NULLS LAST,
      CASE WHEN v_order = 'oldest' THEN inspected_at END ASC NULLS LAST,
      protocolo DESC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'protocol', protocolo, 'series', protocol_series, 'year', protocol_year,
      'sequence', protocol_seq, 'organization_id', organization_id, 'agent_user_id', agent_user_id,
      'city', city, 'agent_name', agent_name, 'inspected_at', inspected_at, 'status', status,
      'risk_level', risk_level, 'has_laudo', has_laudo, 'has_report', has_report,
      'subject_kind', subject_kind
    )), '[]'::jsonb), (SELECT count(*) FROM records)
  INTO v_items, v_total FROM ranked;

  RETURN jsonb_build_object('items', v_items, 'total', v_total, 'limit', p_limit, 'offset', p_offset);
END;
$$;

REVOKE ALL ON FUNCTION public.search_internal_protocol_registry(text, uuid, text, text, text, uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_internal_protocol_registry(text, uuid, text, text, text, uuid, text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_internal_protocol_agents()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE WHEN private.has_internal_permission('protocol.read') THEN
    coalesce(jsonb_agg(jsonb_build_object(
      'user_id', source.user_id,
      'name', source.name,
      'inspection_count', source.inspection_count
    ) ORDER BY source.name), '[]'::jsonb)
  ELSE '[]'::jsonb END
  FROM (
    SELECT v."agenteUid"::uuid AS user_id,
      coalesce(max(nullif(v."agenteNome", '')), max(u.name), max(u.username), 'Usuário sem nome') AS name,
      count(*)::integer AS inspection_count
    FROM public.vistorias v
    LEFT JOIN public.users u ON u.uid::text = v."agenteUid"::text
    WHERE v."agenteUid" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    GROUP BY v."agenteUid"
  ) source;
$$;

REVOKE ALL ON FUNCTION public.list_internal_protocol_agents() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_internal_protocol_agents() TO authenticated;

CREATE OR REPLACE FUNCTION public.preview_individual_inspection_import(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_target uuid := coalesce(p_user_id, auth.uid());
  v_count bigint;
  v_first timestamptz;
  v_last timestamptz;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF v_target IS DISTINCT FROM v_actor AND NOT EXISTS (
    SELECT 1 FROM public.internal_staff
    WHERE user_id = v_actor AND status = 'active' AND role IN ('owner', 'support')
  ) THEN RAISE EXCEPTION 'inspection_import_preview_not_allowed' USING ERRCODE = '42501'; END IF;

  SELECT count(*), min(coalesce("dataVistoria", "criadoEm")), max(coalesce("dataVistoria", "criadoEm"))
    INTO v_count, v_first, v_last
  FROM public.vistorias
  WHERE organization_id IS NULL AND "agenteUid"::text = v_target::text;

  RETURN jsonb_build_object('user_id', v_target, 'count', v_count, 'first_at', v_first, 'last_at', v_last);
END;
$$;

REVOKE ALL ON FUNCTION public.preview_individual_inspection_import(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_individual_inspection_import(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.import_individual_inspections(
  p_user_id uuid,
  p_organization_id uuid,
  p_actor_id uuid,
  p_source text
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
  v_first timestamptz;
  v_last timestamptz;
BEGIN
  SELECT min(coalesce("dataVistoria", "criadoEm")), max(coalesce("dataVistoria", "criadoEm"))
    INTO v_first, v_last
  FROM public.vistorias
  WHERE organization_id IS NULL AND "agenteUid"::text = p_user_id::text;

  UPDATE public.vistorias
  SET organization_id = p_organization_id
  WHERE organization_id IS NULL AND "agenteUid"::text = p_user_id::text;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    INSERT INTO public.subscription_audit_events(
      organization_id, actor_id, event_type, entity_type, entity_id, metadata
    ) VALUES (
      p_organization_id, p_actor_id, 'individual_inspections_imported', 'user', p_user_id::text,
      jsonb_build_object('count', v_count, 'first_at', v_first, 'last_at', v_last, 'source', p_source,
        'authorship_preserved', true, 'protocols_preserved', true)
    );
  END IF;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION private.import_individual_inspections(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.portal_accept_organization_invite_with_history(
  p_token text,
  p_import_individual_inspections boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_org uuid;
  v_imported integer := 0;
BEGIN
  v_result := public.portal_accept_organization_invite(p_token);
  IF coalesce((v_result->>'accepted')::boolean, false) THEN
    v_org := (v_result->>'organization_id')::uuid;
    IF p_import_individual_inspections THEN
      v_imported := private.import_individual_inspections(auth.uid(), v_org, auth.uid(), 'organization_invite');
    END IF;
    v_result := v_result || jsonb_build_object('imported_inspections', v_imported);
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.portal_accept_organization_invite_with_history(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_accept_organization_invite_with_history(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.internal_assign_customer_to_organization(
  p_user_id uuid,
  p_organization_id uuid,
  p_role text DEFAULT 'agent',
  p_import_individual_inspections boolean DEFAULT false,
  p_transfer_existing_membership boolean DEFAULT false,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := lower(trim(coalesce(p_role, 'agent')));
  v_previous_org uuid;
  v_imported integer := 0;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.internal_staff
    WHERE user_id = v_actor AND status = 'active' AND role IN ('owner', 'support')
  ) THEN RAISE EXCEPTION 'municipal_link_not_allowed' USING ERRCODE = '42501'; END IF;
  IF v_role NOT IN ('master', 'admin', 'supervisor', 'agent') THEN
    RAISE EXCEPTION 'invalid_municipal_role' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id AND status <> 'archived') THEN
    RAISE EXCEPTION 'organization_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT organization_id INTO v_previous_org
  FROM public.organization_members
  WHERE user_id = p_user_id AND status IN ('active', 'invited', 'suspended')
    AND organization_id <> p_organization_id
  ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;

  IF v_previous_org IS NOT NULL AND NOT p_transfer_existing_membership THEN
    RAISE EXCEPTION 'membership_conflict' USING ERRCODE = '23505';
  END IF;
  IF v_previous_org IS NOT NULL AND char_length(trim(coalesce(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'transfer_reason_required' USING ERRCODE = '22023';
  END IF;

  IF v_previous_org IS NOT NULL THEN
    UPDATE public.organization_members
    SET status = 'removed', updated_at = now()
    WHERE user_id = p_user_id AND organization_id <> p_organization_id
      AND status IN ('active', 'invited', 'suspended');
    UPDATE public.active_sessions
    SET status = 'revoked', ended_at = now(), ended_by = v_actor, end_reason = 'organization_membership_transferred'
    WHERE user_id = p_user_id AND status = 'active';
  END IF;

  INSERT INTO public.organization_members(organization_id, user_id, role, status, joined_at)
  VALUES (p_organization_id, p_user_id, v_role, 'active', now())
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, status = 'active', joined_at = coalesce(public.organization_members.joined_at, now()), updated_at = now();

  UPDATE public.users SET organization_id = p_organization_id WHERE uid = p_user_id;
  INSERT INTO private.customer_affiliation_states(user_id, state, updated_at)
  VALUES (p_user_id, 'municipal', now())
  ON CONFLICT (user_id) DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at;

  IF p_import_individual_inspections THEN
    v_imported := private.import_individual_inspections(p_user_id, p_organization_id, v_actor,
      CASE WHEN v_previous_org IS NULL THEN 'internal_link' ELSE 'internal_transfer' END);
  END IF;

  INSERT INTO public.subscription_audit_events(organization_id, actor_id, event_type, entity_type, entity_id, metadata)
  VALUES (p_organization_id, v_actor,
    CASE WHEN v_previous_org IS NULL THEN 'customer_municipal_linked' ELSE 'customer_municipal_transferred' END,
    'user', p_user_id::text,
    jsonb_build_object('role', v_role, 'previous_organization_id', v_previous_org,
      'imported_inspections', v_imported, 'reason', nullif(trim(p_reason), '')));

  RETURN jsonb_build_object('linked', true, 'transferred', v_previous_org IS NOT NULL,
    'organization_id', p_organization_id, 'previous_organization_id', v_previous_org,
    'user_id', p_user_id, 'role', v_role, 'imported_inspections', v_imported);
END;
$$;

REVOKE ALL ON FUNCTION public.internal_assign_customer_to_organization(uuid, uuid, text, boolean, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_assign_customer_to_organization(uuid, uuid, text, boolean, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_get_map_workspace()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_context jsonb;
  v_org uuid;
  v_items jsonb;
BEGIN
  v_context := public.get_portal_access_context();
  IF v_user IS NULL OR v_context IS NULL OR NOT (v_context->'permissions' ? 'map.read') THEN
    RAISE EXCEPTION 'portal_map_access_required' USING ERRCODE = '42501';
  END IF;
  v_org := nullif(v_context->>'organization_id', '')::uuid;

  SELECT coalesce(jsonb_agg(item ORDER BY item->>'occurred_at' DESC), '[]'::jsonb) INTO v_items
  FROM (
    SELECT jsonb_build_object(
      'id', inspection.id,
      'protocol', coalesce(inspection.protocolo, inspection.id::text),
      'status', inspection.status,
      'address', coalesce(inspection.endereco, inspection.municipio, 'Endereço não informado'),
      'municipality', inspection.municipio,
      'formulario_id', inspection."formularioId",
      'risk_level', inspection."nivelRisco",
      'agent_user_id', inspection."agenteUid",
      'agent_name', coalesce(nullif(inspection."agenteNome", ''), profile.name, profile.username, 'Usuário não identificado'),
      'occurred_at', coalesce(inspection."dataVistoria", inspection."criadoEm"),
      'latitude', inspection.latitude,
      'longitude', inspection.longitude
    ) AS item
    FROM public.vistorias inspection
    LEFT JOIN public.users profile ON profile.uid::text = inspection."agenteUid"::text
    WHERE (v_org IS NULL AND inspection.organization_id IS NULL AND inspection."agenteUid"::text = v_user::text)
       OR (v_org IS NOT NULL AND inspection.organization_id = v_org
         AND private.portal_agent_allowed(v_org, inspection."agenteUid"::text, v_user))
    ORDER BY coalesce(inspection."dataVistoria", inspection."criadoEm") DESC NULLS LAST
    LIMIT 500
  ) scoped;

  RETURN jsonb_build_object('section', 'mapa', 'items', v_items, 'summary', jsonb_build_object('total', jsonb_array_length(v_items)));
END;
$$;

REVOKE ALL ON FUNCTION public.portal_get_map_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_get_map_workspace() TO authenticated;

NOTIFY pgrst, 'reload schema';
