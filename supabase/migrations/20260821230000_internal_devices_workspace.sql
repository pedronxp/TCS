-- Inventário agregado de dispositivos para o console interno.
-- Não retorna IP, MAC nem o identificador bruto do aparelho.

CREATE OR REPLACE FUNCTION public.get_internal_device_workspace(
  p_state text DEFAULT NULL,
  p_platform text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_term text := nullif(trim(p_search), '');
  v_items jsonb;
  v_summary jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_internal_permission('session.read') THEN
    RAISE EXCEPTION 'device_read_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF p_limit NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid_pagination' USING ERRCODE = '22023';
  END IF;
  IF p_state IS NOT NULL AND p_state NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'invalid_device_state' USING ERRCODE = '22023';
  END IF;

  WITH grouped AS MATERIALIZED (
    SELECT
      md5(s.device_id) AS device_key,
      coalesce(nullif(btrim(s.device_name), ''), 'Dispositivo não identificado') AS device_name,
      lower(coalesce(nullif(btrim(s.platform), ''), 'unknown')) AS platform,
      max(s.last_heartbeat_at) AS last_seen_at,
      min(s.started_at) AS first_seen_at,
      count(*)::integer AS session_count,
      count(*) FILTER (WHERE s.status = 'active')::integer AS active_sessions,
      count(DISTINCT s.user_id)::integer AS user_count,
      count(DISTINCT s.organization_id) FILTER (WHERE s.organization_id IS NOT NULL)::integer AS organization_count,
      (array_agg(s.status ORDER BY s.last_heartbeat_at DESC))[1] AS latest_status,
      CASE
        WHEN count(DISTINCT s.organization_id) FILTER (WHERE s.organization_id IS NOT NULL) > 1 THEN 'Múltiplas organizações'
        ELSE max(o.display_name)
      END AS organization_name
    FROM public.active_sessions s
    LEFT JOIN public.organizations o ON o.id = s.organization_id
    GROUP BY s.device_id, coalesce(nullif(btrim(s.device_name), ''), 'Dispositivo não identificado'), lower(coalesce(nullif(btrim(s.platform), ''), 'unknown'))
  ), filtered AS MATERIALIZED (
    SELECT *,
      active_sessions > 0 AS active,
      active_sessions > 0 AND last_seen_at < now() - interval '30 minutes' AS attention
    FROM grouped
    WHERE (p_state IS NULL OR p_state = '' OR (p_state = 'active' AND active_sessions > 0) OR (p_state = 'inactive' AND active_sessions = 0))
      AND (p_platform IS NULL OR p_platform = '' OR platform = lower(p_platform))
      AND (v_term IS NULL OR device_name ILIKE '%' || v_term || '%'
        OR platform ILIKE '%' || v_term || '%'
        OR coalesce(organization_name, '') ILIKE '%' || v_term || '%')
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'device_key', device_key,
    'device_name', device_name,
    'platform', platform,
    'active', active,
    'attention', attention,
    'latest_status', latest_status,
    'last_seen_at', last_seen_at,
    'first_seen_at', first_seen_at,
    'session_count', session_count,
    'active_sessions', active_sessions,
    'user_count', user_count,
    'organization_count', organization_count,
    'organization_name', organization_name
  ) ORDER BY active DESC, attention DESC, last_seen_at DESC), '[]'::jsonb)
  INTO v_items
  FROM (SELECT * FROM filtered ORDER BY active DESC, attention DESC, last_seen_at DESC LIMIT p_limit) page;

  WITH grouped AS MATERIALIZED (
    SELECT
      s.device_id,
      lower(coalesce(nullif(btrim(s.platform), ''), 'unknown')) AS platform,
      max(s.last_heartbeat_at) AS last_seen_at,
      count(*) FILTER (WHERE s.status = 'active')::integer AS active_sessions
    FROM public.active_sessions s
    GROUP BY s.device_id, lower(coalesce(nullif(btrim(s.platform), ''), 'unknown'))
  )
  SELECT jsonb_build_object(
    'total', count(*),
    'active', count(*) FILTER (WHERE active_sessions > 0),
    'attention', count(*) FILTER (WHERE active_sessions > 0 AND last_seen_at < now() - interval '30 minutes'),
    'platforms', jsonb_build_object(
      'web', count(*) FILTER (WHERE platform = 'web'),
      'android', count(*) FILTER (WHERE platform = 'android'),
      'ios', count(*) FILTER (WHERE platform = 'ios'),
      'unknown', count(*) FILTER (WHERE platform NOT IN ('web', 'android', 'ios'))
    )
  ) INTO v_summary FROM grouped;

  RETURN jsonb_build_object('items', v_items, 'summary', v_summary, 'generated_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.get_internal_device_workspace(text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_internal_device_workspace(text, text, text, integer) TO authenticated;
NOTIFY pgrst, 'reload schema';
