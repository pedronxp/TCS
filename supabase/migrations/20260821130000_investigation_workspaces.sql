-- Investigation workspaces for the internal console.  The browser only sees
-- bounded, permission-checked projections; direct table access is not needed
-- for either protocol research or session monitoring.

CREATE OR REPLACE FUNCTION public.list_internal_protocol_registry(
  p_search text DEFAULT NULL,
  p_organization_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
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
BEGIN
  IF NOT private.has_internal_permission('protocol.read') THEN
    RAISE EXCEPTION 'protocol_registry_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF p_limit NOT BETWEEN 1 AND 100 OR p_offset < 0 THEN
    RAISE EXCEPTION 'invalid_pagination' USING ERRCODE = '22023';
  END IF;

  WITH records AS (
    SELECT
      v.id, v.protocolo, v.protocol_series, v.protocol_year, v.protocol_seq, v.organization_id,
      coalesce(o.municipality_name, o.display_name, v.municipio, 'Agente individual') AS city,
      v."agenteNome" AS agent_name, v."dataVistoria" AS inspected_at, v.status,
      v."nivelRisco" AS risk_level, v.laudo_gerado_em IS NOT NULL AS has_laudo,
      v.relatorio_gerado_em IS NOT NULL AS has_report,
      CASE WHEN v.organization_id IS NULL THEN 'individual' ELSE 'municipal' END AS subject_kind
    FROM public.vistorias v
    LEFT JOIN public.organizations o ON o.id = v.organization_id
    WHERE v.protocolo IS NOT NULL
      AND (p_organization_id IS NULL OR v.organization_id = p_organization_id)
      AND (v_status IS NULL OR lower(v.status) = lower(v_status))
      AND (
        v_term IS NULL
        OR v.protocolo ILIKE '%' || v_term || '%'
        OR coalesce(o.display_name, '') ILIKE '%' || v_term || '%'
        OR coalesce(o.municipality_name, '') ILIKE '%' || v_term || '%'
        OR coalesce(v."agenteNome", '') ILIKE '%' || v_term || '%'
        OR coalesce(v."nivelRisco", '') ILIKE '%' || v_term || '%'
      )
  ), paged AS (
    SELECT * FROM records
    ORDER BY inspected_at DESC NULLS LAST, protocolo DESC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT
    coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'protocol', protocolo, 'series', protocol_series, 'year', protocol_year,
      'sequence', protocol_seq, 'organization_id', organization_id, 'city', city,
      'agent_name', agent_name, 'inspected_at', inspected_at, 'status', status,
      'risk_level', risk_level, 'has_laudo', has_laudo, 'has_report', has_report,
      'subject_kind', subject_kind
    )), '[]'::jsonb),
    (SELECT count(*) FROM records)
  INTO v_items, v_total FROM paged;

  RETURN jsonb_build_object('items', v_items, 'total', v_total, 'limit', p_limit, 'offset', p_offset);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_internal_protocol_inspection(p_inspection_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v public.vistorias%ROWTYPE;
  v_customer_key text;
  v_can_sensitive boolean;
  v_protocol_event jsonb;
  v_timeline jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_internal_permission('protocol.read') THEN
    RAISE EXCEPTION 'protocol_registry_read_not_allowed' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v FROM public.vistorias WHERE id = p_inspection_id;
  IF v.id IS NULL OR v.protocolo IS NULL THEN
    RAISE EXCEPTION 'protocol_inspection_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_customer_key := CASE WHEN v.organization_id IS NULL THEN 'user:' || v."agenteUid" ELSE 'organization:' || v.organization_id END;
  v_can_sensitive := private.can_access_sensitive_customer(v_customer_key);

  SELECT coalesce(to_jsonb(e), to_jsonb(i)) INTO v_protocol_event
  FROM public.protocol_allocation_events e
  FULL JOIN public.individual_protocol_allocation_events i ON false
  WHERE e.inspection_id = v.id OR i.inspection_id = v.id
  LIMIT 1;

  SELECT coalesce(jsonb_agg(item || jsonb_build_object('occurred_at', occurred_at) ORDER BY occurred_at NULLS LAST, sort_order), '[]'::jsonb)
  INTO v_timeline
  FROM (
    SELECT 10 AS sort_order, v."criadoEm" AS occurred_at, jsonb_build_object('kind', 'created', 'label', 'Registro iniciado') AS item
    UNION ALL SELECT 20, v."dataVistoria", jsonb_build_object('kind', 'inspected', 'label', 'Vistoria realizada')
    UNION ALL SELECT 30, coalesce((v_protocol_event->>'allocated_at')::timestamptz, v."dataVistoria"), jsonb_build_object('kind', 'protocol', 'label', 'Protocolo oficial alocado', 'detail', v.protocolo)
    UNION ALL SELECT 40, v.relatorio_gerado_em, jsonb_build_object('kind', 'report', 'label', 'Relatório gerado')
    UNION ALL SELECT 50, v.termo_gerado_em, jsonb_build_object('kind', 'term', 'label', 'Termo gerado')
    UNION ALL SELECT 60, v.laudo_gerado_em, jsonb_build_object('kind', 'laudo', 'label', 'Laudo disponibilizado')
  ) timeline(sort_order, occurred_at, item)
  WHERE occurred_at IS NOT NULL;

  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, metadata)
  VALUES (
    auth.uid(), private.current_internal_role(auth.uid()), 'protocol.inspection.review',
    'inspection', v.id::text, 'allowed', jsonb_build_object('protocol', v.protocolo, 'sensitive', v_can_sensitive)
  );

  RETURN jsonb_build_object(
    'id', v.id, 'protocol', v.protocolo, 'status', v.status, 'risk_level', v."nivelRisco",
    'score', v."pontuacaoTotal", 'occurred_at', v."dataVistoria", 'created_at', v."criadoEm",
    'organization', (SELECT coalesce(o.display_name, o.municipality_name) FROM public.organizations o WHERE o.id = v.organization_id),
    'municipality', v.municipio, 'agent_name', v."agenteNome", 'responsible_name', v."responsavelNome",
    'form_id', v."formularioId", 'form_version', v."formularioVersao", 'synchronized', v.sincronizado,
    'documents', jsonb_build_object('laudo', v.laudo_gerado_em IS NOT NULL, 'report', v.relatorio_gerado_em IS NOT NULL, 'term', v.termo_gerado_em IS NOT NULL),
    'photo_count', coalesce(array_length(v."fotosUrls", 1), 0) + CASE WHEN v."fotoUrl" IS NULL THEN 0 ELSE 1 END,
    'timeline', v_timeline, 'protocol_event', v_protocol_event,
    'can_view_sensitive', v_can_sensitive,
    'address', CASE WHEN v_can_sensitive THEN coalesce(v.endereco, concat_ws(' ', v."enderecoRua", v."enderecoNumero", v."enderecoBairro")) END,
    'answers', CASE WHEN v_can_sensitive THEN v."respostasJson" END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_internal_session_workspace(
  p_status text DEFAULT NULL,
  p_platform text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_term text := nullif(trim(p_search), '');
  v_items jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_internal_permission('session.read') THEN
    RAISE EXCEPTION 'session_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF p_limit NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid_pagination' USING ERRCODE = '22023'; END IF;

  WITH filtered AS (
    SELECT s.*, o.display_name, o.session_policy, o.session_timeout_minutes, o.offline_tolerance_minutes
    FROM public.active_sessions s
    LEFT JOIN public.organizations o ON o.id = s.organization_id
    WHERE (p_status IS NULL OR p_status = '' OR s.status = p_status)
      AND (p_platform IS NULL OR p_platform = '' OR s.platform = p_platform)
      AND (v_term IS NULL OR s.user_id::text ILIKE '%' || v_term || '%'
        OR coalesce(s.device_name, '') ILIKE '%' || v_term || '%'
        OR coalesce(s.platform, '') ILIKE '%' || v_term || '%'
        OR coalesce(o.display_name, '') ILIKE '%' || v_term || '%')
  ), active AS (
    SELECT * FROM public.active_sessions WHERE status = 'active'
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'user_id', user_id, 'organization_id', organization_id, 'device_id', device_id,
    'device_name', device_name, 'platform', platform, 'status', status, 'started_at', started_at,
    'last_heartbeat_at', last_heartbeat_at, 'ended_at', ended_at, 'end_reason', end_reason,
    'organizations', CASE WHEN organization_id IS NULL THEN NULL ELSE jsonb_build_object(
      'display_name', display_name, 'session_policy', session_policy,
      'session_timeout_minutes', session_timeout_minutes, 'offline_tolerance_minutes', offline_tolerance_minutes
    ) END
  ) ORDER BY last_heartbeat_at DESC), '[]'::jsonb) INTO v_items FROM (SELECT * FROM filtered ORDER BY last_heartbeat_at DESC LIMIT p_limit) page;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', (SELECT count(*) FROM filtered),
    'overview', jsonb_build_object(
      'active_total', (SELECT count(*) FROM active),
      'platforms', jsonb_build_object('web', (SELECT count(*) FROM active WHERE platform = 'web'), 'android', (SELECT count(*) FROM active WHERE platform = 'android'), 'ios', (SELECT count(*) FROM active WHERE platform = 'ios'))
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_internal_session_detail(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v public.active_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_internal_permission('session.read') THEN
    RAISE EXCEPTION 'session_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.active_sessions WHERE id = p_session_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002'; END IF;

  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, metadata)
  VALUES (auth.uid(), private.current_internal_role(auth.uid()), 'session.review', 'active_session', v.id::text, 'allowed', jsonb_build_object('source', 'internal_console'));

  RETURN jsonb_build_object(
    'session', jsonb_build_object(
      'id', v.id, 'user_id', v.user_id, 'organization_id', v.organization_id, 'device_id', v.device_id,
      'device_name', v.device_name, 'platform', v.platform, 'status', v.status, 'started_at', v.started_at,
      'last_heartbeat_at', v.last_heartbeat_at, 'ended_at', v.ended_at, 'end_reason', v.end_reason,
      'organizations', CASE WHEN v.organization_id IS NULL THEN NULL ELSE jsonb_build_object('display_name', (SELECT o.display_name FROM public.organizations o WHERE o.id = v.organization_id)) END
    ),
    'same_device_sessions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'status', s.status, 'started_at', s.started_at, 'last_heartbeat_at', s.last_heartbeat_at) ORDER BY s.started_at DESC)
      FROM (SELECT * FROM public.active_sessions WHERE user_id = v.user_id AND device_id = v.device_id ORDER BY started_at DESC LIMIT 12) s), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_internal_protocol_registry(text, uuid, text, integer, integer), public.get_internal_protocol_inspection(uuid), public.get_internal_session_workspace(text, text, text, integer), public.get_internal_session_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_internal_protocol_registry(text, uuid, text, integer, integer), public.get_internal_protocol_inspection(uuid), public.get_internal_session_workspace(text, text, text, integer), public.get_internal_session_detail(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
