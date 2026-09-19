-- ============================================================
-- F4a — QE de vistorias (qualidade): fila retroativa, nunca bloqueia campo
-- Revisor: supervisor/admin da org. Nota 0-10 + checklist + parecer.
-- Reenvio = novo ciclo. (Aplicada via MCP; arquivo espelha o remoto)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.revisoes_qe (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vistoria_id     uuid NOT NULL REFERENCES public.vistorias(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id),
  municipio       text,
  ciclo           integer NOT NULL DEFAULT 1,
  status          text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','aprovada','devolvida')),
  nota            integer CHECK (nota IS NULL OR nota BETWEEN 0 AND 10),
  checklist       jsonb NOT NULL DEFAULT '[]'::jsonb,
  parecer         text,
  revisor_uid     uuid,
  revisor_nome    text,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  respondida_em   timestamptz,
  UNIQUE (vistoria_id, ciclo)
);
CREATE INDEX IF NOT EXISTS revisoes_qe_status_idx ON public.revisoes_qe(status);
CREATE INDEX IF NOT EXISTS revisoes_qe_org_idx    ON public.revisoes_qe(organization_id);
CREATE INDEX IF NOT EXISTS revisoes_qe_vistoria_idx ON public.revisoes_qe(vistoria_id);

ALTER TABLE public.revisoes_qe ENABLE ROW LEVEL SECURITY;

CREATE POLICY revisoes_qe_read ON public.revisoes_qe
FOR SELECT TO authenticated
USING (
  get_my_role() = ANY (ARRAY['master_admin','owner','developer'])
  OR (organization_id IS NOT NULL AND organization_id IN (SELECT my_organization_ids()))
  OR (organization_id IS NULL AND municipio = get_my_municipio())
);

CREATE OR REPLACE FUNCTION public.enqueue_qe_review()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_ciclo int;
BEGIN
  IF NEW.status = 'concluida' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'concluida') THEN
    SELECT coalesce(max(ciclo), 0) + 1 INTO v_ciclo
    FROM public.revisoes_qe WHERE vistoria_id = NEW.id;

    INSERT INTO public.revisoes_qe (vistoria_id, organization_id, municipio, ciclo, status)
    VALUES (NEW.id, NEW.organization_id, NEW.municipio, v_ciclo, 'pendente')
    ON CONFLICT (vistoria_id, ciclo) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enqueue_qe_review ON public.vistorias;
CREATE TRIGGER trg_enqueue_qe_review
AFTER INSERT OR UPDATE OF status ON public.vistorias
FOR EACH ROW EXECUTE FUNCTION public.enqueue_qe_review();

CREATE OR REPLACE FUNCTION public.qe_fila()
RETURNS TABLE (
  revisao_id uuid, vistoria_id uuid, ciclo integer, status text,
  agente_nome text, endereco text, nivel_risco text, data_vistoria timestamptz,
  criado_em timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_role text; v_municipio text;
BEGIN
  SELECT u.role, u.municipio INTO v_role, v_municipio
  FROM public.users u WHERE u.uid = auth.uid() AND coalesce(u."isApproved", false);

  IF v_role NOT IN ('supervisor','admin','master_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
  SELECT r.id, r.vistoria_id, r.ciclo, r.status,
         v."agenteNome", v.endereco, v."nivelRisco", v."dataVistoria", r.criado_em
  FROM public.revisoes_qe r
  JOIN public.vistorias v ON v.id = r.vistoria_id
  WHERE r.status = 'pendente'
    AND (
      v_role = 'master_admin'
      OR (r.organization_id IS NOT NULL AND r.organization_id IN (SELECT my_organization_ids()))
      OR (r.organization_id IS NULL AND r.municipio = v_municipio)
    )
  ORDER BY CASE v."nivelRisco" WHEN 'r4' THEN 0 WHEN 'r3' THEN 1 WHEN 'r2' THEN 2 ELSE 3 END, r.criado_em;
END $$;
REVOKE ALL ON FUNCTION public.qe_fila() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qe_fila() TO authenticated;

CREATE OR REPLACE FUNCTION public.qe_revisar(
  p_revisao_id uuid,
  p_nota integer,
  p_checklist jsonb,
  p_parecer text,
  p_aprovado boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
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

  IF NOT p_aprovado THEN
    SELECT "agenteUid" INTO v_agente_uid FROM public.vistorias WHERE id = v_rev.vistoria_id;
    IF v_agente_uid IS NOT NULL THEN
      INSERT INTO public.notificacoes (tipo, titulo, corpo, destinatario_uid, municipio, payload, lida, criado_em)
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
END $$;
REVOKE ALL ON FUNCTION public.qe_revisar(uuid,integer,jsonb,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qe_revisar(uuid,integer,jsonb,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.qe_status_vistoria(p_vistoria_id uuid)
RETURNS TABLE (status text, ciclo integer, nota integer, parecer text, respondida_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT r.status, r.ciclo, r.nota, r.parecer, r.respondida_em
  FROM public.revisoes_qe r
  WHERE r.vistoria_id = p_vistoria_id
  ORDER BY r.ciclo DESC LIMIT 1;
END $$;
REVOKE ALL ON FUNCTION public.qe_status_vistoria(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qe_status_vistoria(uuid) TO authenticated;

ALTER TABLE public.notificacoes DROP CONSTRAINT notificacoes_tipo_check;
ALTER TABLE public.notificacoes ADD CONSTRAINT notificacoes_tipo_check
CHECK (tipo = ANY (ARRAY['alto_risco','formulario_novo','novo_usuario','limite_firebase','token_usado','atribuicao_nova','cobranca','qe_devolvida']));
