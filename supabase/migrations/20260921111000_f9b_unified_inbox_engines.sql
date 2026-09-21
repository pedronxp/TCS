-- F9b — Fan-out da caixa de entrada: retenção (F8) + cobrança (F3)
-- Continuação de f9_unified_inbox_fanout_all.

CREATE OR REPLACE FUNCTION public.retention_daily_engine() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
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
        PERFORM private.emit_inbox_event(
          'retention.org_inactive', 'retention', 'system', 'organization', NULL,
          r.id, m.user_id, 'organization', r.id::text, 'warning',
          'Equipe sem vistorias recentes',
          'Nenhuma vistoria registrada nos últimos ' || v_inat || ' dias em ' || coalesce(r.display_name,'sua organização') || '. Vale acionar a equipe em campo.',
          'dashboard',
          jsonb_build_object('organization_id', r.id, 'ultima_vistoria', r.ultima),
          'inatividade:' || r.id::text || ':' || m.user_id::text || ':' || to_char(now(), 'IYYY-IW'),
          'retention:' || r.id::text,
          ARRAY[m.user_id]
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
          PERFORM private.emit_inbox_event(
            'retention.monthly_report', 'retention', 'system', 'organization', NULL,
            r.id, m.user_id, 'organization', r.id::text, 'info',
            'Relatório mensal disponível',
            'O resumo de ' || to_char((v_comp || '-01')::date, 'MM/YYYY') || ' da operação foi gerado. Confira no painel ou no seu e-mail.',
            'dashboard',
            jsonb_build_object('organization_id', r.id, 'competencia', v_comp),
            'relatorio_mensal:' || r.id::text || ':' || m.user_id::text || ':' || v_comp,
            'retention:' || r.id::text,
            ARRAY[m.user_id]
          );
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('alertas_inatividade', v_alertas, 'relatorios_gerados', v_relatorios, 'executado_em', now());
END $function$;

CREATE OR REPLACE FUNCTION public.billing_daily_engine() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_antecedencia int; v_tolerancia int;
  v_criadas int := 0; v_vencidas int := 0; v_grace int := 0; v_suspensas int := 0; v_avisos int := 0;
  v_n int;
  r record; rule record; m record;
  v_titulo text; v_corpo text;
BEGIN
  SELECT tolerancia_dias, fatura_antecedencia_dias INTO v_tolerancia, v_antecedencia
  FROM public.billing_settings WHERE singleton;
  v_tolerancia  := coalesce(v_tolerancia, 5);
  v_antecedencia := coalesce(v_antecedencia, 7);

  FOR r IN
    SELECT s.id AS sub_id, s.organization_id, s.current_period_end::date AS venc,
           coalesce((pv.configuration #>> '{commercial,monthly_price_cents}')::int,
                    (pv2.configuration #>> '{commercial,monthly_price_cents}')::int) AS preco
    FROM public.subscriptions s
    LEFT JOIN public.plan_versions pv ON pv.id = s.plan_version_id
    LEFT JOIN public.plans pl ON pl.id = s.plan_id
    LEFT JOIN public.plan_versions pv2 ON pv2.plan_id = pl.id AND pv2.version = pl.current_version
    WHERE s.organization_id IS NOT NULL
      AND s.status IN ('trial','active','grace')
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end::date <= current_date + v_antecedencia
      AND s.current_period_end::date >= current_date - v_tolerancia
  LOOP
    IF r.preco IS NOT NULL AND r.preco > 0 THEN
      INSERT INTO public.billing_invoices (subscription_id, organization_id, competencia, valor_centavos, vencimento, status)
      VALUES (r.sub_id, r.organization_id, to_char(r.venc,'YYYY-MM'), r.preco, r.venc, 'aberta')
      ON CONFLICT (subscription_id, competencia) DO NOTHING;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_criadas := v_criadas + v_n;
    END IF;
  END LOOP;

  UPDATE public.billing_invoices
  SET status='vencida', atualizado_em=now()
  WHERE status='aberta' AND vencimento < current_date;
  GET DIAGNOSTICS v_vencidas = ROW_COUNT;

  UPDATE public.subscriptions s
  SET status='grace',
      grace_ends_at = (SELECT max(bi.vencimento) FROM public.billing_invoices bi
                       WHERE bi.subscription_id = s.id AND bi.status='vencida') + v_tolerancia,
      updated_at = now()
  WHERE s.status IN ('active','trial')
    AND EXISTS (SELECT 1 FROM public.billing_invoices bi
                WHERE bi.subscription_id = s.id AND bi.status = 'vencida');
  GET DIAGNOSTICS v_grace = ROW_COUNT;

  UPDATE public.subscriptions s
  SET status='suspended', updated_at=now()
  WHERE s.status = 'grace' AND s.grace_ends_at IS NOT NULL AND s.grace_ends_at::date < current_date;
  GET DIAGNOSTICS v_suspensas = ROW_COUNT;

  UPDATE public.organizations o
  SET status='suspended', updated_at=now()
  WHERE o.status <> 'suspended'
    AND EXISTS (SELECT 1 FROM public.subscriptions s
                WHERE s.organization_id = o.id AND s.status='suspended');

  FOR rule IN SELECT * FROM public.billing_notice_rules WHERE ativo LOOP
    FOR r IN
      SELECT bi.id AS invoice_id, bi.organization_id, bi.vencimento, bi.valor_centavos,
             (bi.vencimento - current_date) AS dias_restantes,
             o.display_name AS org_nome, pl.name AS plano_nome
      FROM public.billing_invoices bi
      JOIN public.organizations o ON o.id = bi.organization_id
      JOIN public.subscriptions s ON s.id = bi.subscription_id
      LEFT JOIN public.plans pl ON pl.id = s.plan_id
      WHERE bi.status IN ('aberta','vencida')
        AND bi.vencimento = current_date + rule.dias_offset
    LOOP
      v_titulo := replace(replace(replace(replace(replace(rule.titulo,
                    '{org}', coalesce(r.org_nome,'—')),
                    '{vencimento}', to_char(r.vencimento,'DD/MM/YYYY')),
                    '{dias_restantes}', abs(r.dias_restantes)::text),
                    '{valor}', 'R$ ' || trim(to_char(r.valor_centavos/100.0,'999G999G990D00'))),
                    '{plano}', coalesce(r.plano_nome,'—'));
      v_corpo := replace(replace(replace(replace(replace(rule.corpo,
                    '{org}', coalesce(r.org_nome,'—')),
                    '{vencimento}', to_char(r.vencimento,'DD/MM/YYYY')),
                    '{dias_restantes}', abs(r.dias_restantes)::text),
                    '{valor}', 'R$ ' || trim(to_char(r.valor_centavos/100.0,'999G999G990D00'))),
                    '{plano}', coalesce(r.plano_nome,'—'));

      FOR m IN
        SELECT om.user_id FROM public.organization_members om
        WHERE om.organization_id = r.organization_id AND om.status='active'
          AND om.role IN ('admin','master')
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.notificacoes n
          WHERE n.tipo='cobranca'
            AND n.destinatario_uid = m.user_id::text
            AND n.payload->>'rule_id' = rule.id::text
            AND n.payload->>'invoice_id' = r.invoice_id::text
        ) THEN
          INSERT INTO public.notificacoes (tipo, titulo, corpo, destinatario_uid, payload, lida, criada_em)
          VALUES (
            'cobranca', v_titulo, v_corpo, m.user_id::text,
            jsonb_build_object('rule_id', rule.id, 'invoice_id', r.invoice_id,
                               'organization_id', r.organization_id, 'vencimento', r.vencimento),
            false, now()
          );
          PERFORM private.emit_inbox_event(
            'billing.notice', 'billing', 'system', 'organization', NULL,
            r.organization_id, m.user_id, 'billing_invoice', r.invoice_id::text,
            CASE WHEN r.dias_restantes < 0 THEN 'warning' ELSE 'info' END,
            v_titulo, v_corpo, 'assinatura',
            jsonb_build_object('rule_id', rule.id, 'invoice_id', r.invoice_id,
                               'organization_id', r.organization_id, 'vencimento', r.vencimento),
            'cobranca:' || rule.id::text || ':' || r.invoice_id::text || ':' || m.user_id::text,
            'billing:' || r.invoice_id::text,
            ARRAY[m.user_id]
          );
          v_avisos := v_avisos + 1;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'faturas_criadas', v_criadas, 'faturas_vencidas', v_vencidas,
    'subs_em_grace', v_grace, 'subs_suspensas', v_suspensas, 'avisos_enviados', v_avisos,
    'executado_em', now()
  );
END $function$;
