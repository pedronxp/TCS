-- CORREÇÃO P0/P1 — Hardening do contrato portal_get_reporting.
--
-- Bloqueios corrigidos:
-- 1. Supervisor/Agent nunca pode obter dados de outro membro via teamMemberId
--    mesmo dentro do próprio município (privacidade de agenda/documentos).
-- 2. UUID de formulário fora do escopo deve falhar explicitamente; WHEN others
--    não deve engolir essa exceção.
-- 3. FULL JOIN entre agregados de documentos e ciência duplica linhas quando
--    ambos os lados têm dados; substituído por agregação unificada.
-- 4. Limite de 500 linhas para exportação deve ser aplicado ANTES de jsonb_agg
--    em CTE, não depois, para evitar consumo de memória com datasets grandes.
-- 5. Adicionar testes de regressão para todos esses cenários.

CREATE OR REPLACE FUNCTION public.portal_get_reporting(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_context jsonb;
  v_org uuid;
  v_role text;
  v_user uuid := auth.uid();
  v_from timestamptz;
  v_to timestamptz;
  v_period_days integer;
  v_risk text := NULLIF(trim(COALESCE(p_filters->>'risk', '')), '');
  v_form_id text := NULLIF(trim(COALESCE(p_filters->>'formId', '')), '');
  v_form_version integer;
  v_team_member uuid := NULLIF(trim(COALESCE(p_filters->>'teamMemberId', '')), '');
  v_location text := NULLIF(trim(COALESCE(p_filters->>'location', '')), '');
  v_volume bigint;
  v_breakdown jsonb;
  v_trend jsonb;
  v_schedule jsonb;
  v_documents jsonb;
  v_productivity jsonb;
  v_consumption jsonb;
  v_export jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  v_context := public.get_portal_access_context();
  IF v_context IS NULL THEN
    RAISE EXCEPTION 'portal_access_required' USING ERRCODE = '42501';
  END IF;

  v_org := NULLIF(v_context->>'organization_id', '')::uuid;
  v_role := v_context->>'role';

  -- Relatórios são escopados por município. Contas individuais sem
  -- organização ativa não produzem relatório municipal agregado.
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'municipal_scope_required' USING ERRCODE = '42501';
  END IF;

  -- Período ----------------------------------------------------------------
  BEGIN
    v_from := NULLIF(trim(COALESCE(p_filters->>'from', '')), '')::timestamptz;
    v_to   := NULLIF(trim(COALESCE(p_filters->>'to',   '')), '')::timestamptz;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'invalid_date_filter' USING ERRCODE = '22023';
  END;

  -- Default: últimos 30 dias completos até agora.
  IF v_from IS NULL OR v_to IS NULL THEN
    v_from := date_trunc('day', now()) - interval '29 days';
    v_to   := now();
  END IF;

  IF v_from > v_to THEN
    RAISE EXCEPTION 'invalid_date_range' USING ERRCODE = '22023';
  END IF;

  v_period_days := CEIL(EXTRACT(epoch FROM (v_to - v_from)) / 86400.0);
  -- Janela máxima autorizada: 366 dias (ano bissexto Incluso).
  IF v_period_days > 366 THEN
    RAISE EXCEPTION 'period_too_long: reporting window cannot exceed 366 days'
      USING ERRCODE = '22023';
  END IF;

  -- Filtros opcionais validados -------------------------------------------
  IF v_risk IS NOT NULL AND lower(v_risk) NOT IN ('r1','r2','r3','r4','baixo','médio','medio','alto','critico','crítico') THEN
    RAISE EXCEPTION 'invalid_risk_filter' USING ERRCODE = '22023';
  END IF;

  -- CORREÇÃO 2: UUID de formulário fora do escopo deve falhar explicitamente.
  IF v_form_id IS NOT NULL THEN
    -- formularioId em vistorias é texto legado. Quando vier como uuid
    -- válido, valida existência de um formulário ativo no município.
    IF v_form_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      SELECT f.versao INTO v_form_version
      FROM public.formularios f
      JOIN public.organizations o ON o.id = v_org
      WHERE f.id = v_form_id::uuid
        AND COALESCE(f.municipio, o.municipality_name) = o.municipality_name
        AND f.ativo = true;

      IF v_form_version IS NULL THEN
        RAISE EXCEPTION 'form_not_in_scope' USING ERRCODE = '42501';
      END IF;
    END IF;
    -- texto legado não-uuid: aceita como filtro direto sem validar.
  END IF;

  -- CORREÇÃO 1: teamMemberId só pode ser o próprio usuário se não for master/admin.
  -- Supervisor/Agent nunca pode consultar agenda, documentos, ciência ou
  -- produtividade de outro membro (privacidade individual).
  IF v_team_member IS NOT NULL THEN
    -- teamMemberId deve ser membro ativo da própria organização.
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = v_org
        AND om.user_id = v_team_member
        AND om.status = 'active'
    ) THEN
      RAISE EXCEPTION 'team_member_not_in_scope' USING ERRCODE = '42501';
    END IF;

    -- Supervisor e Agent só podem consultar próprios dados individuais.
    IF v_role NOT IN ('master', 'admin') AND v_team_member != v_user THEN
      RAISE EXCEPTION 'cannot_access_other_member_data' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 1) Volume de vistorias -------------------------------------------------
  SELECT count(*) INTO v_volume
  FROM public.vistorias vi
  WHERE vi.organization_id = v_org
    AND COALESCE(vi."dataVistoria", vi."criadoEm") >= v_from
    AND COALESCE(vi."dataVistoria", vi."criadoEm") <= v_to
    AND (v_risk IS NULL OR lower(COALESCE(vi."nivelRisco", '')) = lower(v_risk))
    AND (v_form_id IS NULL OR vi."formularioId" = v_form_id)
    AND (v_location IS NULL OR COALESCE(vi."enderecoBairro", vi.municipio, '') ILIKE ('%' || v_location || '%'))
    AND (v_team_member IS NULL OR vi."agenteUid"::text = v_team_member::text)
    AND (v_role IN ('master','admin') OR private.portal_agent_allowed(v_org, COALESCE(vi."agenteUid"::text, ''::text), v_user));

  -- 2) Distribuição e tendência de risco ----------------------------------
  SELECT COALESCE(jsonb_agg(row ORDER BY row->>'risk'), '[]'::jsonb) INTO v_breakdown
  FROM (
    SELECT jsonb_build_object(
      'risk', lower(COALESCE(vi."nivelRisco", 'indefinido')),
      'count', count(*)
    ) AS row
    FROM public.vistorias vi
    WHERE vi.organization_id = v_org
      AND COALESCE(vi."dataVistoria", vi."criadoEm") >= v_from
      AND COALESCE(vi."dataVistoria", vi."criadoEm") <= v_to
      AND (v_risk IS NULL OR lower(COALESCE(vi."nivelRisco", '')) = lower(v_risk))
      AND (v_form_id IS NULL OR vi."formularioId" = v_form_id)
      AND (v_location IS NULL OR COALESCE(vi."enderecoBairro", vi.municipio, '') ILIKE ('%' || v_location || '%'))
      AND (v_team_member IS NULL OR vi."agenteUid"::text = v_team_member::text)
      AND (v_role IN ('master','admin') OR private.portal_agent_allowed(v_org, COALESCE(vi."agenteUid"::text, ''::text), v_user))
    GROUP BY lower(COALESCE(vi."nivelRisco", 'indefinido'))
  ) dist;

  -- Tendência por bucket horizonte (por dia) do risco filtrado/total.
  SELECT COALESCE(jsonb_agg(point ORDER BY point->>'date'), '[]'::jsonb) INTO v_trend
  FROM (
    SELECT jsonb_build_object(
      'date', dseries::date,
      'total', count(vi.id),
      'highRisk', count(vi.id) FILTER (WHERE lower(COALESCE(vi."nivelRisco", '')) IN ('r4','critico','crítico','alto'))
    ) AS point
    FROM generate_series(date_trunc('day', v_from), date_trunc('day', v_to), interval '1 day') AS dseries
    LEFT JOIN public.vistorias vi
      ON COALESCE(date_trunc('day', vi."dataVistoria"), date_trunc('day', vi."criadoEm")) = dseries
     AND vi.organization_id = v_org
     AND (v_form_id IS NULL OR vi."formularioId" = v_form_id)
     AND (v_location IS NULL OR COALESCE(vi."enderecoBairro", vi.municipio, '') ILIKE ('%' || v_location || '%'))
     AND (v_team_member IS NULL OR vi."agenteUid"::text = v_team_member::text)
     AND (v_role IN ('master','admin') OR private.portal_agent_allowed(v_org, COALESCE(vi."agenteUid"::text, ''::text), v_user))
     AND (v_risk IS NULL OR lower(COALESCE(vi."nivelRisco", '')) = lower(v_risk))
    GROUP BY dseries
  ) trend;

  -- 3) Estados de agenda ---------------------------------------------------
  SELECT jsonb_build_object(
    'distribution', COALESCE(jsonb_agg(row ORDER BY row->>'status'), '[]'::jsonb)
  ) INTO v_schedule
  FROM (
    SELECT jsonb_build_object(
      'status', COALESCE(a.status, 'pendente'),
      'count', count(*)
    ) AS row
    FROM public.agendamentos a
    WHERE a.organization_id = v_org
      AND a.data_agendada >= v_from
      AND a.data_agendada <= v_to
      AND (v_team_member IS NULL OR a.agente_uid = v_team_member OR a.criado_por_uid = v_team_member)
      AND (v_location IS NULL OR COALESCE(a.endereco, a.municipio, '') ILIKE ('%' || v_location || '%'))
    GROUP BY COALESCE(a.status, 'pendente')
  ) sched;

  -- CORREÇÃO 3: Agregação unificada de documentos e ciência sem FULL JOIN.
  -- 4) Estados de documentos e ciência ------------------------------------
  SELECT jsonb_build_object(
    'documents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('status', status, 'count', cnt) ORDER BY status)
      FROM (
        SELECT gd.status, count(*) AS cnt
        FROM public.generated_documents gd
        WHERE gd.organization_id = v_org
          AND gd.created_at >= v_from
          AND gd.created_at <= v_to
          AND (v_team_member IS NULL OR gd.created_by = v_team_member)
        GROUP BY gd.status
      ) d
    ), '[]'::jsonb),
    'acknowledgements', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('outcome', outcome, 'count', cnt) ORDER BY outcome)
      FROM (
        SELECT COALESCE(dae.outcome, 'pending') AS outcome, count(*) AS cnt
        FROM public.document_acknowledgement_events dae
        WHERE dae.organization_id = v_org
          AND dae.recorded_at_server >= v_from
          AND dae.recorded_at_server <= v_to
          AND (v_team_member IS NULL OR dae.created_by = v_team_member)
        GROUP BY COALESCE(dae.outcome, 'pending')
      ) e
    ), '[]'::jsonb)
  ) INTO v_documents;

  -- 5) Produtividade da equipe --------------------------------------------
  SELECT COALESCE(jsonb_agg(member ORDER BY member->>'memberName'), '[]'::jsonb) INTO v_productivity
  FROM (
    SELECT jsonb_build_object(
      'memberId', om.user_id,
      'memberName', COALESCE(NULLIF(trim(u.name), ''), split_part(u.email, '@', 1), 'Membro'),
      'role', om.role,
      'inspections', count(DISTINCT vi.id),
      'completed', count(DISTINCT vi.id) FILTER (WHERE lower(COALESCE(vi.status, '')) IN ('concluida','concluído','concluido')),
      'appointments', count(DISTINCT a.id)
    ) AS member
    FROM public.organization_members om
    LEFT JOIN public.users u ON u.uid = om.user_id
    LEFT JOIN public.vistorias vi
      ON vi."agenteUid"::text = om.user_id::text
     AND vi.organization_id = v_org
     AND COALESCE(vi."dataVistoria", vi."criadoEm") >= v_from
     AND COALESCE(vi."dataVistoria", vi."criadoEm") <= v_to
     AND (v_risk IS NULL OR lower(COALESCE(vi."nivelRisco", '')) = lower(v_risk))
     AND (v_form_id IS NULL OR vi."formularioId" = v_form_id)
     AND (v_location IS NULL OR COALESCE(vi."enderecoBairro", vi.municipio, '') ILIKE ('%' || v_location || '%'))
    LEFT JOIN public.agendamentos a
      ON COALESCE(a.agente_uid, a.criado_por_uid) = om.user_id
     AND a.organization_id = v_org
     AND a.data_agendada >= v_from
     AND a.data_agendada <= v_to
    WHERE om.organization_id = v_org
      AND om.status = 'active'
      AND (v_team_member IS NULL OR om.user_id = v_team_member)
      AND (v_role IN ('master','admin') OR private.portal_agent_allowed(v_org, om.user_id::text, v_user))
    GROUP BY om.user_id, om.role, u.name, u.email
  ) prod;

  -- 6) Consumo ------------------------------------------------------------
  SELECT jsonb_build_object(
    'periodStart', min(agg.period_start),
    'periodEnd', max(agg.period_end),
    'resources', COALESCE(jsonb_agg(jsonb_build_object(
      'resourceCode', agg.resource_code,
      'consumed', agg.consumed,
      'periodStart', agg.period_start,
      'periodEnd', agg.period_end
    ) ORDER BY agg.resource_code), '[]'::jsonb)
  ) INTO v_consumption
  FROM (
    SELECT uc.resource_code,
           sum(uc.consumed) AS consumed,
           min(uc.period_start) AS period_start,
           max(uc.period_end) AS period_end
    FROM public.usage_counters uc
    WHERE uc.organization_id = v_org
      AND uc.period_start >= v_from
      AND uc.period_end <= v_to
    GROUP BY uc.resource_code
  ) agg;

  -- CORREÇÃO 4: Limite aplicado em CTE antes de jsonb_agg.
  -- 7) Linhas mínimas para exportação (apenas resumo, nunca PII em massa) -
  WITH bounded_export AS (
    SELECT
      COALESCE(vi."dataVistoria", vi."criadoEm") AS occurred_at,
      vi."nivelRisco" AS risk_level,
      vi.status,
      vi.protocolo AS protocol,
      vi."agenteUid" AS agent,
      vi."formularioId" AS form_id,
      COALESCE(vi."enderecoBairro", vi.municipio, '') AS location,
      vi.id AS vistoria_id
    FROM public.vistorias vi
    WHERE vi.organization_id = v_org
      AND COALESCE(vi."dataVistoria", vi."criadoEm") >= v_from
      AND COALESCE(vi."dataVistoria", vi."criadoEm") <= v_to
      AND (v_risk IS NULL OR lower(COALESCE(vi."nivelRisco", '')) = lower(v_risk))
      AND (v_form_id IS NULL OR vi."formularioId" = v_form_id)
      AND (v_location IS NULL OR COALESCE(vi."enderecoBairro", vi.municipio, '') ILIKE ('%' || v_location || '%'))
      AND (v_team_member IS NULL OR vi."agenteUid"::text = v_team_member::text)
      AND (v_role IN ('master','admin') OR private.portal_agent_allowed(v_org, COALESCE(vi."agenteUid"::text, ''::text), v_user))
    ORDER BY COALESCE(vi."dataVistoria", vi."criadoEm") DESC
    LIMIT 500
  )
  SELECT jsonb_build_object(
    'columns', jsonb_build_array('date','riskLevel','status','protocol','agent','formId','location','documents','acknowledgement'),
    'rows', COALESCE(jsonb_agg(jsonb_build_object(
      'occurredAt', be.occurred_at,
      'riskLevel', be.risk_level,
      'status', be.status,
      'protocol', be.protocol,
      'agent', be.agent,
      'formId', be.form_id,
      'location', be.location,
      'documents', (SELECT count(*) FROM public.generated_documents gd WHERE gd.vistoria_id = be.vistoria_id),
      'acknowledgement', (SELECT string_agg(COALESCE(dae.outcome, ''), ', ') FROM public.document_acknowledgement_events dae WHERE dae.document_id IN (SELECT gd.id FROM public.generated_documents gd WHERE gd.vistoria_id = be.vistoria_id))
    )), '[]'::jsonb)
  ) INTO v_export
  FROM bounded_export be;

  RETURN jsonb_build_object(
    'scope', jsonb_build_object(
      'organizationId', v_org,
      'role', v_role,
      'from', v_from,
      'to', v_to,
      'periodDays', v_period_days,
      'filters', jsonb_strip_nulls(jsonb_build_object(
        'risk', v_risk,
        'formId', v_form_id,
        'teamMemberId', v_team_member,
        'location', v_location
      ))
    ),
    'volume', v_volume,
    'risk', jsonb_build_object('breakdown', v_breakdown, 'trend', v_trend),
    'schedule', v_schedule,
    'documents', v_documents,
    'productivity', v_productivity,
    'consumption', v_consumption,
    'export', v_export
  );
END;
$$;

COMMENT ON FUNCTION public.portal_get_reporting(jsonb) IS
  'Relatório municipal agregado do portal. Escopo (organizationId) e papel são resolvidos server-side via get_portal_access_context; nunca aceitos do cliente. Período máximo 366 dias. Supervisores respeitam portal_agent_allowed. Supervisor/Agent só podem consultar próprios dados individuais via teamMemberId. Retorna volume, risco (distribuição+tendência), agenda, documentos/ciência, produtividade, consumo e linhas mínimas para exportação (máximo 500).';
