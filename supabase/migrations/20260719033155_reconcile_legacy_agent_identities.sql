-- Reconcile explicitly verified legacy identities with their current customer
-- account without rewriting the authorship stored in operational records.

CREATE TABLE private.internal_agent_identity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text NOT NULL CHECK (
    customer_id ~ '^(user|organization):[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  canonical_user_id uuid NOT NULL REFERENCES public.users(uid) ON DELETE RESTRICT,
  legacy_user_id uuid NOT NULL REFERENCES public.users(uid) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (char_length(trim(reason)) >= 8),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence) = 'object'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (canonical_user_id <> legacy_user_id)
);

CREATE UNIQUE INDEX internal_agent_identity_links_active_legacy_uidx
  ON private.internal_agent_identity_links (legacy_user_id)
  WHERE active;
CREATE UNIQUE INDEX internal_agent_identity_links_customer_pair_uidx
  ON private.internal_agent_identity_links (customer_id, canonical_user_id, legacy_user_id);
CREATE INDEX internal_agent_identity_links_canonical_idx
  ON private.internal_agent_identity_links (customer_id, canonical_user_id)
  WHERE active;

REVOKE ALL ON private.internal_agent_identity_links FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.resolve_internal_agent_ids(
  p_customer_id text,
  p_user_id uuid
)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT array_agg(identity_id ORDER BY is_canonical DESC, identity_id)
  FROM (
    SELECT p_user_id AS identity_id, true AS is_canonical
    UNION ALL
    SELECT l.legacy_user_id, false
    FROM private.internal_agent_identity_links l
    WHERE l.customer_id = p_customer_id
      AND l.canonical_user_id = p_user_id
      AND l.active
  ) identities;
$$;

REVOKE ALL ON FUNCTION private.resolve_internal_agent_ids(text, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.internal_agent_record_in_scope(
  p_customer_id text,
  p_user_id uuid,
  p_record_user_id text,
  p_record_organization_id uuid
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM unnest(private.resolve_internal_agent_ids(p_customer_id, p_user_id)) AS identity(identity_id)
    WHERE identity.identity_id::text = p_record_user_id
      AND (
        (split_part(p_customer_id, ':', 1) = 'user' AND p_record_organization_id IS NULL)
        OR (
          split_part(p_customer_id, ':', 1) = 'organization'
          AND (
            p_record_organization_id = split_part(p_customer_id, ':', 2)::uuid
            OR (p_record_organization_id IS NULL AND identity.identity_id <> p_user_id)
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION private.internal_agent_record_in_scope(text, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;

-- This is an explicit, reviewed link. It is intentionally not inferred from
-- names: homonyms must never cause histories from different people to merge.
INSERT INTO private.internal_agent_identity_links(
  customer_id,
  canonical_user_id,
  legacy_user_id,
  reason,
  evidence
)
SELECT
  'user:adc381cc-bbda-472b-9669-17150102b0a6',
  current_user_record.uid,
  legacy_user_record.uid,
  'Conta atual e conta legada do mesmo cliente confirmadas por revisao operacional',
  jsonb_build_object(
    'reviewed_match', true,
    'current_email', current_user_record.email,
    'legacy_email', legacy_user_record.email,
    'legacy_inspection_count', (
      SELECT count(*)
      FROM public.vistorias v
      WHERE v."agenteUid"::text = legacy_user_record.uid::text
    )
  )
FROM public.users current_user_record
JOIN public.users legacy_user_record
  ON legacy_user_record.uid = 'd259fdb1-51db-417d-aec7-912ad358a28d'::uuid
WHERE current_user_record.uid = 'adc381cc-bbda-472b-9669-17150102b0a6'::uuid
  AND current_user_record.organization_id IS NULL
  AND lower(trim(current_user_record.name)) = lower(trim(legacy_user_record.name))
ON CONFLICT (customer_id, canonical_user_id, legacy_user_id)
DO UPDATE SET
  reason = EXCLUDED.reason,
  evidence = EXCLUDED.evidence,
  active = true,
  updated_at = now();

-- An individual account legitimately owns records without organization_id.
UPDATE private.inspection_ownership_audit audit
SET resolved_at = coalesce(audit.resolved_at, now()),
    detail = audit.detail || jsonb_build_object(
      'resolution', 'valid_individual_customer',
      'resolved_user_id', u.uid
    )
FROM public.users u
WHERE audit.issue = 'missing_organization'
  AND audit.agent_uid_text = u.uid::text
  AND u.organization_id IS NULL
  AND u.role <> 'master_admin';

-- A reviewed identity link resolves ownership while retaining the original UID.
UPDATE private.inspection_ownership_audit audit
SET resolved_at = coalesce(audit.resolved_at, now()),
    detail = audit.detail || jsonb_build_object(
      'resolution', 'linked_legacy_identity',
      'customer_id', link.customer_id,
      'canonical_user_id', link.canonical_user_id,
      'legacy_user_id', link.legacy_user_id
    )
FROM private.internal_agent_identity_links link
WHERE link.active
  AND audit.agent_uid_text = link.legacy_user_id::text;

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
  identity_ids uuid[] := private.resolve_internal_agent_ids(p_customer_id, p_user_id);
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
    WHERE private.internal_agent_record_in_scope(
        p_customer_id, p_user_id, v."agenteUid"::text, v.organization_id
      )
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
      'linked_legacy_identities', greatest(coalesce(array_length(identity_ids, 1), 1) - 1, 0),
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
      FROM public.active_sessions s
      WHERE s.user_id = ANY(identity_ids)
        AND (s.user_id = p_user_id OR s.status <> 'active')
      ORDER BY s.last_heartbeat_at DESC LIMIT 1),
    'last_technical_activity', (SELECT jsonb_build_object('app_version', e.app_version, 'platform', e.platform, 'category', e.category, 'severity', e.severity, 'occurred_at', e.occurred_at)
      FROM public.technical_events e
      WHERE e.user_id = ANY(identity_ids)
        AND private.has_internal_permission('technical.read')
      ORDER BY e.occurred_at DESC LIMIT 1),
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
    WHERE private.internal_agent_record_in_scope(
        p_customer_id, p_user_id, v."agenteUid"::text, v.organization_id
      )
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
    WHERE private.internal_agent_record_in_scope(
        p_customer_id, p_user_id, v."agenteUid"::text, v.organization_id
      )
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
  identity_ids uuid[] := private.resolve_internal_agent_ids(p_customer_id, p_user_id);
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
      FROM public.agendamentos a
      WHERE private.internal_agent_record_in_scope(
        p_customer_id, p_user_id, a.agente_uid::text, a.organization_id
      )), '[]'::jsonb),
    'documents', coalesce((SELECT jsonb_agg(document ORDER BY generated_at DESC) FROM (
      SELECT jsonb_build_object('document_id', v.id || ':laudo', 'inspection_id', v.id,
        'kind', 'laudo', 'protocol', v.protocolo, 'generated_at', v.laudo_gerado_em,
        'storage_location', v.storage_location, 'downloadable', can_sensitive AND v.storage_location = 'supabase') document,
        v.laudo_gerado_em generated_at
      FROM public.vistorias v
      WHERE private.internal_agent_record_in_scope(p_customer_id, p_user_id, v."agenteUid"::text, v.organization_id)
        AND v.laudo_gerado_em IS NOT NULL
      UNION ALL
      SELECT jsonb_build_object('document_id', v.id || ':relatorio', 'inspection_id', v.id,
        'kind', 'relatorio', 'protocol', v.protocolo, 'generated_at', v.relatorio_gerado_em,
        'storage_location', v.storage_location, 'downloadable', false), v.relatorio_gerado_em
      FROM public.vistorias v
      WHERE private.internal_agent_record_in_scope(p_customer_id, p_user_id, v."agenteUid"::text, v.organization_id)
        AND v.relatorio_gerado_em IS NOT NULL
      UNION ALL
      SELECT jsonb_build_object('document_id', v.id || ':termo', 'inspection_id', v.id,
        'kind', 'termo', 'protocol', v.protocolo, 'generated_at', v.termo_gerado_em,
        'storage_location', v.storage_location, 'downloadable', false), v.termo_gerado_em
      FROM public.vistorias v
      WHERE private.internal_agent_record_in_scope(p_customer_id, p_user_id, v."agenteUid"::text, v.organization_id)
        AND v.termo_gerado_em IS NOT NULL
    ) documents), '[]'::jsonb),
    'sessions', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', s.id, 'device_name', s.device_name, 'platform', s.platform, 'status', s.status,
      'started_at', s.started_at, 'last_heartbeat_at', s.last_heartbeat_at,
      'ended_at', s.ended_at, 'end_reason', s.end_reason
    ) ORDER BY s.last_heartbeat_at DESC)
      FROM public.active_sessions s
      WHERE s.user_id = ANY(identity_ids)
        AND (s.user_id = p_user_id OR s.status <> 'active')), '[]'::jsonb),
    'technical_activity', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', e.id, 'app_version', e.app_version, 'platform', e.platform, 'category', e.category,
      'severity', e.severity, 'summary', e.summary, 'correlation_id', e.correlation_id, 'occurred_at', e.occurred_at
    ) ORDER BY e.occurred_at DESC)
      FROM (
        SELECT * FROM public.technical_events
        WHERE user_id = ANY(identity_ids)
        ORDER BY occurred_at DESC LIMIT 100
      ) e WHERE private.has_internal_permission('technical.read')), '[]'::jsonb),
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
  WHERE v.id = p_inspection_id
    AND private.internal_agent_record_in_scope(
      p_customer_id, p_user_id, v."agenteUid"::text, v.organization_id
    );
  IF inspection.id IS NULL OR inspection.laudo_gerado_em IS NULL OR inspection.storage_location <> 'supabase' THEN
    RAISE EXCEPTION 'document_download_unavailable' USING ERRCODE = 'P0002';
  END IF;
  storage_path := substring(inspection.laudo_url from '/object/(?:sign|authenticated|public)/laudos/([^?]+)');
  storage_path := coalesce(storage_path, concat_ws('/', coalesce(nullif(inspection.municipio, ''), 'geral'), inspection.id || '.pdf'));
  INSERT INTO public.internal_access_events(actor_id, actor_role, action, target_type, target_id, result, metadata)
  VALUES (auth.uid(), private.current_internal_role(), 'agent.document.authorize', 'inspection_document', inspection.id || ':laudo', 'allowed',
    jsonb_build_object('customer_id', p_customer_id, 'user_id', p_user_id, 'source_agent_uid', inspection."agenteUid", 'expires_in_seconds', 60));
  RETURN jsonb_build_object('bucket', 'laudos', 'path', storage_path, 'expires_in', 60, 'filename', coalesce(inspection.protocolo, inspection.id::text) || '.pdf');
END;
$$;

-- Keep the bounded customer compatibility payload, but make individual
-- customer tabs identity-aware as well.
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
      WHERE (kind = 'organization' AND organization_id = target_id)
        OR (kind = 'user' AND private.internal_agent_record_in_scope(
          p_customer_id, target_id, agente_uid::text, organization_id
        ))
      ORDER BY data_agendada DESC LIMIT 100) a), '[]'::jsonb),
    'map_points', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', v.id, 'protocol', v.protocolo, 'risk', v."nivelRisco", 'status', v.status,
      'occurred_at', v."dataVistoria", 'latitude', CASE WHEN can_sensitive THEN v.latitude END,
      'longitude', CASE WHEN can_sensitive THEN v.longitude END,
      'address', CASE WHEN can_sensitive THEN coalesce(v.endereco, concat_ws(' ', v."enderecoRua", v."enderecoNumero")) END
    ) ORDER BY v."dataVistoria" DESC) FROM (SELECT * FROM public.vistorias
      WHERE (kind = 'organization' AND organization_id = target_id)
        OR (kind = 'user' AND private.internal_agent_record_in_scope(
          p_customer_id, target_id, "agenteUid"::text, organization_id
        ))
      ORDER BY "dataVistoria" DESC LIMIT 250) v), '[]'::jsonb),
    'documents', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', v.id, 'protocol', v.protocolo, 'risk', v."nivelRisco", 'generated_at', v.laudo_gerado_em,
      'url', NULL, 'storage_location', v.storage_location
    ) ORDER BY v.laudo_gerado_em DESC) FROM (SELECT * FROM public.vistorias
      WHERE ((kind = 'organization' AND organization_id = target_id)
        OR (kind = 'user' AND private.internal_agent_record_in_scope(
          p_customer_id, target_id, "agenteUid"::text, organization_id
        )))
        AND laudo_gerado_em IS NOT NULL ORDER BY laudo_gerado_em DESC LIMIT 100) v), '[]'::jsonb),
    'reports', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', v.id, 'protocol', v.protocolo, 'risk', v."nivelRisco", 'score', v."pontuacaoTotal",
      'form_id', v."formularioId", 'form_version', v."formularioVersao", 'generated_at', v.relatorio_gerado_em
    ) ORDER BY coalesce(v.relatorio_gerado_em, v."dataVistoria") DESC) FROM (SELECT * FROM public.vistorias
      WHERE (kind = 'organization' AND organization_id = target_id)
        OR (kind = 'user' AND private.internal_agent_record_in_scope(
          p_customer_id, target_id, "agenteUid"::text, organization_id
        ))
      ORDER BY "dataVistoria" DESC LIMIT 250) v), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_internal_customer_detail(p_customer_id text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  customer_kind text := split_part(p_customer_id, ':', 1);
  subject_id uuid;
  can_sensitive boolean;
  identity_ids uuid[];
  result jsonb;
BEGIN
  IF NOT private.has_internal_permission('customer.read') THEN
    RAISE EXCEPTION 'customer_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  BEGIN subject_id := split_part(p_customer_id, ':', 2)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid_customer_id'; END;
  IF customer_kind NOT IN ('organization', 'user') OR subject_id IS NULL THEN
    RAISE EXCEPTION 'invalid_customer_id';
  END IF;
  can_sensitive := private.can_access_sensitive_customer(p_customer_id);

  IF customer_kind = 'organization' THEN
    SELECT jsonb_build_object(
      'customer', jsonb_build_object(
        'customer_id', p_customer_id, 'kind', 'organization', 'subject_id', o.id,
        'display_name', o.display_name, 'legal_name', o.legal_name,
        'municipality_name', o.municipality_name, 'state_code', o.state_code,
        'status', o.status,
        'contact_name', CASE WHEN private.current_internal_role() = 'owner' THEN o.contact_name END,
        'contact_email', CASE WHEN private.current_internal_role() = 'owner' THEN o.contact_email END,
        'contract_reference', CASE WHEN private.current_internal_role() = 'owner' THEN o.contract_reference END,
        'session_policy', o.session_policy, 'session_timeout_minutes', o.session_timeout_minutes,
        'offline_tolerance_minutes', o.offline_tolerance_minutes,
        'created_at', o.created_at, 'updated_at', o.updated_at
      ),
      'subscription', (
        SELECT jsonb_build_object(
          'id', s.id, 'status', s.status, 'plan_id', s.plan_id, 'plan_name', p.name,
          'starts_at', s.starts_at, 'trial_ends_at', s.trial_ends_at,
          'current_period_start', s.current_period_start, 'current_period_end', s.current_period_end,
          'grace_ends_at', s.grace_ends_at, 'canceled_at', s.canceled_at, 'overrides', s.overrides
        )
        FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id
        WHERE s.organization_id = o.id ORDER BY s.created_at DESC LIMIT 1
      ),
      'usage', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'resource_code', c.resource_code, 'consumed', c.consumed,
          'period_start', c.period_start, 'period_end', c.period_end,
          'hard_limit', limits.hard_limit, 'warning_percent', limits.warning_percent
        ) ORDER BY c.resource_code)
        FROM public.usage_counters c
        LEFT JOIN LATERAL (
          SELECT pl.hard_limit, pl.warning_percent
          FROM public.subscriptions s2
          JOIN public.plan_limits pl ON pl.plan_id = s2.plan_id AND pl.resource_code = c.resource_code
          WHERE s2.organization_id = o.id ORDER BY s2.created_at DESC LIMIT 1
        ) limits ON true
        WHERE c.organization_id = o.id
      ), '[]'::jsonb),
      'users', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', m.id, 'user_id', m.user_id, 'name', u.name,
          'email', CASE WHEN can_sensitive THEN u.email END,
          'role', m.role, 'status', m.status, 'joined_at', m.joined_at, 'last_login', u."lastLogin"
        ) ORDER BY u.name NULLS LAST)
        FROM public.organization_members m LEFT JOIN public.users u ON u.uid = m.user_id
        WHERE m.organization_id = o.id
      ), '[]'::jsonb),
      'sessions', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', s.id, 'user_id', s.user_id, 'device_name', s.device_name,
          'platform', s.platform, 'status', s.status,
          'last_heartbeat_at', s.last_heartbeat_at, 'started_at', s.started_at,
          'ended_at', s.ended_at, 'end_reason', s.end_reason
        ) ORDER BY s.last_heartbeat_at DESC)
        FROM public.active_sessions s
        WHERE s.organization_id = o.id
          OR (
            s.status <> 'active'
            AND EXISTS (
              SELECT 1 FROM private.internal_agent_identity_links link
              WHERE link.customer_id = p_customer_id AND link.legacy_user_id = s.user_id AND link.active
            )
          )
      ), '[]'::jsonb),
      'inspections', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', v.id, 'protocol', v.protocolo, 'risk', v."nivelRisco",
          'status', v.status, 'occurred_at', v."dataVistoria", 'agent_name', v."agenteNome",
          'address', CASE WHEN can_sensitive THEN coalesce(v.endereco, concat_ws(' ', v."enderecoRua", v."enderecoNumero")) END
        ) ORDER BY v."dataVistoria" DESC)
        FROM (
          SELECT * FROM public.vistorias inspection
          WHERE inspection.organization_id = o.id
            OR (
              inspection.organization_id IS NULL
              AND EXISTS (
                SELECT 1 FROM private.internal_agent_identity_links link
                WHERE link.customer_id = p_customer_id
                  AND link.legacy_user_id::text = inspection."agenteUid"::text
                  AND link.active
              )
            )
          ORDER BY "dataVistoria" DESC LIMIT 50
        ) v
      ), '[]'::jsonb),
      'tickets', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', t.id, 'public_code', t.public_code, 'subject', t.subject,
          'priority', t.priority, 'status', t.status, 'assigned_to', t.assigned_to,
          'response_due_at', t.response_due_at, 'resolution_due_at', t.resolution_due_at,
          'escalate_at', t.escalate_at, 'created_at', t.created_at
        ) ORDER BY t.created_at DESC)
        FROM public.support_tickets t WHERE t.organization_id = o.id
      ), '[]'::jsonb),
      'onboarding', (SELECT to_jsonb(ob) FROM public.organization_onboarding ob WHERE ob.organization_id = o.id),
      'audit', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', a.id, 'event_type', a.event_type, 'entity_type', a.entity_type,
          'entity_id', a.entity_id, 'metadata', private.sanitize_internal_metadata(a.metadata),
          'created_at', a.created_at
        ) ORDER BY a.created_at DESC)
        FROM (SELECT * FROM public.subscription_audit_events WHERE organization_id = o.id ORDER BY created_at DESC LIMIT 100) a
      ), '[]'::jsonb),
      'can_view_sensitive', can_sensitive
    ) INTO result
    FROM public.organizations o WHERE o.id = subject_id;
  ELSE
    identity_ids := private.resolve_internal_agent_ids(p_customer_id, subject_id);
    SELECT jsonb_build_object(
      'customer', jsonb_build_object(
        'customer_id', p_customer_id, 'kind', 'individual', 'subject_id', u.uid,
        'display_name', coalesce(nullif(trim(u.name), ''), 'Conta individual'),
        'municipality_name', u.municipio,
        'status', CASE WHEN u."isApproved" THEN 'active' ELSE 'onboarding' END,
        'contact_email', CASE WHEN private.current_internal_role() = 'owner' THEN u.email END,
        'created_at', u."createdAt", 'updated_at', u."lastLogin",
        'linked_legacy_identities', greatest(coalesce(array_length(identity_ids, 1), 1) - 1, 0)
      ),
      'subscription', (
        SELECT jsonb_build_object(
          'id', s.id, 'status', s.status, 'plan_id', s.plan_id, 'plan_name', p.name,
          'starts_at', s.starts_at, 'trial_ends_at', s.trial_ends_at,
          'current_period_start', s.current_period_start, 'current_period_end', s.current_period_end,
          'grace_ends_at', s.grace_ends_at, 'canceled_at', s.canceled_at, 'overrides', s.overrides
        )
        FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id
        WHERE s.user_id = u.uid ORDER BY s.created_at DESC LIMIT 1
      ),
      'usage', coalesce((
        SELECT jsonb_agg(to_jsonb(c) - 'user_id' - 'organization_id' ORDER BY c.resource_code)
        FROM public.usage_counters c WHERE c.user_id = u.uid
      ), '[]'::jsonb),
      'users', jsonb_build_array(jsonb_build_object(
        'user_id', u.uid, 'name', u.name,
        'email', CASE WHEN can_sensitive THEN u.email END,
        'role', u.role, 'status', CASE WHEN u."isApproved" THEN 'active' ELSE 'onboarding' END,
        'last_login', u."lastLogin"
      )),
      'sessions', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', s.id, 'user_id', s.user_id, 'device_name', s.device_name,
          'platform', s.platform, 'status', s.status,
          'last_heartbeat_at', s.last_heartbeat_at, 'started_at', s.started_at,
          'ended_at', s.ended_at, 'end_reason', s.end_reason
        ) ORDER BY s.last_heartbeat_at DESC)
        FROM public.active_sessions s
        WHERE s.user_id = ANY(identity_ids)
          AND (s.user_id = u.uid OR s.status <> 'active')
      ), '[]'::jsonb),
      'inspections', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', v.id, 'protocol', v.protocolo, 'risk', v."nivelRisco",
          'status', v.status, 'occurred_at', v."dataVistoria",
          'address', CASE WHEN can_sensitive THEN coalesce(v.endereco, concat_ws(' ', v."enderecoRua", v."enderecoNumero")) END
        ) ORDER BY v."dataVistoria" DESC)
        FROM (
          SELECT * FROM public.vistorias inspection
          WHERE private.internal_agent_record_in_scope(
            p_customer_id, u.uid, inspection."agenteUid"::text, inspection.organization_id
          )
          ORDER BY "dataVistoria" DESC LIMIT 50
        ) v
      ), '[]'::jsonb),
      'tickets', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', t.id, 'public_code', t.public_code, 'subject', t.subject,
          'priority', t.priority, 'status', t.status, 'assigned_to', t.assigned_to,
          'response_due_at', t.response_due_at, 'resolution_due_at', t.resolution_due_at,
          'escalate_at', t.escalate_at, 'created_at', t.created_at
        ) ORDER BY t.created_at DESC)
        FROM public.support_tickets t WHERE t.user_id = ANY(identity_ids)
      ), '[]'::jsonb),
      'onboarding', NULL,
      'audit', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', a.id, 'event_type', a.event_type, 'entity_type', a.entity_type,
          'entity_id', a.entity_id, 'metadata', private.sanitize_internal_metadata(a.metadata),
          'created_at', a.created_at
        ) ORDER BY a.created_at DESC)
        FROM (
          SELECT * FROM public.subscription_audit_events event
          WHERE event.entity_id = ANY(ARRAY(SELECT identity_id::text FROM unnest(identity_ids) identity(identity_id)))
          ORDER BY created_at DESC LIMIT 100
        ) a
      ), '[]'::jsonb),
      'can_view_sensitive', can_sensitive
    ) INTO result
    FROM public.users u WHERE u.uid = subject_id AND u.organization_id IS NULL;
  END IF;

  IF result IS NULL THEN RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN result;
END;
$$;

COMMENT ON TABLE private.internal_agent_identity_links IS
  'Explicitly reviewed legacy-to-current identity links used to assemble complete operational customer history without rewriting source records.';

NOTIFY pgrst, 'reload schema';
