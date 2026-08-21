-- Correção das agregações dos gráficos de tokens.
-- Painéis agregados do console. Não retornam códigos de convite, dados pessoais,
-- endereços, respostas de formulários, IPs ou identificadores de dispositivo.

CREATE OR REPLACE FUNCTION public.get_internal_token_analytics(
  p_municipio text DEFAULT NULL,
  p_uf text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_municipio text := nullif(btrim(p_municipio), '');
  v_uf text := nullif(upper(btrim(p_uf)), '');
  v_items jsonb;
  v_summary jsonb;
  v_daily jsonb;
  v_creators jsonb;
  v_roles jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    private.has_internal_permission('token.manage') OR private.has_internal_permission('commercial.write')
  ) THEN
    RAISE EXCEPTION 'token_analytics_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF v_uf IS NOT NULL AND v_uf !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'invalid_state_code' USING ERRCODE = '22023';
  END IF;

  WITH filtered AS MATERIALIZED (
    SELECT
      token.management_id,
      token.role,
      token.municipio,
      token."criadoEm" AS created_at,
      token."expiraEm" AS expires_at,
      coalesce(token.usado, false) AS used,
      token.revoked_at,
      coalesce(nullif(btrim(token."criadoPorNome"), ''), 'Emissor não informado') AS created_by_name,
      CASE
        WHEN token.revoked_at IS NOT NULL THEN 'revoked'
        WHEN coalesce(token.usado, false) THEN 'used'
        WHEN token."expiraEm" IS NOT NULL AND token."expiraEm" <= now() THEN 'expired'
        ELSE 'active'
      END AS status
    FROM public.invite_tokens token
    WHERE (v_municipio IS NULL OR lower(token.municipio) = lower(v_municipio))
      AND (
        v_uf IS NULL OR EXISTS (
          SELECT 1 FROM public.municipios municipality
          WHERE lower(municipality.nome) = lower(token.municipio)
            AND upper(municipality.uf::text) = v_uf
        )
      )
  )
  SELECT jsonb_build_object(
    'total', count(*),
    'active', count(*) FILTER (WHERE status = 'active'),
    'used', count(*) FILTER (WHERE status = 'used'),
    'expired', count(*) FILTER (WHERE status = 'expired'),
    'revoked', count(*) FILTER (WHERE status = 'revoked'),
    'created_last_7_days', count(*) FILTER (WHERE created_at >= now() - interval '7 days'),
    'creator_count', count(DISTINCT created_by_name)
  ) INTO v_summary FROM filtered;

  WITH filtered AS MATERIALIZED (
    SELECT token."criadoEm" AS created_at
    FROM public.invite_tokens token
    WHERE (v_municipio IS NULL OR lower(token.municipio) = lower(v_municipio))
      AND (v_uf IS NULL OR EXISTS (SELECT 1 FROM public.municipios municipality WHERE lower(municipality.nome) = lower(token.municipio) AND upper(municipality.uf::text) = v_uf))
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('date', date, 'count', count) ORDER BY date), '[]'::jsonb)
  INTO v_daily FROM (
    SELECT day::date AS date, count(filtered.created_at) AS count
    FROM generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') day
    LEFT JOIN filtered ON filtered.created_at >= day AND filtered.created_at < day + interval '1 day'
    GROUP BY day
  ) daily;

  WITH filtered AS MATERIALIZED (
    SELECT coalesce(nullif(btrim(token."criadoPorNome"), ''), 'Emissor não informado') AS name,
      CASE WHEN token.revoked_at IS NOT NULL THEN 'revoked' WHEN coalesce(token.usado, false) THEN 'used' WHEN token."expiraEm" IS NOT NULL AND token."expiraEm" <= now() THEN 'expired' ELSE 'active' END AS status
    FROM public.invite_tokens token
    WHERE (v_municipio IS NULL OR lower(token.municipio) = lower(v_municipio))
      AND (v_uf IS NULL OR EXISTS (SELECT 1 FROM public.municipios municipality WHERE lower(municipality.nome) = lower(token.municipio) AND upper(municipality.uf::text) = v_uf))
  ), ranked AS (
    SELECT name, count(*) AS total, count(*) FILTER (WHERE status = 'active') AS active, count(*) FILTER (WHERE status = 'used') AS used
    FROM filtered GROUP BY name ORDER BY total DESC, name ASC LIMIT 10
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('name', name, 'total', total, 'active', active, 'used', used) ORDER BY total DESC, name), '[]'::jsonb)
  INTO v_creators FROM ranked;

  WITH filtered AS MATERIALIZED (
    SELECT token.role
    FROM public.invite_tokens token
    WHERE (v_municipio IS NULL OR lower(token.municipio) = lower(v_municipio))
      AND (v_uf IS NULL OR EXISTS (SELECT 1 FROM public.municipios municipality WHERE lower(municipality.nome) = lower(token.municipio) AND upper(municipality.uf::text) = v_uf))
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('role', role, 'count', count) ORDER BY count DESC, role), '[]'::jsonb)
  INTO v_roles FROM (
    SELECT role, count(*) AS count FROM filtered GROUP BY role
  ) roles;

  WITH filtered AS MATERIALIZED (
    SELECT token.management_id, token.role, token.municipio, token."criadoEm" AS created_at, token."expiraEm" AS expires_at,
      coalesce(token.usado, false) AS used, token.revoked_at,
      coalesce(nullif(btrim(token."criadoPorNome"), ''), 'Emissor não informado') AS created_by_name,
      CASE WHEN token.revoked_at IS NOT NULL THEN 'revoked' WHEN coalesce(token.usado, false) THEN 'used' WHEN token."expiraEm" IS NOT NULL AND token."expiraEm" <= now() THEN 'expired' ELSE 'active' END AS status
    FROM public.invite_tokens token
    WHERE (v_municipio IS NULL OR lower(token.municipio) = lower(v_municipio))
      AND (v_uf IS NULL OR EXISTS (SELECT 1 FROM public.municipios municipality WHERE lower(municipality.nome) = lower(token.municipio) AND upper(municipality.uf::text) = v_uf))
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'management_id', management_id, 'role', role, 'municipio', municipio, 'created_at', created_at, 'expires_at', expires_at,
    'used', used, 'revoked_at', revoked_at, 'status', status, 'created_by_name', created_by_name
  ) ORDER BY created_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_items FROM (SELECT * FROM filtered ORDER BY created_at DESC NULLS LAST LIMIT 500) page;

  RETURN jsonb_build_object('summary', v_summary, 'daily', v_daily, 'creators', v_creators, 'roles', v_roles, 'items', v_items);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_internal_operational_statistics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inspections jsonb;
  v_sessions jsonb;
  v_events jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    private.has_internal_permission('dashboard.executive.read')
    OR private.has_internal_permission('dashboard.technical.read')
    OR private.has_internal_permission('technical.read')
  ) THEN
    RAISE EXCEPTION 'operational_statistics_not_allowed' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'total', count(*),
    'completed', count(*) FILTER (WHERE lower(coalesce(status, '')) IN ('concluida', 'concluída', 'completed')),
    'created_last_7_days', count(*) FILTER (WHERE "criadoEm" >= now() - interval '7 days'),
    'pending_sync', count(*) FILTER (WHERE coalesce(sincronizado, false) = false)
  ) INTO v_inspections FROM public.vistorias;
  SELECT jsonb_build_object(
    'active', count(*) FILTER (WHERE status = 'active'),
    'stale', count(*) FILTER (WHERE status = 'active' AND (last_heartbeat_at IS NULL OR last_heartbeat_at < now() - interval '30 minutes'))
  ) INTO v_sessions FROM public.active_sessions;
  SELECT jsonb_build_object(
    'errors_last_24_hours', count(*) FILTER (WHERE severity IN ('error', 'critical') AND occurred_at >= now() - interval '24 hours'),
    'critical_last_24_hours', count(*) FILTER (WHERE severity = 'critical' AND occurred_at >= now() - interval '24 hours'),
    'last_event_at', max(occurred_at)
  ) INTO v_events FROM public.technical_events;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'inspections', v_inspections,
    'sessions', v_sessions,
    'events', v_events,
    'health', jsonb_build_array(
      jsonb_build_object('name', 'Console e API', 'status', 'operational', 'detail', 'A consulta autenticada respondeu normalmente.'),
      jsonb_build_object('name', 'Banco de dados', 'status', 'operational', 'detail', 'Métricas agregadas foram consultadas sem expor registros.'),
      jsonb_build_object('name', 'Sincronização', 'status', CASE WHEN (v_inspections->>'pending_sync')::integer > 0 THEN 'attention' ELSE 'operational' END, 'detail', 'Indicador baseado somente na quantidade de vistorias pendentes.')
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_internal_token_analytics(text, text), public.get_internal_operational_statistics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_internal_token_analytics(text, text), public.get_internal_operational_statistics() TO authenticated;
NOTIFY pgrst, 'reload schema';
