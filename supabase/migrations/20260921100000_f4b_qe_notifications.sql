-- F4b — Notificações da revisão de qualidade (QE)
-- 1) novos tipos: qe_fila_nova (supervisor/admin da org) e qe_aprovada (agente)

ALTER TABLE public.notificacoes DROP CONSTRAINT notificacoes_tipo_check;
ALTER TABLE public.notificacoes ADD CONSTRAINT notificacoes_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'alto_risco','formulario_novo','novo_usuario','limite_firebase','token_usado',
    'atribuicao_nova','cobranca','qe_devolvida','qe_aprovada','qe_fila_nova',
    'suporte_resposta','inatividade_org','relatorio_mensal'
  ]));

-- 2) trigger: ao entrar na fila, avisar supervisores/admins da org (ou do município no legado)
CREATE OR REPLACE FUNCTION public.enqueue_qe_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_ciclo int;
  v_rev_id uuid;
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
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) qe_revisar: além da devolução, avisar o agente também na APROVAÇÃO
CREATE OR REPLACE FUNCTION public.qe_revisar(p_revisao_id uuid, p_nota integer, p_checklist jsonb, p_parecer text, p_aprovado boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_role text; v_nome text; v_municipio text;
  v_rev public.revisoes_qe;
  v_agente_uid text;
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

  SELECT "agenteUid" INTO v_agente_uid FROM public.vistorias WHERE id = v_rev.vistoria_id;

  IF v_agente_uid IS NOT NULL THEN
    IF p_aprovado THEN
      INSERT INTO public.notificacoes (tipo, titulo, corpo, destinatario_uid, municipio, payload, lida, criada_em)
      VALUES (
        'qe_aprovada',
        'Vistoria aprovada na revisão de qualidade',
        CASE WHEN p_nota IS NOT NULL
          THEN 'Sua vistoria foi conferida e aprovada — nota ' || p_nota || '/10.'
          ELSE 'Sua vistoria foi conferida e aprovada na revisão de qualidade.' END,
        v_agente_uid, v_rev.municipio,
        jsonb_build_object('vistoria_id', v_rev.vistoria_id, 'ciclo', v_rev.ciclo, 'revisao_id', p_revisao_id, 'nota', p_nota),
        false, now()
      );
    ELSE
      INSERT INTO public.notificacoes (tipo, titulo, corpo, destinatario_uid, municipio, payload, lida, criada_em)
      VALUES (
        'qe_devolvida',
        'Vistoria devolvida para correção',
        coalesce(nullif(btrim(coalesce(p_parecer,'')), ''), 'Revise os pontos sinalizados e reenvie.'),
        v_agente_uid, v_rev.municipio,
        jsonb_build_object('vistoria_id', v_rev.vistoria_id, 'ciclo', v_rev.ciclo, 'revisao_id', p_revisao_id),
        false, now()
      );
    END IF;
  END IF;
END
$function$;
