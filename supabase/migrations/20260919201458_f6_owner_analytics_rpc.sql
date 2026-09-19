-- ============================================================
-- F6 — Analytics owner: indicadores consolidados (console web)
-- (Aplicada via MCP; arquivo espelha o remoto)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_owner_analytics()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_mrr bigint;
  v_recebido_mes bigint;
  v_orgs jsonb;
  v_series jsonb;
  v_qe jsonb;
  v_top_orgs jsonb;
  v_agentes int;
BEGIN
  IF NOT public.is_owner_admin() THEN RAISE EXCEPTION 'owner_only' USING ERRCODE='42501'; END IF;

  SELECT coalesce(sum(coalesce(
      (pv.configuration #>> '{commercial,monthly_price_cents}')::bigint,
      (pv2.configuration #>> '{commercial,monthly_price_cents}')::bigint, 0)), 0)
  INTO v_mrr
  FROM public.subscriptions s
  LEFT JOIN public.plan_versions pv ON pv.id = s.plan_version_id
  LEFT JOIN public.plans pl ON pl.id = s.plan_id
  LEFT JOIN public.plan_versions pv2 ON pv2.plan_id = pl.id AND pv2.version = pl.current_version
  WHERE s.status IN ('active','trial','grace');

  SELECT coalesce(sum(valor_centavos), 0) INTO v_recebido_mes
  FROM public.billing_invoices
  WHERE status='paga' AND date_trunc('month', pago_em) = date_trunc('month', now());

  SELECT jsonb_object_agg(status, n) INTO v_orgs
  FROM (SELECT status, count(*) AS n FROM public.organizations GROUP BY status) t;

  WITH meses AS (
    SELECT date_trunc('month', now()) - (g || ' months')::interval AS mes
    FROM generate_series(5, 0, -1) g
  ),
  fat AS (
    SELECT date_trunc('month', pago_em) AS mes, sum(valor_centavos) AS total
    FROM public.billing_invoices WHERE status='paga' AND pago_em >= date_trunc('month', now()) - interval '6 months'
    GROUP BY 1
  ),
  vist AS (
    SELECT date_trunc('month', "criadoEm") AS mes, count(*) AS total
    FROM public.vistorias WHERE "criadoEm" >= date_trunc('month', now()) - interval '6 months'
    GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object(
    'mes', to_char(m.mes, 'YYYY-MM'),
    'receita_centavos', coalesce(f.total, 0),
    'vistorias', coalesce(v.total, 0)
  ) ORDER BY m.mes) INTO v_series
  FROM meses m LEFT JOIN fat f ON f.mes = m.mes LEFT JOIN vist v ON v.mes = m.mes;

  SELECT jsonb_build_object(
    'pendentes', coalesce(sum(CASE WHEN status='pendente' THEN 1 ELSE 0 END), 0),
    'avaliadas_30d', coalesce(sum(CASE WHEN respondida_em >= now() - interval '30 days' THEN 1 ELSE 0 END), 0),
    'aprovadas_30d', coalesce(sum(CASE WHEN status='aprovada' AND respondida_em >= now() - interval '30 days' THEN 1 ELSE 0 END), 0),
    'nota_media', round(avg(nota) FILTER (WHERE respondida_em >= now() - interval '30 days'), 1),
    'tempo_medio_horas', round(avg(extract(epoch FROM (respondida_em - criado_em))/3600.0) FILTER (WHERE respondida_em IS NOT NULL), 1)
  ) INTO v_qe
  FROM public.revisoes_qe;

  SELECT coalesce(jsonb_agg(jsonb_build_object('org', org_nome, 'vistorias', n) ORDER BY n DESC), '[]'::jsonb)
  INTO v_top_orgs
  FROM (
    SELECT coalesce(o.display_name, v.municipio, '—') AS org_nome, count(*) AS n
    FROM public.vistorias v
    LEFT JOIN public.organizations o ON o.id = v.organization_id
    WHERE v."criadoEm" >= now() - interval '90 days'
    GROUP BY 1 ORDER BY n DESC LIMIT 8
  ) t;

  SELECT count(DISTINCT "agenteUid") INTO v_agentes
  FROM public.vistorias WHERE "criadoEm" >= now() - interval '30 days';

  RETURN jsonb_build_object(
    'mrr_centavos', v_mrr,
    'recebido_mes_centavos', v_recebido_mes,
    'organizacoes', coalesce(v_orgs, '{}'::jsonb),
    'agentes_ativos_30d', v_agentes,
    'series_6m', coalesce(v_series, '[]'::jsonb),
    'qe', coalesce(v_qe, '{}'::jsonb),
    'top_orgs_90d', v_top_orgs
  );
END $$;
REVOKE ALL ON FUNCTION public.get_owner_analytics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_owner_analytics() TO authenticated;
