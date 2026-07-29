-- Dedicated, scoped data contracts for the internal agent detail.
-- Customer-level RPCs intentionally remain bounded summaries (50 recent
-- inspections and 250 map points); they are not the source for full agent
-- history. See docs/internal-agent-detail.md.

CREATE INDEX IF NOT EXISTS vistorias_agent_history_idx
  ON public.vistorias ("agenteUid", "dataVistoria" DESC, id DESC);
CREATE INDEX IF NOT EXISTS vistorias_org_agent_history_idx
  ON public.vistorias (organization_id, "agenteUid", "dataVistoria" DESC, id DESC)
  WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS agendamentos_org_agent_date_idx
  ON public.agendamentos (organization_id, agente_uid, data_agendada DESC);
CREATE INDEX IF NOT EXISTS active_sessions_agent_heartbeat_idx
  ON public.active_sessions (user_id, last_heartbeat_at DESC);
CREATE INDEX IF NOT EXISTS technical_events_agent_occurred_idx
  ON public.technical_events (user_id, occurred_at DESC)
  WHERE user_id IS NOT NULL;

COMMENT ON FUNCTION public.get_internal_customer_detail(text) IS
  'Bounded customer summary. Inspections are limited to the 50 most recent records; use list_internal_agent_inspections for complete agent history.';
COMMENT ON FUNCTION public.get_internal_customer_operations(text) IS
  'Bounded customer operations summary. Map points are limited to 250 records; use get_internal_agent_map for agent history.';

-- Preserve the bounded customer compatibility payload without exposing a
-- persisted/signed document URL. Downloads now require the agent endpoint.
CREATE OR REPLACE FUNCTION public.get_internal_customer_operations(p_customer_id text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
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
  BEGIN target_id := split_part(p_customer_id, ':', 2)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid_customer_id'; END;
  IF kind NOT IN ('organization', 'user') THEN RAISE EXCEPTION 'invalid_customer_id'; END IF;
  can_sensitive := private.can_access_sensitive_customer(p_customer_id);
  SELECT jsonb_build_object(
    'appointments', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', a.id, 'title', a.titulo, 'status', a.status, 'scheduled_at', a.data_agendada,
      'agent_name', a.agente_nome, 'address', CASE WHEN can_sensitive THEN a.endereco END,
      'latitude', CASE WHEN can_sensitive THEN a.lat END, 'longitude', CASE WHEN can_sensitive THEN a.lng END
    ) ORDER BY a.data_agendada DESC) FROM (SELECT * FROM public.agendamentos
      WHERE (kind = 'organization' AND organization_id = target_id) OR (kind = 'user' AND agente_uid = target_id)
      ORDER BY data_agendada DESC LIMIT 100) a), '[]'::jsonb),
    'map_points', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', v.id, 'protocol', v.protocolo, 'risk', v."nivelRisco", 'status', v.status,
      'occurred_at', v."dataVistoria", 'latitude', CASE WHEN can_sensitive THEN v.latitude END,
      'longitude', CASE WHEN can_sensitive THEN v.longitude END,
      'address', CASE WHEN can_sensitive THEN coalesce(v.endereco, concat_ws(' ', v."enderecoRua", v."enderecoNumero")) END
    ) ORDER BY v."dataVistoria" DESC) FROM (SELECT * FROM public.vistorias
      WHERE (kind = 'organization' AND organization_id = target_id) OR (kind = 'user' AND "agenteUid"::text = target_id::text)
      ORDER BY "dataVistoria" DESC LIMIT 250) v), '[]'::jsonb),
    'documents', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', v.id, 'protocol', v.protocolo, 'risk', v."nivelRisco", 'generated_at', v.laudo_gerado_em,
      'url', NULL, 'storage_location', v.storage_location
    ) ORDER BY v.laudo_gerado_em DESC) FROM (SELECT * FROM public.vistorias
      WHERE ((kind = 'organization' AND organization_id = target_id) OR (kind = 'user' AND "agenteUid"::text = target_id::text))
        AND laudo_gerado_em IS NOT NULL ORDER BY laudo_gerado_em DESC LIMIT 100) v), '[]'::jsonb),
    'reports', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', v.id, 'protocol', v.protocolo, 'risk', v."nivelRisco", 'score', v."pontuacaoTotal",
      'form_id', v."formularioId", 'form_version', v."formularioVersao", 'generated_at', v.relatorio_gerado_em
    ) ORDER BY coalesce(v.relatorio_gerado_em, v."dataVistoria") DESC) FROM (SELECT * FROM public.vistorias
      WHERE (kind = 'organization' AND organization_id = target_id) OR (kind = 'user' AND "agenteUid"::text = target_id::text)
      ORDER BY "dataVistoria" DESC LIMIT 250) v), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

CREATE TABLE IF NOT EXISTS private.inspection_ownership_audit (
  inspection_id uuid PRIMARY KEY,
  agent_uid_text text,
  organization_id uuid,
  issue text NOT NULL CHECK (issue IN (
    'missing_agent_uid', 'invalid_agent_uid', 'missing_organization',
    'agent_customer_mismatch', 'ambiguous_membership'
  )),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
REVOKE ALL ON private.inspection_ownership_audit FROM PUBLIC, anon, authenticated;

-- Backfill only when a persistent user link proves exactly one customer.
WITH membership_candidates AS (
  SELECT v.id inspection_id, min(m.organization_id::text)::uuid organization_id
  FROM public.vistorias v
  JOIN public.organization_members m ON m.user_id::text = v."agenteUid"::text
  WHERE v.organization_id IS NULL AND v."agenteUid" IS NOT NULL
  GROUP BY v.id
  HAVING count(DISTINCT m.organization_id) = 1
)
UPDATE public.vistorias v
SET organization_id = c.organization_id
FROM membership_candidates c
WHERE v.id = c.inspection_id AND v.organization_id IS NULL;

INSERT INTO private.inspection_ownership_audit(
  inspection_id, agent_uid_text, organization_id, issue, detail
)
SELECT v.id, v."agenteUid"::text, v.organization_id,
  CASE
    WHEN v."agenteUid" IS NULL THEN 'missing_agent_uid'
    WHEN u.uid IS NULL THEN 'invalid_agent_uid'
    WHEN v.organization_id IS NULL AND coalesce(mc.memberships, 0) > 1 THEN 'ambiguous_membership'
    WHEN v.organization_id IS NULL THEN 'missing_organization'
    ELSE 'agent_customer_mismatch'
  END,
  jsonb_build_object('membership_count', coalesce(mc.memberships, 0))
FROM public.vistorias v
LEFT JOIN public.users u ON u.uid::text = v."agenteUid"::text
LEFT JOIN LATERAL (
  SELECT count(DISTINCT m.organization_id)::integer memberships,
    bool_or(m.organization_id = v.organization_id) matches_customer
  FROM public.organization_members m
  WHERE m.user_id::text = v."agenteUid"::text
) mc ON true
WHERE v."agenteUid" IS NULL
   OR u.uid IS NULL
   OR v.organization_id IS NULL
   OR NOT coalesce(mc.matches_customer, false)
ON CONFLICT (inspection_id) DO UPDATE
SET agent_uid_text = EXCLUDED.agent_uid_text,
    organization_id = EXCLUDED.organization_id,
    issue = EXCLUDED.issue,
    detail = EXCLUDED.detail,
    detected_at = now(),
    resolved_at = NULL;

CREATE OR REPLACE FUNCTION private.resolve_internal_agent_scope(
  p_customer_id text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  customer_kind text := split_part(p_customer_id, ':', 1);
  customer_subject uuid;
  organization_id uuid;
  membership public.organization_members;
  customer_name text;
BEGIN
  IF NOT private.has_internal_permission('customer.read') THEN
    RAISE EXCEPTION 'agent_not_found_or_not_allowed' USING ERRCODE = 'P0002';
  END IF;
  BEGIN
    customer_subject := split_part(p_customer_id, ':', 2)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'agent_not_found_or_not_allowed' USING ERRCODE = 'P0002';
  END;

  IF customer_kind = 'organization' THEN
    SELECT m.* INTO membership
    FROM public.organization_members m
    JOIN public.users u ON u.uid = m.user_id
    WHERE m.organization_id = customer_subject AND m.user_id = p_user_id
    ORDER BY m.updated_at DESC LIMIT 1;
    SELECT o.id, o.display_name INTO organization_id, customer_name
    FROM public.organizations o WHERE o.id = customer_subject;
    IF organization_id IS NULL OR membership.id IS NULL THEN
      RAISE EXCEPTION 'agent_not_found_or_not_allowed' USING ERRCODE = 'P0002';
    END IF;
  ELSIF customer_kind = 'user' AND customer_subject = p_user_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.uid = p_user_id AND u.organization_id IS NULL
    ) THEN
      RAISE EXCEPTION 'agent_not_found_or_not_allowed' USING ERRCODE = 'P0002';
    END IF;
    SELECT coalesce(nullif(trim(u.name), ''), 'Conta individual')
    INTO customer_name FROM public.users u WHERE u.uid = p_user_id;
  ELSE
    RAISE EXCEPTION 'agent_not_found_or_not_allowed' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'kind', customer_kind,
    'customer_subject', customer_subject,
    'organization_id', organization_id,
    'customer_name', customer_name,
    'membership_id', membership.id,
    'membership_role', membership.role,
    'membership_status', membership.status,
    'joined_at', membership.joined_at,
    'can_view_sensitive', private.can_access_sensitive_customer(p_customer_id)
  );
END;
$$;
REVOKE ALL ON FUNCTION private.resolve_internal_agent_scope(text, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_internal_agent_summary(
  p_customer_id text,
  p_user_id uuid,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_risks text[] DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_form_id text DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  scope jsonb := private.resolve_internal_agent_scope(p_customer_id, p_user_id);
  v_to timestamptz := coalesce(p_to, now());
  v_from timestamptz := coalesce(p_from, coalesce(p_to, now()) - interval '30 days');
  previous_from timestamptz;
  can_sensitive boolean := coalesce((scope->>'can_view_sensitive')::boolean, false);
  result jsonb;
BEGIN
  IF v_from >= v_to OR v_to - v_from > interval '366 days' THEN
    RAISE EXCEPTION 'invalid_reporting_period';
  END IF;
  previous_from := v_from - (v_to - v_from);

  WITH base AS (
    SELECT v.*,
      coalesce(v."dataVistoria", v."criadoEm", '-infinity'::timestamptz) occurred_at
    FROM public.vistorias v
    WHERE v."agenteUid"::text = p_user_id::text
      AND ((scope->>'kind' = 'organization' AND v.organization_id = (scope->>'organization_id')::uuid)
        OR (scope->>'kind' = 'user' AND v.organization_id IS NULL))
      AND (coalesce(array_length(p_risks, 1), 0) = 0 OR lower(v."nivelRisco") = ANY(p_risks))
      AND (p_status IS NULL OR p_status = '' OR v.status = p_status)
      AND (p_form_id IS NULL OR p_form_id = '' OR v."formularioId" = p_form_id)
      AND (p_search IS NULL OR trim(p_search) = ''
        OR coalesce(v.protocolo, '') ILIKE '%' || trim(p_search) || '%'
        OR (can_sensitive AND concat_ws(' ', v.endereco, v."enderecoRua", v."enderecoNumero", v."enderecoBairro") ILIKE '%' || trim(p_search) || '%'))
  ), current_rows AS (
    SELECT * FROM base WHERE occurred_at >= v_from AND occurred_at < v_to
  ), previous_rows AS (
    SELECT * FROM base WHERE occurred_at >= previous_from AND occurred_at < v_from
  ), day_counts AS (
    SELECT occurred_at::date activity_date, count(*)::integer total
    FROM current_rows GROUP BY occurred_at::date ORDER BY occurred_at::date
  )
  SELECT jsonb_build_object(
    'agent', jsonb_build_object(
      'user_id', u.uid, 'name', u.name,
      'email', CASE WHEN can_sensitive THEN u.email END,
      'phone', CASE WHEN can_sensitive THEN u.phone END,
      'role', coalesce(scope->>'membership_role', u.role),
      'membership_status', coalesce(scope->>'membership_status', CASE WHEN u."isApproved" THEN 'active' ELSE 'blocked' END),
      'effective_access', CASE WHEN u."isApproved" AND coalesce(scope->>'membership_status', 'active') NOT IN ('suspended', 'removed') THEN 'active' ELSE 'blocked' END,
      'joined_at', coalesce(scope->>'joined_at', u."createdAt"::text),
      'last_login', u."lastLogin", 'customer_name', scope->>'customer_name',
      'plan_name', (SELECT p.name FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id
        WHERE ((scope->>'kind' = 'organization' AND s.organization_id = (scope->>'organization_id')::uuid)
          OR (scope->>'kind' = 'user' AND s.user_id = p_user_id))
        ORDER BY s.created_at DESC LIMIT 1)
    ),
    'period', jsonb_build_object('from', v_from, 'to', v_to, 'comparison_from', previous_from, 'comparison_to', v_from),
    'metrics', jsonb_build_object(
      'inspections', (SELECT count(*) FROM current_rows),
      'previous_inspections', (SELECT count(*) FROM previous_rows),
      'active_days', (SELECT count(DISTINCT occurred_at::date) FROM current_rows),
      'last_inspection_at', (SELECT max(occurred_at) FROM current_rows),
      'geolocated', (SELECT count(*) FROM current_rows WHERE latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180),
      'geolocated_percent', CASE WHEN (SELECT count(*) FROM current_rows) = 0 THEN 0 ELSE round(100.0 * (SELECT count(*) FROM current_rows WHERE latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180) / (SELECT count(*) FROM current_rows), 1) END,
      'document_complete', (SELECT count(*) FROM current_rows WHERE laudo_gerado_em IS NOT NULL AND relatorio_gerado_em IS NOT NULL),
      'document_complete_percent', CASE WHEN (SELECT count(*) FROM current_rows) = 0 THEN 0 ELSE round(100.0 * (SELECT count(*) FROM current_rows WHERE laudo_gerado_em IS NOT NULL AND relatorio_gerado_em IS NOT NULL) / (SELECT count(*) FROM current_rows), 1) END,
      'risk_distribution', jsonb_build_object(
        'r1', (SELECT count(*) FROM current_rows WHERE lower("nivelRisco") = 'r1'),
        'r2', (SELECT count(*) FROM current_rows WHERE lower("nivelRisco") = 'r2'),
        'r3', (SELECT count(*) FROM current_rows WHERE lower("nivelRisco") = 'r3'),
        'r4', (SELECT count(*) FROM current_rows WHERE lower("nivelRisco") = 'r4')
      )
    ),
    'activity_by_day', coalesce((SELECT jsonb_agg(jsonb_build_object('day', activity_date, 'total', total) ORDER BY activity_date) FROM day_counts), '[]'::jsonb),
    'last_session', (SELECT jsonb_build_object('id', s.id, 'device_name', s.device_name, 'platform', s.platform, 'status', s.status, 'last_heartbeat_at', s.last_heartbeat_at)
      FROM public.active_sessions s WHERE s.user_id = p_user_id ORDER BY s.last_heartbeat_at DESC LIMIT 1),
    'last_technical_activity', (SELECT jsonb_build_object('app_version', e.app_version, 'platform', e.platform, 'category', e.category, 'severity', e.severity, 'occurred_at', e.occurred_at)
      FROM public.technical_events e WHERE e.user_id = p_user_id AND private.has_internal_permission('technical.read') ORDER BY e.occurred_at DESC LIMIT 1),
    'can_view_sensitive', can_sensitive
  ) INTO result
  FROM public.users u WHERE u.uid = p_user_id;

  IF result IS NULL THEN RAISE EXCEPTION 'agent_not_found_or_not_allowed' USING ERRCODE = 'P0002'; END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_internal_agent_inspections(
  p_customer_id text,
  p_user_id uuid,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_risks text[] DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_form_id text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_cursor_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_page_size integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  scope jsonb := private.resolve_internal_agent_scope(p_customer_id, p_user_id);
  can_sensitive boolean := coalesce((scope->>'can_view_sensitive')::boolean, false);
  page_size integer := CASE WHEN p_page_size IN (25, 50, 100) THEN p_page_size ELSE 25 END;
  v_to timestamptz := coalesce(p_to, now());
  v_from timestamptz := coalesce(p_from, coalesce(p_to, now()) - interval '30 days');
  result jsonb;
BEGIN
  IF v_from >= v_to OR (p_cursor_at IS NULL) <> (p_cursor_id IS NULL) THEN
    RAISE EXCEPTION 'invalid_agent_inspection_query';
  END IF;
  WITH filtered AS (
    SELECT v.*, coalesce(v."dataVistoria", v."criadoEm", '-infinity'::timestamptz) occurred_at
    FROM public.vistorias v
    WHERE v."agenteUid"::text = p_user_id::text
      AND ((scope->>'kind' = 'organization' AND v.organization_id = (scope->>'organization_id')::uuid)
        OR (scope->>'kind' = 'user' AND v.organization_id IS NULL))
      AND coalesce(v."dataVistoria", v."criadoEm", '-infinity'::timestamptz) >= v_from
      AND coalesce(v."dataVistoria", v."criadoEm", '-infinity'::timestamptz) < v_to
      AND (coalesce(array_length(p_risks, 1), 0) = 0 OR lower(v."nivelRisco") = ANY(p_risks))
      AND (p_status IS NULL OR p_status = '' OR v.status = p_status)
      AND (p_form_id IS NULL OR p_form_id = '' OR v."formularioId" = p_form_id)
      AND (p_search IS NULL OR trim(p_search) = '' OR coalesce(v.protocolo, '') ILIKE '%' || trim(p_search) || '%'
        OR (can_sensitive AND concat_ws(' ', v.endereco, v."enderecoRua", v."enderecoNumero", v."enderecoBairro") ILIKE '%' || trim(p_search) || '%'))
  ), page_rows AS (
    SELECT * FROM filtered
    WHERE p_cursor_at IS NULL OR (occurred_at, id) < (p_cursor_at, p_cursor_id)
    ORDER BY occurred_at DESC, id DESC LIMIT page_size
  ), payload AS (
    SELECT jsonb_build_object(
      'id', id, 'protocol', protocolo, 'risk', "nivelRisco", 'status', status,
      'occurred_at', occurred_at, 'form_id', "formularioId", 'form_version', "formularioVersao",
      'score', "pontuacaoTotal", 'synchronized', sincronizado,
      'address', CASE WHEN can_sensitive THEN coalesce(endereco, concat_ws(' ', "enderecoRua", "enderecoNumero", "enderecoBairro")) END,
      'has_coordinates', latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180,
      'documents', jsonb_build_object('laudo', laudo_gerado_em IS NOT NULL, 'relatorio', relatorio_gerado_em IS NOT NULL, 'termo', termo_gerado_em IS NOT NULL)
    ) item, occurred_at, id FROM page_rows
  )
  SELECT jsonb_build_object(
    'items', coalesce((SELECT jsonb_agg(item ORDER BY occurred_at DESC, id DESC) FROM payload), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered), 'page_size', page_size,
    'next_cursor', CASE WHEN (SELECT count(*) FROM page_rows) = page_size THEN
      (SELECT jsonb_build_object('occurred_at', occurred_at, 'id', id) FROM page_rows ORDER BY occurred_at, id LIMIT 1)
      ELSE NULL END,
    'can_view_sensitive', can_sensitive
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_internal_agent_map(
  p_customer_id text,
  p_user_id uuid,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_risks text[] DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_form_id text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_west double precision DEFAULT NULL,
  p_south double precision DEFAULT NULL,
  p_east double precision DEFAULT NULL,
  p_north double precision DEFAULT NULL,
  p_zoom integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  scope jsonb := private.resolve_internal_agent_scope(p_customer_id, p_user_id);
  can_sensitive boolean := coalesce((scope->>'can_view_sensitive')::boolean, false);
  grid double precision := CASE WHEN p_zoom <= 7 THEN 1.0 WHEN p_zoom <= 10 THEN 0.1 WHEN p_zoom <= 13 THEN 0.02 ELSE 0.002 END;
  v_to timestamptz := coalesce(p_to, now());
  v_from timestamptz := coalesce(p_from, coalesce(p_to, now()) - interval '30 days');
  result jsonb;
BEGIN
  IF v_from >= v_to OR p_zoom NOT BETWEEN 1 AND 22 THEN RAISE EXCEPTION 'invalid_agent_map_query'; END IF;
  WITH filtered AS (
    SELECT v.* FROM public.vistorias v
    WHERE v."agenteUid"::text = p_user_id::text
      AND ((scope->>'kind' = 'organization' AND v.organization_id = (scope->>'organization_id')::uuid)
        OR (scope->>'kind' = 'user' AND v.organization_id IS NULL))
      AND coalesce(v."dataVistoria", v."criadoEm", '-infinity'::timestamptz) >= v_from
      AND coalesce(v."dataVistoria", v."criadoEm", '-infinity'::timestamptz) < v_to
      AND (coalesce(array_length(p_risks, 1), 0) = 0 OR lower(v."nivelRisco") = ANY(p_risks))
      AND (p_status IS NULL OR p_status = '' OR v.status = p_status)
      AND (p_form_id IS NULL OR p_form_id = '' OR v."formularioId" = p_form_id)
      AND (p_search IS NULL OR trim(p_search) = '' OR coalesce(v.protocolo, '') ILIKE '%' || trim(p_search) || '%'
        OR (can_sensitive AND concat_ws(' ', v.endereco, v."enderecoRua", v."enderecoNumero", v."enderecoBairro") ILIKE '%' || trim(p_search) || '%'))
  ), located AS (
    SELECT * FROM filtered WHERE latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
  ), viewport AS (
    SELECT * FROM located WHERE p_west IS NULL OR (longitude BETWEEN p_west AND p_east AND latitude BETWEEN p_south AND p_north)
  ), clusters AS (
    SELECT floor(latitude / grid) lat_cell, floor(longitude / grid) lng_cell,
      avg(latitude) latitude, avg(longitude) longitude, count(*)::integer point_count,
      max("dataVistoria") last_occurred_at,
      jsonb_build_object(
        'r1', count(*) FILTER (WHERE lower("nivelRisco") = 'r1'),
        'r2', count(*) FILTER (WHERE lower("nivelRisco") = 'r2'),
        'r3', count(*) FILTER (WHERE lower("nivelRisco") = 'r3'),
        'r4', count(*) FILTER (WHERE lower("nivelRisco") = 'r4')
      ) risk_distribution,
      min(id::text) representative_id
    FROM viewport GROUP BY floor(latitude / grid), floor(longitude / grid)
  )
  SELECT jsonb_build_object(
    'points', CASE WHEN can_sensitive THEN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', representative_id, 'latitude', latitude, 'longitude', longitude,
      'count', point_count, 'risk_distribution', risk_distribution,
      'occurred_at', last_occurred_at
    ) ORDER BY point_count DESC) FROM clusters), '[]'::jsonb) ELSE '[]'::jsonb END,
    'filtered_total', (SELECT count(*) FROM filtered),
    'geolocated_total', (SELECT count(*) FROM located),
    'without_coordinates', (SELECT count(*) FROM filtered) - (SELECT count(*) FROM located),
    'can_view_sensitive', can_sensitive
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_internal_agent_operations(
  p_customer_id text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  scope jsonb := private.resolve_internal_agent_scope(p_customer_id, p_user_id);
  can_sensitive boolean := coalesce((scope->>'can_view_sensitive')::boolean, false);
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'appointments', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', a.id, 'title', a.titulo, 'status', a.status, 'scheduled_at', a.data_agendada,
      'address', CASE WHEN can_sensitive THEN a.endereco END,
      'latitude', CASE WHEN can_sensitive THEN a.lat END,
      'longitude', CASE WHEN can_sensitive THEN a.lng END
    ) ORDER BY a.data_agendada DESC)
      FROM public.agendamentos a WHERE a.agente_uid = p_user_id
        AND ((scope->>'kind' = 'organization' AND a.organization_id = (scope->>'organization_id')::uuid)
          OR (scope->>'kind' = 'user' AND a.organization_id IS NULL))), '[]'::jsonb),
    'documents', coalesce((SELECT jsonb_agg(document ORDER BY generated_at DESC) FROM (
      SELECT jsonb_build_object('document_id', v.id || ':laudo', 'inspection_id', v.id,
        'kind', 'laudo', 'protocol', v.protocolo, 'generated_at', v.laudo_gerado_em,
        'storage_location', v.storage_location, 'downloadable', can_sensitive AND v.storage_location = 'supabase') document,
        v.laudo_gerado_em generated_at
      FROM public.vistorias v WHERE v."agenteUid"::text = p_user_id::text AND v.laudo_gerado_em IS NOT NULL
        AND ((scope->>'kind' = 'organization' AND v.organization_id = (scope->>'organization_id')::uuid) OR (scope->>'kind' = 'user' AND v.organization_id IS NULL))
      UNION ALL
      SELECT jsonb_build_object('document_id', v.id || ':relatorio', 'inspection_id', v.id,
        'kind', 'relatorio', 'protocol', v.protocolo, 'generated_at', v.relatorio_gerado_em,
        'storage_location', v.storage_location, 'downloadable', false), v.relatorio_gerado_em
      FROM public.vistorias v WHERE v."agenteUid"::text = p_user_id::text AND v.relatorio_gerado_em IS NOT NULL
        AND ((scope->>'kind' = 'organization' AND v.organization_id = (scope->>'organization_id')::uuid) OR (scope->>'kind' = 'user' AND v.organization_id IS NULL))
      UNION ALL
      SELECT jsonb_build_object('document_id', v.id || ':termo', 'inspection_id', v.id,
        'kind', 'termo', 'protocol', v.protocolo, 'generated_at', v.termo_gerado_em,
        'storage_location', v.storage_location, 'downloadable', false), v.termo_gerado_em
      FROM public.vistorias v WHERE v."agenteUid"::text = p_user_id::text AND v.termo_gerado_em IS NOT NULL
        AND ((scope->>'kind' = 'organization' AND v.organization_id = (scope->>'organization_id')::uuid) OR (scope->>'kind' = 'user' AND v.organization_id IS NULL))
    ) documents), '[]'::jsonb),
    'sessions', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', s.id, 'device_name', s.device_name, 'platform', s.platform, 'status', s.status,
      'started_at', s.started_at, 'last_heartbeat_at', s.last_heartbeat_at,
      'ended_at', s.ended_at, 'end_reason', s.end_reason
    ) ORDER BY s.last_heartbeat_at DESC) FROM public.active_sessions s WHERE s.user_id = p_user_id), '[]'::jsonb),
    'technical_activity', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', e.id, 'app_version', e.app_version, 'platform', e.platform, 'category', e.category,
      'severity', e.severity, 'summary', e.summary, 'correlation_id', e.correlation_id, 'occurred_at', e.occurred_at
    ) ORDER BY e.occurred_at DESC) FROM (SELECT * FROM public.technical_events WHERE user_id = p_user_id ORDER BY occurred_at DESC LIMIT 100) e
      WHERE private.has_internal_permission('technical.read')), '[]'::jsonb),
    'can_view_sensitive', can_sensitive
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.authorize_internal_agent_document(
  p_customer_id text,
  p_user_id uuid,
  p_inspection_id uuid,
  p_kind text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  scope jsonb := private.resolve_internal_agent_scope(p_customer_id, p_user_id);
  inspection public.vistorias;
  storage_path text;
BEGIN
  IF NOT coalesce((scope->>'can_view_sensitive')::boolean, false) THEN
    RAISE EXCEPTION 'sensitive_support_access_required' USING ERRCODE = '42501';
  END IF;
  IF p_kind <> 'laudo' THEN RAISE EXCEPTION 'document_download_unavailable' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO inspection FROM public.vistorias v
  WHERE v.id = p_inspection_id AND v."agenteUid"::text = p_user_id::text
    AND ((scope->>'kind' = 'organization' AND v.organization_id = (scope->>'organization_id')::uuid)
      OR (scope->>'kind' = 'user' AND v.organization_id IS NULL));
  IF inspection.id IS NULL OR inspection.laudo_gerado_em IS NULL OR inspection.storage_location <> 'supabase' THEN
    RAISE EXCEPTION 'document_download_unavailable' USING ERRCODE = 'P0002';
  END IF;
  storage_path := substring(inspection.laudo_url from '/object/(?:sign|authenticated|public)/laudos/([^?]+)');
  storage_path := coalesce(storage_path, concat_ws('/', coalesce(nullif(inspection.municipio, ''), 'geral'), inspection.id || '.pdf'));
  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, metadata)
  VALUES (auth.uid(), private.current_internal_role(), 'agent.document.authorize', 'inspection_document', inspection.id || ':laudo', 'allowed',
    jsonb_build_object('customer_id', p_customer_id, 'user_id', p_user_id, 'expires_in_seconds', 60));
  RETURN jsonb_build_object('bucket', 'laudos', 'path', storage_path, 'expires_in', 60, 'filename', coalesce(inspection.protocolo, inspection.id::text) || '.pdf');
END;
$$;

CREATE OR REPLACE FUNCTION public.mutate_internal_agent_access(
  p_customer_id text,
  p_user_id uuid,
  p_action text,
  p_session_id uuid,
  p_new_password text,
  p_reason text,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  scope jsonb := private.resolve_internal_agent_scope(p_customer_id, p_user_id);
  actor uuid := auth.uid();
  before_approved boolean;
  previous_result jsonb;
  v_request_hash text;
  affected integer := 0;
  v_result jsonb;
BEGIN
  IF NOT private.has_internal_permission('customer.write', actor) THEN
    RAISE EXCEPTION 'agent_access_management_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_aal2() THEN RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501'; END IF;
  IF char_length(trim(coalesce(p_reason, ''))) < 8 THEN RAISE EXCEPTION 'reason_required'; END IF;
  IF p_action NOT IN ('block', 'unblock', 'terminate_session', 'reset_password') THEN RAISE EXCEPTION 'invalid_agent_access_action'; END IF;
  IF p_action = 'reset_password' AND (char_length(coalesce(p_new_password, '')) < 12 OR p_new_password !~ '[A-Z]' OR p_new_password !~ '[a-z]' OR p_new_password !~ '[0-9]') THEN
    RAISE EXCEPTION 'strong_password_required';
  END IF;
  v_request_hash := md5(concat_ws('|', p_customer_id, p_user_id, p_action, p_session_id, trim(p_reason)));
  SELECT io.result INTO previous_result FROM public.internal_operations io
  WHERE io.actor_id = actor AND io.operation_id = p_operation_id AND io.request_hash = v_request_hash;
  IF previous_result IS NOT NULL THEN RETURN previous_result; END IF;
  INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash)
  VALUES (p_operation_id, actor, 'agent.access.' || p_action, v_request_hash);

  SELECT u."isApproved" INTO before_approved FROM public.users u WHERE u.uid = p_user_id FOR UPDATE;
  IF p_action IN ('block', 'unblock') THEN
    UPDATE public.users SET "isApproved" = (p_action = 'unblock') WHERE uid = p_user_id;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF p_action = 'block' THEN
      UPDATE public.active_sessions SET status = 'revoked', ended_at = now(), ended_by = actor, end_reason = 'agent_blocked'
      WHERE user_id = p_user_id AND status = 'active';
      DELETE FROM auth.sessions WHERE user_id = p_user_id;
    END IF;
  ELSIF p_action = 'terminate_session' THEN
    UPDATE public.active_sessions SET status = 'revoked', ended_at = now(), ended_by = actor, end_reason = left(trim(p_reason), 200)
    WHERE id = p_session_id AND user_id = p_user_id AND status = 'active'
      AND ((scope->>'kind' = 'organization' AND organization_id = (scope->>'organization_id')::uuid)
        OR (scope->>'kind' = 'user' AND organization_id IS NULL));
    GET DIAGNOSTICS affected = ROW_COUNT;
  ELSE
    UPDATE auth.users SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')), updated_at = now()
    WHERE id = p_user_id;
    GET DIAGNOSTICS affected = ROW_COUNT;
    UPDATE public.active_sessions SET status = 'revoked', ended_at = now(), ended_by = actor, end_reason = 'password_reset'
    WHERE user_id = p_user_id AND status = 'active';
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
  END IF;
  IF affected <> 1 THEN RAISE EXCEPTION 'agent_access_target_not_found' USING ERRCODE = 'P0002'; END IF;

  v_result := jsonb_build_object('ok', true, 'action', p_action, 'user_id', p_user_id);
  UPDATE public.internal_operations io SET status = 'succeeded', result = v_result, completed_at = now()
  WHERE io.actor_id = actor AND io.operation_id = p_operation_id;
  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, reason, metadata)
  VALUES (actor, private.current_internal_role(actor), 'agent.access.' || p_action, 'customer_user', p_user_id::text, 'allowed', left(trim(p_reason), 500),
    jsonb_build_object('customer_id', p_customer_id, 'session_id', p_session_id, 'before_approved', before_approved,
      'after_approved', CASE WHEN p_action = 'block' THEN false WHEN p_action = 'unblock' THEN true ELSE before_approved END));
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_internal_agent_summary(text, uuid, timestamptz, timestamptz, text[], text, text, text),
  public.list_internal_agent_inspections(text, uuid, timestamptz, timestamptz, text[], text, text, text, timestamptz, uuid, integer),
  public.get_internal_agent_map(text, uuid, timestamptz, timestamptz, text[], text, text, text, double precision, double precision, double precision, double precision, integer),
  public.get_internal_agent_operations(text, uuid),
  public.authorize_internal_agent_document(text, uuid, uuid, text),
  public.mutate_internal_agent_access(text, uuid, text, uuid, text, text, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_internal_agent_summary(text, uuid, timestamptz, timestamptz, text[], text, text, text),
  public.list_internal_agent_inspections(text, uuid, timestamptz, timestamptz, text[], text, text, text, timestamptz, uuid, integer),
  public.get_internal_agent_map(text, uuid, timestamptz, timestamptz, text[], text, text, text, double precision, double precision, double precision, double precision, integer),
  public.get_internal_agent_operations(text, uuid),
  public.authorize_internal_agent_document(text, uuid, uuid, text),
  public.mutate_internal_agent_access(text, uuid, text, uuid, text, text, uuid)
TO authenticated;

NOTIFY pgrst, 'reload schema';
