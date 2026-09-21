-- ============================================================
-- F8 — Retenção: alertas de inatividade + relatório mensal por org
-- (Aplicada via MCP; arquivo espelha o remoto. Edge function: send-monthly-report)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.retention_settings (
  singleton          boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  inatividade_dias   integer NOT NULL DEFAULT 14 CHECK (inatividade_dias BETWEEN 3 AND 90),
  relatorio_ativo    boolean NOT NULL DEFAULT true,
  atualizado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_por     uuid
);
INSERT INTO public.retention_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;

ALTER TABLE public.retention_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY retention_settings_owner_all ON public.retention_settings
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.owner_admins WHERE user_id = auth.uid() AND active))
WITH CHECK (EXISTS (SELECT 1 FROM public.owner_admins WHERE user_id = auth.uid() AND active));

CREATE TABLE IF NOT EXISTS public.org_monthly_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  competencia     text NOT NULL,
  resumo          jsonb NOT NULL,
  enviado_em      timestamptz,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, competencia)
);
ALTER TABLE public.org_monthly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_monthly_reports_read ON public.org_monthly_reports
FOR SELECT TO authenticated
USING (
  organization_id IN (SELECT my_organization_ids())
  OR EXISTS (SELECT 1 FROM public.owner_admins WHERE user_id = auth.uid() AND active)
);

ALTER TABLE public.notificacoes DROP CONSTRAINT IF EXISTS notificacoes_tipo_check;
ALTER TABLE public.notificacoes ADD CONSTRAINT notificacoes_tipo_check
CHECK (tipo = ANY (ARRAY['alto_risco','formulario_novo','novo_usuario','limite_firebase','token_usado','atribuicao_nova','cobranca','qe_devolvida','suporte_resposta','inatividade_org','relatorio_mensal']));

CREATE OR REPLACE FUNCTION public.retention_daily_engine()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_inat int; v_rel_ativo boolean;
  v_alertas int := 0; v_relatorios int := 0;
  r record; m record;
  v_comp text; v_comp_ant text;
  v_resumo jsonb;
BEGIN
  SELECT inatividade_dias, relatorio_ativo INTO v_inat, v_rel_ativo
  FROM public.retention_settings WHERE singleton;
  v_inat := coalesce(v_inat, 14);

  FOR r IN
    SELECT o.id, o.display_name, max(v."criadoEm") AS ultima
    FROM public.organizations o
    JOIN public.vistorias v ON v.organization_id = o.id
    WHERE o.status IN ('active','trial')
    GROUP BY o.id
    HAVING max(v."criadoEm") < now() - (coalesce((SELECT inatividade_dias FROM public.retention_settings WHERE singleton),14) || ' days')::interval
  LOOP
    FOR m IN
      SELECT om.user_id FROM public.organization_members om
      WHERE om.organization_id = r.id AND om.status='active' AND om.role IN ('admin','master')
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.notificacoes n
        WHERE n.tipo='inatividade_org'
          AND n.destinatario_uid = m.user_id::text
          AND n.payload->>'organization_id' = r.id::text
          AND n.criada_em > now() - interval '7 days'
      ) THEN
        INSERT INTO public.notificacoes (tipo, titulo, corpo, destinatario_uid, payload, lida, criada_em)
        VALUES (
          'inatividade_org',
          'Equipe sem vistorias recentes',
          'Nenhuma vistoria registrada nos últimos ' || v_inat || ' dias em ' || coalesce(r.display_name,'sua organização') || '. Vale acionar a equipe em campo.',
          m.user_id::text,
          jsonb_build_object('organization_id', r.id, 'ultima_vistoria', r.ultima),
          false, now()
        );
        v_alertas := v_alertas + 1;
      END IF;
    END LOOP;
  END LOOP;

  IF v_rel_ativo AND extract(day from now())::int = 1 THEN
    v_comp     := to_char(date_trunc('month', now()) - interval '1 month', 'YYYY-MM');
    v_comp_ant := to_char(date_trunc('month', now()) - interval '2 months', 'YYYY-MM');

    FOR r IN SELECT id, display_name FROM public.organizations WHERE status <> 'archived' LOOP
      SELECT jsonb_build_object(
        'vistorias', coalesce(v_mes.total, 0),
        'vistorias_mes_anterior', coalesce(v_ant.total, 0),
        'alto_risco', coalesce(v_mes.r34, 0),
        'risco_medio', coalesce(v_mes.r2, 0),
        'agentes_ativos', coalesce(v_mes.agentes, 0),
        'top_agentes', coalesce(v_top.agentes, '[]'::jsonb),
        'qe', jsonb_build_object(
          'avaliadas', coalesce(q.avaliadas, 0),
          'aprovadas', coalesce(q.aprovadas, 0),
          'nota_media', q.nota_media
        )
      ) INTO v_resumo
      FROM (SELECT count(*) AS total,
                   count(*) FILTER (WHERE nivel_risco IN ('r3','r4')) AS r34,
                   count(*) FILTER (WHERE nivel_risco = 'r2') AS r2,
                   count(DISTINCT "agenteUid") AS agentes
            FROM public.vistorias
            WHERE organization_id = r.id
              AND "criadoEm" >= (v_comp || '-01')::date
              AND "criadoEm" <  date_trunc('month', (v_comp || '-01')::date + interval '1 month')) v_mes,
           (SELECT count(*) AS total FROM public.vistorias
            WHERE organization_id = r.id
              AND "criadoEm" >= (v_comp_ant || '-01')::date
              AND "criadoEm" <  (v_comp || '-01')::date) v_ant,
           (SELECT jsonb_agg(jsonb_build_object('agente', agente, 'vistorias', n) ORDER BY n DESC) AS agentes
            FROM (
              SELECT coalesce("agenteNome",'—') AS agente, count(*) AS n
              FROM public.vistorias
              WHERE organization_id = r.id
                AND "criadoEm" >= (v_comp || '-01')::date
                AND "criadoEm" <  date_trunc('month', (v_comp || '-01')::date + interval '1 month')
              GROUP BY 1 ORDER BY n DESC LIMIT 5
            ) x) v_top,
           (SELECT count(*) AS avaliadas,
                   count(*) FILTER (WHERE status='aprovada') AS aprovadas,
                   round(avg(nota), 1) AS nota_media
            FROM public.revisoes_qe
            WHERE organization_id = r.id
              AND respondida_em >= (v_comp || '-01')::date
              AND respondida_em <  date_trunc('month', (v_comp || '-01')::date + interval '1 month')) q;

      INSERT INTO public.org_monthly_reports (organization_id, competencia, resumo)
      VALUES (r.id, v_comp, coalesce(v_resumo, '{}'::jsonb))
      ON CONFLICT (organization_id, competencia) DO NOTHING;
      IF FOUND THEN v_relatorios := v_relatorios + 1; END IF;

      FOR m IN
        SELECT om.user_id FROM public.organization_members om
        WHERE om.organization_id = r.id AND om.status='active' AND om.role IN ('admin','master')
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.notificacoes n
          WHERE n.tipo='relatorio_mensal'
            AND n.destinatario_uid = m.user_id::text
            AND n.payload->>'competencia' = v_comp
        ) THEN
          INSERT INTO public.notificacoes (tipo, titulo, corpo, destinatario_uid, payload, lida, criada_em)
          VALUES (
            'relatorio_mensal',
            'Relatório mensal disponível',
            'O resumo de ' || to_char((v_comp || '-01')::date, 'MM/YYYY') || ' da operação foi gerado. Confira no painel ou no seu e-mail.',
            m.user_id::text,
            jsonb_build_object('organization_id', r.id, 'competencia', v_comp),
            false, now()
          );
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('alertas_inatividade', v_alertas, 'relatorios_gerados', v_relatorios, 'executado_em', now());
END $function$;
REVOKE ALL ON FUNCTION public.retention_daily_engine() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'retention-daily-engine') THEN
    PERFORM cron.schedule('retention-daily-engine', '30 9 * * *', 'SELECT public.retention_daily_engine();');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-monthly-report') THEN
    PERFORM cron.schedule('send-monthly-report', '0 13 1-3 * *', $cmd$
      SELECT net.http_post(
        url := 'https://vobcapzssxchdckazfnr.supabase.co/functions/v1/send-monthly-report',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT cron_secret FROM public.ai_cron_settings WHERE id = true)
        ),
        body := '{}'::jsonb
      );
    $cmd$);
  END IF;
END $$;
