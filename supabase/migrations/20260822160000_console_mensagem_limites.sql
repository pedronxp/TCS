-- Console: compor e publicar comunicado direto do /app (com tipo/severidade e
-- agendamento) + limite de números ativos por prefeitura (3) para conter o
-- padrão "uma conta caiu, cadastra outra" antes que vire fazenda de números.

-- ---------------------------------------------------------------------------
-- Limite de números ativos por organização nas duas vias de criação.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.portal_criar_sessao_bot()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid := private.current_organization_id();
  v_id uuid;
  v_ativas integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF v_org IS NULL THEN RAISE EXCEPTION 'municipal_membership_required' USING ERRCODE = '42501'; END IF;
  IF private.organization_role(v_org) NOT IN ('master', 'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  SELECT count(*) INTO v_ativas FROM public.bot_sessoes
  WHERE organization_id = v_org AND status IN ('vinculado', 'aguardando_qr');
  IF v_ativas >= 3 THEN
    RAISE EXCEPTION 'limite_numeros_atingido' USING ERRCODE = '22023';
  END IF;

  UPDATE public.bot_sessoes SET status = 'desconectado', atualizado_em = now()
  WHERE organization_id = v_org AND status = 'aguardando_qr'
    AND atualizado_em < now() - interval '30 minutes';

  INSERT INTO public.bot_sessoes (organization_id, vinculado_por)
  VALUES (v_org, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.internal_criar_sessao_bot(p_organization_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_ativas integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT private.has_internal_permission('communication.manage') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*) INTO v_ativas FROM public.bot_sessoes
  WHERE organization_id = p_organization_id AND status IN ('vinculado', 'aguardando_qr');
  IF v_ativas >= 3 THEN
    RAISE EXCEPTION 'limite_numeros_atingido' USING ERRCODE = '22023';
  END IF;

  UPDATE public.bot_sessoes SET status = 'desconectado', atualizado_em = now()
  WHERE organization_id = p_organization_id AND status = 'aguardando_qr'
    AND atualizado_em < now() - interval '30 minutes';

  INSERT INTO public.bot_sessoes (organization_id, vinculado_por)
  VALUES (p_organization_id, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Compor/publicar comunicado pelo console interno.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.internal_upsert_comunicado(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid := NULLIF(p_payload->>'organization_id', '')::uuid;
  v_role_ok boolean := private.has_internal_permission('communication.manage');
  v_id uuid := NULLIF(p_payload->>'id', '')::uuid;
  v_comunicado public.comunicados;
  v_titulo text := btrim(coalesce(p_payload->>'titulo', ''));
  v_conteudo text := coalesce(p_payload->>'conteudo', '');
  v_severidade text := coalesce(p_payload->>'severidade', 'informacao');
  v_expira timestamptz := NULLIF(p_payload->>'expira_em', '')::timestamptz;
  v_publicar timestamptz := NULLIF(p_payload->>'publicar_em', '')::timestamptz;
  v_destinos jsonb := coalesce(p_payload->'destinos', '[]'::jsonb);
  v_destino jsonb;
  v_bairro_id uuid;
  v_todo boolean;
  v_tem_destino boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT v_role_ok THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF v_org IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org) THEN
    RAISE EXCEPTION 'organizacao_obrigatoria' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_titulo) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'titulo_invalido' USING ERRCODE = '22023'; END IF;
  IF char_length(v_conteudo) NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'conteudo_invalido' USING ERRCODE = '22023'; END IF;
  IF v_severidade NOT IN ('informacao', 'alerta', 'emergencia') THEN RAISE EXCEPTION 'severidade_invalida' USING ERRCODE = '22023'; END IF;
  IF jsonb_typeof(v_destinos) <> 'array' THEN RAISE EXCEPTION 'destinos_invalidos' USING ERRCODE = '22023'; END IF;

  IF v_id IS NOT NULL THEN
    SELECT * INTO v_comunicado FROM public.comunicados
    WHERE id = v_id AND organization_id = v_org;
    IF v_comunicado.id IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
    IF v_comunicado.status NOT IN ('rascunho', 'agendado') THEN
      RAISE EXCEPTION 'somente_rascunho_ou_agendado_editavel' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.comunicados (organization_id, titulo, conteudo, severidade, autor_uid, expira_em, publicar_em)
    VALUES (v_org, v_titulo, v_conteudo, v_severidade, auth.uid(), v_expira, v_publicar)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.comunicados
    SET titulo = v_titulo, conteudo = v_conteudo, severidade = v_severidade,
        expira_em = v_expira, publicar_em = v_publicar, updated_at = now()
    WHERE id = v_id AND organization_id = v_org;
  END IF;

  DELETE FROM public.comunicado_destinos WHERE comunicado_id = v_id;
  FOR v_destino IN SELECT * FROM jsonb_array_elements(v_destinos) LOOP
    v_todo := coalesce((v_destino->>'todo_municipio')::boolean, false);
    v_bairro_id := NULLIF(v_destino->>'bairro_id', '')::uuid;
    IF v_todo THEN
      INSERT INTO public.comunicado_destinos (comunicado_id, todo_municipio) VALUES (v_id, true);
      v_tem_destino := true;
    ELSIF v_bairro_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.bairros
        WHERE id = v_bairro_id AND organization_id = v_org AND ativo
      ) THEN
        RAISE EXCEPTION 'bairro_invalido' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.comunicado_destinos (comunicado_id, bairro_id) VALUES (v_id, v_bairro_id);
      v_tem_destino := true;
    END IF;
  END LOOP;
  IF NOT v_tem_destino THEN
    INSERT INTO public.comunicado_destinos (comunicado_id, todo_municipio) VALUES (v_id, true);
  END IF;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.internal_upsert_comunicado(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_upsert_comunicado(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.internal_set_comunicado_status(
  p_comunicado_id uuid,
  p_status text,
  p_publicar_em timestamptz DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_comunicado public.comunicados;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT private.has_internal_permission('communication.manage') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('agendado', 'publicado', 'arquivado', 'rascunho') THEN
    RAISE EXCEPTION 'status_invalido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_comunicado FROM public.comunicados WHERE id = p_comunicado_id;
  IF v_comunicado.id IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;

  IF p_status = 'agendado' THEN
    IF v_comunicado.status NOT IN ('rascunho', 'agendado') THEN RAISE EXCEPTION 'transicao_invalida' USING ERRCODE = '22023'; END IF;
    IF p_publicar_em IS NULL OR p_publicar_em <= now() THEN RAISE EXCEPTION 'agendimento_invalido' USING ERRCODE = '22023'; END IF;
    UPDATE public.comunicados SET status = 'agendado', publicar_em = p_publicar_em, updated_at = now() WHERE id = p_comunicado_id;
  ELSIF p_status = 'publicado' THEN
    IF v_comunicado.status NOT IN ('rascunho', 'agendado', 'arquivado') THEN RAISE EXCEPTION 'transicao_invalida' USING ERRCODE = '22023'; END IF;
    UPDATE public.comunicados SET status = 'publicado', publicado_em = now(), publicar_em = NULL, updated_at = now() WHERE id = p_comunicado_id;
  ELSIF p_status = 'arquivado' THEN
    IF v_comunicado.status NOT IN ('publicado', 'agendado') THEN RAISE EXCEPTION 'transicao_invalida' USING ERRCODE = '22023'; END IF;
    UPDATE public.comunicados SET status = 'arquivado', publicar_em = NULL, updated_at = now() WHERE id = p_comunicado_id;
  ELSE
    IF v_comunicado.status <> 'agendado' THEN RAISE EXCEPTION 'transicao_invalida' USING ERRCODE = '22023'; END IF;
    UPDATE public.comunicados SET status = 'rascunho', publicar_em = NULL, updated_at = now() WHERE id = p_comunicado_id;
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.internal_set_comunicado_status(uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_set_comunicado_status(uuid, text, timestamptz) TO authenticated;
