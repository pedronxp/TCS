-- Comunidades WhatsApp: registro + disparo assistido + agendamento de comunicados.
--
-- Sem API oficial da Meta para Comunidades, o envio permanece MANUAL e ASSISTIDO:
-- o TCS agenda e publica nos canais oficiais (app/portal), gera a mensagem pronta
-- (copiar + abrir WhatsApp) e registra cada replicação na comunidade para auditoria.
-- Nenhuma automação que imite o cliente WhatsApp é introduzida (conformidade do plano).
--
-- Agendamento: status 'agendado' com publicar_em; a publicação vence quando
-- portal_list_comunicados roda (publicação preguiçosa, sem dependência de cron).

ALTER TABLE public.comunicados
  ADD COLUMN IF NOT EXISTS publicar_em timestamptz;

ALTER TABLE public.comunicados DROP CONSTRAINT IF EXISTS comunicados_status_valid;
ALTER TABLE public.comunicados
  ADD CONSTRAINT comunicados_status_valid
  CHECK (status IN ('rascunho', 'agendado', 'publicado', 'arquivado'));

ALTER TABLE public.comunicados DROP CONSTRAINT IF EXISTS comunicados_publicacao_coerente;
ALTER TABLE public.comunicados
  ADD CONSTRAINT comunicados_publicacao_coerente
  CHECK (
    (publicado_em IS NULL OR status IN ('publicado', 'arquivado'))
    AND (status <> 'agendado' OR publicar_em IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS comunicados_org_agendados_idx
  ON public.comunicados (organization_id, publicar_em) WHERE status = 'agendado';

-- Cadastro das comunidades: nome/link/telefone administrador por organização.
ALTER TABLE public.canais_externos ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.canais_externos ADD COLUMN IF NOT EXISTS link_convite text;
ALTER TABLE public.canais_externos ADD COLUMN IF NOT EXISTS telefone_admin text;

-- Auditoria do disparo assistido: quem replicou o quê, quando.
CREATE TABLE IF NOT EXISTS public.canal_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal_id uuid NOT NULL REFERENCES public.canais_externos(id) ON DELETE RESTRICT,
  comunicado_id uuid NOT NULL REFERENCES public.comunicados(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'enviado',
  registrado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT canal_envios_status_valid CHECK (status IN ('enviado', 'falhou'))
);
CREATE UNIQUE INDEX IF NOT EXISTS canal_envios_canal_comunicado_key
  ON public.canal_envios (canal_id, comunicado_id);
CREATE INDEX IF NOT EXISTS canal_envios_canal_idx ON public.canal_envios (canal_id);

ALTER TABLE public.canal_envios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.canal_envios FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS canal_envios_portal_select ON public.canal_envios;
CREATE POLICY canal_envios_portal_select ON public.canal_envios FOR SELECT TO authenticated
USING (
  (SELECT private.is_owner_admin())
  OR EXISTS (
    SELECT 1 FROM public.canais_externos c
    WHERE c.id = canal_envios.canal_id
      AND c.organization_id = (SELECT private.current_organization_id())
  )
);

-- ---------------------------------------------------------------------------
-- Publicação vencida: promovida na leitura da lista (sem cron no Free tier).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.portal_publish_due_comunicados()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_atualizados integer;
BEGIN
  UPDATE public.comunicados
  SET status = 'publicado', publicado_em = publicar_em, updated_at = now()
  WHERE status = 'agendado' AND publicar_em IS NOT NULL AND publicar_em <= now();
  GET DIAGNOSTICS v_atualizados = ROW_COUNT;
  RETURN v_atualizados;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_publish_due_comunicados() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lista de comunicados: agora VOLATILE (promove agendados vencidos) e traz
-- publicar_em + envios assistidos por comunidade.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.portal_list_comunicados()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid := private.current_organization_id();
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF v_org IS NULL THEN RETURN '[]'::jsonb; END IF;
  v_role := private.organization_role(v_org);

  PERFORM public.portal_publish_due_comunicados();

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'titulo', c.titulo,
        'conteudo', c.conteudo,
        'severidade', c.severidade,
        'status', c.status,
        'autor_nome', u.name,
        'publicado_em', c.publicado_em,
        'publicar_em', c.publicar_em,
        'expira_em', c.expira_em,
        'criado_em', c.created_at,
        'destinos', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'bairro_id', d.bairro_id,
            'bairro_nome', b.nome,
            'todo_municipio', d.todo_municipio
          ) ORDER BY d.todo_municipio DESC, b.nome NULLS FIRST)
          FROM public.comunicado_destinos d
          LEFT JOIN public.bairros b ON b.id = d.bairro_id
          WHERE d.comunicado_id = c.id
        ), '[]'::jsonb),
        'total_leituras', (SELECT count(*) FROM public.comunicado_leituras l WHERE l.comunicado_id = c.id),
        'lido', EXISTS (
          SELECT 1 FROM public.comunicado_leituras l
          WHERE l.comunicado_id = c.id AND l.leitor_uid = auth.uid()
        ),
        'pode_editar', v_role IN ('master', 'admin'),
        'envios', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'canal_id', e.canal_id,
            'canal_nome', k.nome,
            'enviado_em', e.enviado_em,
            'registrado_por_nome', uu.name
          ) ORDER BY e.enviado_em DESC)
          FROM public.canal_envios e
          JOIN public.canais_externos k ON k.id = e.canal_id
          LEFT JOIN public.users uu ON uu.uid = e.registrado_por
          WHERE e.comunicado_id = c.id
        ), '[]'::jsonb)
      )
      ORDER BY CASE c.status
                 WHEN 'publicado' THEN 0 WHEN 'agendado' THEN 1
                 WHEN 'rascunho' THEN 2 ELSE 3 END,
               COALESCE(c.publicado_em, c.publicar_em, c.created_at) DESC
    )
    FROM public.comunicados c
    LEFT JOIN public.users u ON u.uid = c.autor_uid
    WHERE c.organization_id = v_org
      AND (c.status IN ('publicado', 'arquivado') OR v_role IN ('master', 'admin'))
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.portal_list_comunicados() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_list_comunicados() TO authenticated;

-- Upsert aceita agendamento; rascunho E agendado são editáveis.
CREATE OR REPLACE FUNCTION public.portal_upsert_comunicado(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid := private.current_organization_id();
  v_role text;
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
  IF v_org IS NULL THEN RAISE EXCEPTION 'municipal_membership_required' USING ERRCODE = '42501'; END IF;
  v_role := private.organization_role(v_org);
  IF v_role NOT IN ('master', 'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

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
REVOKE ALL ON FUNCTION public.portal_upsert_comunicado(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_upsert_comunicado(jsonb) TO authenticated;

-- Transições com agendamento:
--   rascunho/agendado -> agendado (exige publicar_em futuro)
--   rascunho/agendado/arquivado -> publicado (imediato)
--   publicado/agendado -> arquivado
--   agendado -> rascunho (cancela agendamento)
DROP FUNCTION IF EXISTS public.portal_set_comunicado_status(uuid, text);
CREATE OR REPLACE FUNCTION public.portal_set_comunicado_status(
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
  v_org uuid := private.current_organization_id();
  v_role text;
  v_comunicado public.comunicados;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF v_org IS NULL THEN RAISE EXCEPTION 'municipal_membership_required' USING ERRCODE = '42501'; END IF;
  v_role := private.organization_role(v_org);
  IF v_role NOT IN ('master', 'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('agendado', 'publicado', 'arquivado', 'rascunho') THEN
    RAISE EXCEPTION 'status_invalido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_comunicado FROM public.comunicados
  WHERE id = p_comunicado_id AND organization_id = v_org;
  IF v_comunicado.id IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;

  IF p_status = 'agendado' THEN
    IF v_comunicado.status NOT IN ('rascunho', 'agendado') THEN
      RAISE EXCEPTION 'transicao_invalida' USING ERRCODE = '22023';
    END IF;
    IF p_publicar_em IS NULL OR p_publicar_em <= now() THEN
      RAISE EXCEPTION 'agendimento_invalido' USING ERRCODE = '22023';
    END IF;
    UPDATE public.comunicados
    SET status = 'agendado', publicar_em = p_publicar_em, updated_at = now()
    WHERE id = p_comunicado_id;
  ELSIF p_status = 'publicado' THEN
    IF v_comunicado.status NOT IN ('rascunho', 'agendado', 'arquivado') THEN
      RAISE EXCEPTION 'transicao_invalida' USING ERRCODE = '22023';
    END IF;
    UPDATE public.comunicados
    SET status = 'publicado', publicado_em = now(), publicar_em = NULL, updated_at = now()
    WHERE id = p_comunicado_id;
  ELSIF p_status = 'arquivado' THEN
    IF v_comunicado.status NOT IN ('publicado', 'agendado') THEN
      RAISE EXCEPTION 'transicao_invalida' USING ERRCODE = '22023';
    END IF;
    UPDATE public.comunicados
    SET status = 'arquivado', publicar_em = NULL, updated_at = now()
    WHERE id = p_comunicado_id;
  ELSE
    IF v_comunicado.status <> 'agendado' THEN
      RAISE EXCEPTION 'transicao_invalida' USING ERRCODE = '22023';
    END IF;
    UPDATE public.comunicados
    SET status = 'rascunho', publicar_em = NULL, updated_at = now()
    WHERE id = p_comunicado_id;
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_set_comunicado_status(uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_set_comunicado_status(uuid, text, timestamptz) TO authenticated;

-- ---------------------------------------------------------------------------
-- Comunidades WhatsApp: registro por organização.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.portal_list_canais_externos()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid := private.current_organization_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF v_org IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', k.id,
      'nome', k.nome,
      'tipo', k.tipo,
      'link_convite', k.link_convite,
      'telefone_admin', k.telefone_admin,
      'ativo', k.ativo,
      'total_envios', (SELECT count(*) FROM public.canal_envios e WHERE e.canal_id = k.id),
      'pode_gerenciar', private.organization_role(k.organization_id) IN ('master', 'admin')
    ) ORDER BY k.ativo DESC, k.nome)
    FROM public.canais_externos k
    WHERE k.organization_id = v_org
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.portal_list_canais_externos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_list_canais_externos() TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_upsert_canal_externo(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid := private.current_organization_id();
  v_id uuid := NULLIF(p_payload->>'id', '')::uuid;
  v_nome text := btrim(coalesce(p_payload->>'nome', ''));
  v_tipo text := coalesce(p_payload->>'tipo', 'whatsapp_comunidade');
  v_link text := btrim(coalesce(p_payload->>'link_convite', ''));
  v_telefone text := btrim(coalesce(p_payload->>'telefone_admin', ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF v_org IS NULL THEN RAISE EXCEPTION 'municipal_membership_required' USING ERRCODE = '42501'; END IF;
  IF private.organization_role(v_org) NOT IN ('master', 'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF v_tipo <> 'whatsapp_comunidade' THEN RAISE EXCEPTION 'tipo_invalido' USING ERRCODE = '22023'; END IF;
  IF char_length(v_nome) NOT BETWEEN 3 AND 80 THEN RAISE EXCEPTION 'nome_invalido' USING ERRCODE = '22023'; END IF;
  IF char_length(v_link) > 0 AND v_link !~ '^https?://' THEN RAISE EXCEPTION 'link_invalido' USING ERRCODE = '22023'; END IF;
  IF char_length(v_telefone) > 0 AND v_telefone !~ '^\+?[0-9 ()-]{8,20}$' THEN RAISE EXCEPTION 'telefone_invalido' USING ERRCODE = '22023'; END IF;

  IF v_id IS NOT NULL THEN
    UPDATE public.canais_externos
    SET nome = v_nome, link_convite = nullif(v_link, ''), telefone_admin = nullif(v_telefone, ''), updated_at = now()
    WHERE id = v_id AND organization_id = v_org;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  ELSE
    INSERT INTO public.canais_externos (organization_id, nome, tipo, link_convite, telefone_admin, ativo)
    VALUES (v_org, v_nome, v_tipo, nullif(v_link, ''), nullif(v_telefone, ''), true)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_upsert_canal_externo(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_upsert_canal_externo(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_set_canal_ativo(p_canal_id uuid, p_ativo boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid := private.current_organization_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF v_org IS NULL THEN RAISE EXCEPTION 'municipal_membership_required' USING ERRCODE = '42501'; END IF;
  IF private.organization_role(v_org) NOT IN ('master', 'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  UPDATE public.canais_externos SET ativo = p_ativo, updated_at = now()
  WHERE id = p_canal_id AND organization_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_set_canal_ativo(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_set_canal_ativo(uuid, boolean) TO authenticated;

-- Exclusão só sem histórico de envio (auditoria preservada); senão, desativar.
CREATE OR REPLACE FUNCTION public.portal_delete_canal_externo(p_canal_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid := private.current_organization_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF v_org IS NULL THEN RAISE EXCEPTION 'municipal_membership_required' USING ERRCODE = '42501'; END IF;
  IF private.organization_role(v_org) NOT IN ('master', 'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  IF EXISTS (SELECT 1 FROM public.canal_envios WHERE canal_id = p_canal_id) THEN
    RAISE EXCEPTION 'canal_com_envios_desative' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.canais_externos WHERE id = p_canal_id AND organization_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_delete_canal_externo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_delete_canal_externo(uuid) TO authenticated;

-- Registro do disparo assistido: confirma a replicação manual na comunidade.
CREATE OR REPLACE FUNCTION public.portal_registrar_envio_canal(p_canal_id uuid, p_comunicado_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid := private.current_organization_id();
  v_comunicado public.comunicados;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF v_org IS NULL THEN RAISE EXCEPTION 'municipal_membership_required' USING ERRCODE = '42501'; END IF;
  IF private.organization_role(v_org) NOT IN ('master', 'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.canais_externos
    WHERE id = p_canal_id AND organization_id = v_org AND ativo
  ) THEN RAISE EXCEPTION 'canal_invalido' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_comunicado FROM public.comunicados
  WHERE id = p_comunicado_id AND organization_id = v_org;
  IF v_comunicado.id IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_comunicado.status NOT IN ('publicado', 'arquivado') THEN
    RAISE EXCEPTION 'nao_publicado' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.canal_envios (canal_id, comunicado_id, registrado_por, status)
  VALUES (p_canal_id, p_comunicado_id, auth.uid(), 'enviado')
  ON CONFLICT (canal_id, comunicado_id)
  DO UPDATE SET enviado_em = now(), registrado_por = EXCLUDED.registrado_por;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_registrar_envio_canal(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_registrar_envio_canal(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.portal_registrar_envio_canal(uuid, uuid) IS
  'Disparo assistido: confirma replicação manual do comunicado na comunidade WhatsApp, com auditoria de quem registrou e quando.';
