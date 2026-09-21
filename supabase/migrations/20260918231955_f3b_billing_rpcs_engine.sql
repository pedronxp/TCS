-- ============================================================
-- F3b — Billing manual: RPCs (cliente/owner) + motor diário (cron 06h BRT)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_owner_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.owner_admins WHERE user_id = auth.uid() AND active)
$$;
REVOKE ALL ON FUNCTION public.is_owner_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_owner_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.my_billing_invoices()
RETURNS SETOF public.billing_invoices
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT bi.* FROM public.billing_invoices bi
  WHERE bi.organization_id IN (SELECT public.my_organization_ids())
  ORDER BY bi.vencimento DESC;
END $$;
REVOKE ALL ON FUNCTION public.my_billing_invoices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_billing_invoices() TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_invoice_receipt(p_invoice_id uuid, p_comprovante_path text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_inv public.billing_invoices;
BEGIN
  SELECT * INTO v_inv FROM public.billing_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found' USING ERRCODE='P0002'; END IF;

  IF NOT (v_inv.organization_id IN (SELECT public.my_organization_ids())) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

  IF v_inv.status NOT IN ('aberta','vencida') THEN
    RAISE EXCEPTION 'invoice_not_open_for_receipt' USING ERRCODE='P0001'; END IF;

  IF p_comprovante_path IS NULL OR p_comprovante_path NOT LIKE (v_inv.organization_id::text || '/%') THEN
    RAISE EXCEPTION 'invalid_receipt_path' USING ERRCODE='22023'; END IF;

  UPDATE public.billing_invoices
  SET comprovante_path = p_comprovante_path,
      comprovante_enviado_em = now(),
      status = 'em_analise',
      motivo_rejeicao = NULL,
      atualizado_em = now()
  WHERE id = p_invoice_id;
END $$;
REVOKE ALL ON FUNCTION public.submit_invoice_receipt(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_invoice_receipt(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_invoice_payment(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_inv public.billing_invoices;
  v_sub public.subscriptions;
  v_day int; v_new_start date; v_month_start date; v_last_day date; v_new_end date;
BEGIN
  IF NOT public.is_owner_admin() THEN RAISE EXCEPTION 'owner_only' USING ERRCODE='42501'; END IF;

  SELECT * INTO v_inv FROM public.billing_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found' USING ERRCODE='P0002'; END IF;
  IF v_inv.status NOT IN ('aberta','em_analise','vencida') THEN
    RAISE EXCEPTION 'invoice_not_payable' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_sub FROM public.subscriptions WHERE id = v_inv.subscription_id;

  UPDATE public.billing_invoices
  SET status='paga', pago_em=now(), aprovado_por=auth.uid(), motivo_rejeicao=NULL, atualizado_em=now()
  WHERE id = p_invoice_id;

  IF FOUND THEN
    v_day := coalesce(v_sub.billing_day, extract(day from v_inv.vencimento)::int, 1);
    v_new_start := v_inv.vencimento;
    v_month_start := (date_trunc('month', v_inv.vencimento) + interval '1 month')::date;
    v_last_day := (v_month_start + interval '1 month' - interval '1 day')::date;
    v_new_end := LEAST(v_month_start + (v_day - 1), v_last_day);

    UPDATE public.subscriptions
    SET status='active',
        current_period_start = v_new_start,
        current_period_end   = v_new_end,
        grace_ends_at        = NULL,
        updated_at = now()
    WHERE id = v_inv.subscription_id;

    UPDATE public.organizations
    SET status='active', updated_at=now()
    WHERE id = v_inv.organization_id AND status = 'suspended';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.approve_invoice_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_invoice_payment(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_invoice_receipt(p_invoice_id uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_inv public.billing_invoices;
BEGIN
  IF NOT public.is_owner_admin() THEN RAISE EXCEPTION 'owner_only' USING ERRCODE='42501'; END IF;

  SELECT * INTO v_inv FROM public.billing_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found' USING ERRCODE='P0002'; END IF;
  IF v_inv.status <> 'em_analise' THEN RAISE EXCEPTION 'invoice_not_in_review' USING ERRCODE='P0001'; END IF;

  UPDATE public.billing_invoices
  SET status = CASE WHEN vencimento < current_date THEN 'vencida' ELSE 'aberta' END,
      comprovante_path = NULL,
      comprovante_enviado_em = NULL,
      motivo_rejeicao = nullif(btrim(coalesce(p_motivo,'')), ''),
      atualizado_em = now()
  WHERE id = p_invoice_id;
END $$;
REVOKE ALL ON FUNCTION public.reject_invoice_receipt(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_invoice_receipt(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.billing_daily_engine()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
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
REVOKE ALL ON FUNCTION public.billing_daily_engine() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'billing-daily-engine') THEN
    PERFORM cron.schedule('billing-daily-engine', '0 9 * * *', 'SELECT public.billing_daily_engine();');
  END IF;
END $$;
