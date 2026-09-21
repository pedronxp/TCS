-- F4c — QE: fan-out das notificações para a caixa de entrada unificada
-- (domain_events + inbox_recipients, lidas pelo app via get_my_inbox).
-- A tabela notificacoes continua recebendo o registro legado (archival).

-- 1) Trigger: nova vistoria na fila → avisa supervisores/admins da org
CREATE OR REPLACE FUNCTION public.enqueue_qe_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_ciclo int;
  v_rev_id uuid;
  v_event_id uuid;
  v_workspace text;
  v_actor uuid;
BEGIN
  IF NEW.status = 'concluida' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'concluida') THEN
    SELECT coalesce(max(ciclo), 0) + 1 INTO v_ciclo
    FROM public.revisoes_qe WHERE vistoria_id = NEW.id;

    INSERT INTO public.revisoes_qe (vistoria_id, organization_id, municipio, ciclo, status)
    VALUES (NEW.id, NEW.organization_id, NEW.municipio, v_ciclo, 'pendente')
    ON CONFLICT (vistoria_id, ciclo) DO NOTHING
    RETURNING id INTO v_rev_id;

    IF v_rev_id IS NOT NULL THEN
      INSERT INTO public.notificacoes (tipo, titulo, corpo, destinatario_uid, municipio, payload, lida, criada_em)
      SELECT
        'qe_fila_nova',
        'Nova vistoria na fila de qualidade',
        coalesce(nullif(btrim(NEW."agenteNome"), ''), 'Um agente')
          || ' concluiu a vistoria em '
          || coalesce(nullif(btrim(NEW.endereco), ''), 'endereço não informado')
          || ' — toque para revisar.',
        u.uid,
        NEW.municipio,
        jsonb_build_object('vistoria_id', NEW.id, 'revisao_id', v_rev_id, 'ciclo', v_ciclo),
        false,
        now()
      FROM public.users u
      WHERE u.role IN ('supervisor', 'admin')
        AND coalesce(u."isApproved", false)
        AND u.uid::text IS DISTINCT FROM NEW."agenteUid"
        AND (
          (NEW.organization_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = NEW.organization_id
              AND om.user_id = u.uid
              AND om.status = 'active'
          ))
          OR
          (NEW.organization_id IS NULL AND u.municipio = NEW.municipio)
        );

      v_workspace := CASE WHEN NEW.organization_id IS NOT NULL THEN 'organization' ELSE 'individual' END;
      v_actor := CASE WHEN NEW."agenteUid" ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                      THEN NEW."agenteUid"::uuid ELSE NULL END;

      INSERT INTO public.domain_events (
        event_type, module_key, actor_context, actor_user_id, organization_id,
        affected_user_id, entity_type, entity_id, severity, title, body,
        route_key, payload, dedupe_key, thread_key
      )
      VALUES (
        'qe.review_pending', 'qe', v_workspace, v_actor, NEW.organization_id,
        NULL, 'qe_review', v_rev_id::text, 'info',
        'Nova vistoria na fila de qualidade',
        coalesce(nullif(btrim(NEW."agenteNome"), ''), 'Um agente')
          || ' concluiu a vistoria em '
          || coalesce(nullif(btrim(NEW.endereco), ''), 'endereço não informado')
          || '. Abra a revisão de qualidade para conferir.',
        'qe',
        jsonb_build_object('vistoria_id', NEW.id, 'revisao_id', v_rev_id, 'ciclo', v_ciclo),
        'qe_review_pending:' || v_rev_id::text,
        'qe:' || NEW.id::text
      )
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_event_id;

      IF v_event_id IS NOT NULL THEN
        INSERT INTO public.inbox_recipients (event_id, recipient_user_id, workspace_kind, organization_id)
        SELECT v_event_id, u.uid, v_workspace, NEW.organization_id
        FROM public.users u
        WHERE u.role IN ('supervisor', 'admin')
          AND coalesce(u."isApproved", false)
          AND u.uid::text IS DISTINCT FROM NEW."agenteUid"
          AND (
            (NEW.organization_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.organization_members om
              WHERE om.organization_id = NEW.organization_id
                AND om.user_id = u.uid
                AND om.status = 'active'
            ))
            OR
            (NEW.organization_id IS NULL AND u.municipio = NEW.municipio)
          )
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) qe_revisar: aprovação E devolução agora chegam ao agente na caixa de entrada
CREATE OR REPLACE FUNCTION public.qe_revisar(p_revisao_id uuid, p_nota integer, p_checklist jsonb, p_parecer text, p_aprovado boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_role text; v_nome text; v_municipio text;
  v_rev public.revisoes_qe;
  v_agente_uid text;
  v_agente_uuid uuid;
  v_event_id uuid;
  v_workspace text;
  v_endereco text;
BEGIN
  SELECT u.role, u.name, u.municipio INTO v_role, v_nome, v_municipio
  FROM public.users u WHERE u.uid = auth.uid() AND coalesce(u."isApproved", false);
  IF v_role NOT IN ('supervisor','admin','master_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

  SELECT * INTO v_rev FROM public.revisoes_qe WHERE id = p_revisao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'review_not_found' USING ERRCODE='P0002'; END IF;
  IF v_rev.status <> 'pendente' THEN RAISE EXCEPTION 'review_already_closed' USING ERRCODE='P0001'; END IF;

  IF v_role <> 'master_admin'
     AND NOT (v_rev.organization_id IS NOT NULL AND v_rev.organization_id IN (SELECT my_organization_ids()))
     AND NOT (v_rev.organization_id IS NULL AND v_rev.municipio = v_municipio) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;

  IF p_nota IS NOT NULL AND (p_nota < 0 OR p_nota > 10) THEN
    RAISE EXCEPTION 'invalid_nota' USING ERRCODE='22023'; END IF;
  IF p_checklist IS NOT NULL AND jsonb_typeof(p_checklist) <> 'array' THEN
    RAISE EXCEPTION 'invalid_checklist' USING ERRCODE='22023'; END IF;

  UPDATE public.revisoes_qe
  SET status = CASE WHEN p_aprovado THEN 'aprovada' ELSE 'devolvida' END,
      nota = p_nota,
      checklist = coalesce(p_checklist, '[]'::jsonb),
      parecer = nullif(btrim(coalesce(p_parecer,'')), ''),
      revisor_uid = auth.uid(),
      revisor_nome = v_nome,
      respondida_em = now()
  WHERE id = p_revisao_id;

  SELECT "agenteUid", endereco INTO v_agente_uid, v_endereco
  FROM public.vistorias WHERE id = v_rev.vistoria_id;

  IF v_agente_uid IS NULL THEN RETURN; END IF;

  INSERT INTO public.notificacoes (tipo, titulo, corpo, destinatario_uid, municipio, payload, lida, criada_em)
  VALUES (
    CASE WHEN p_aprovado THEN 'qe_aprovada' ELSE 'qe_devolvida' END,
    CASE WHEN p_aprovado THEN 'Vistoria aprovada na revisão de qualidade' ELSE 'Vistoria devolvida para correção' END,
    CASE
      WHEN p_aprovado THEN
        CASE WHEN p_nota IS NOT NULL
          THEN 'Sua vistoria foi conferida e aprovada — nota ' || p_nota || '/10.'
          ELSE 'Sua vistoria foi conferida e aprovada na revisão de qualidade.' END
      ELSE coalesce(nullif(btrim(coalesce(p_parecer,'')), ''), 'Revise os pontos sinalizados e reenvie.')
    END,
    v_agente_uid, v_rev.municipio,
    jsonb_build_object('vistoria_id', v_rev.vistoria_id, 'ciclo', v_rev.ciclo, 'revisao_id', p_revisao_id, 'nota', p_nota),
    false, now()
  );

  v_workspace := CASE WHEN v_rev.organization_id IS NOT NULL THEN 'organization' ELSE 'individual' END;
  v_agente_uuid := CASE WHEN v_agente_uid ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                        THEN v_agente_uid::uuid ELSE NULL END;
  IF v_agente_uuid IS NULL THEN RETURN; END IF;

  INSERT INTO public.domain_events (
    event_type, module_key, actor_context, actor_user_id, organization_id,
    affected_user_id, entity_type, entity_id, severity, title, body,
    route_key, payload, dedupe_key, thread_key
  )
  VALUES (
    CASE WHEN p_aprovado THEN 'qe.review_approved' ELSE 'qe.review_returned' END,
    'qe', v_workspace, auth.uid(), v_rev.organization_id,
    v_agente_uuid, 'qe_review', p_revisao_id::text,
    CASE WHEN p_aprovado THEN 'success' ELSE 'warning' END,
    CASE WHEN p_aprovado THEN 'Vistoria aprovada na revisão de qualidade' ELSE 'Vistoria devolvida para correção' END,
    CASE
      WHEN p_aprovado THEN
        'Sua vistoria em ' || coalesce(nullif(btrim(v_endereco), ''), 'endereço não informado')
          || ' foi conferida e aprovada'
          || CASE WHEN p_nota IS NOT NULL THEN ' — nota ' || p_nota || '/10.' ELSE '.' END
      ELSE
        'Sua vistoria em ' || coalesce(nullif(btrim(v_endereco), ''), 'endereço não informado')
          || ' precisa de correção: '
          || coalesce(nullif(btrim(coalesce(p_parecer,'')), ''), 'revise os pontos sinalizados e reenvie.')
    END,
    'qe',
    jsonb_build_object('vistoria_id', v_rev.vistoria_id, 'ciclo', v_rev.ciclo, 'revisao_id', p_revisao_id, 'nota', p_nota),
    'qe_result:' || p_revisao_id::text,
    'qe:' || v_rev.vistoria_id::text
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NOT NULL THEN
    INSERT INTO public.inbox_recipients (event_id, recipient_user_id, workspace_kind, organization_id)
    VALUES (v_event_id, v_agente_uuid, v_workspace, v_rev.organization_id)
    ON CONFLICT DO NOTHING;
  END IF;
END
$function$;
