-- Comunicados municipais — modelo v1.
-- Comunicado é emitido por uma organização (prefeitura) para o seu município,
-- com destino por bairro (catálogo da própria organização) ou todo o município.
-- Escopo v1: membros da organização (portal municipal + app de campo).
-- Entrega a moradores (contas individuais) e canais externos (WhatsApp) ficam
-- para fases posteriores; a tabela canais_externos já existe para registrá-los.
--
-- Princípios (série backend_authoritative):
-- - O banco é a fronteira de autorização: tabelas fail-closed (REVOKE de
--   anon/authenticated) e todo acesso por RPC SECURITY DEFINER que valida o
--   papel via private.current_organization_id()/organization_role().
-- - Isolamento por organização: admin municipal nunca lê comunicado de outra.
-- - Auditoria: autor, datas, destino, status e leituras registrados.

CREATE TABLE IF NOT EXISTS public.bairros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bairros_nome_len CHECK (char_length(btrim(nome)) BETWEEN 2 AND 80)
);
CREATE UNIQUE INDEX IF NOT EXISTS bairros_org_nome_key
  ON public.bairros (organization_id, lower(btrim(nome)));
CREATE INDEX IF NOT EXISTS bairros_org_idx ON public.bairros (organization_id, ativo);

CREATE TABLE IF NOT EXISTS public.comunicados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  conteudo text NOT NULL,
  severidade text NOT NULL DEFAULT 'informacao',
  status text NOT NULL DEFAULT 'rascunho',
  autor_uid uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  publicado_em timestamptz,
  expira_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comunicados_status_valid CHECK (status IN ('rascunho', 'publicado', 'arquivado')),
  CONSTRAINT comunicados_severidade_valid CHECK (severidade IN ('informacao', 'alerta', 'emergencia')),
  CONSTRAINT comunicados_titulo_len CHECK (char_length(btrim(titulo)) BETWEEN 3 AND 120),
  CONSTRAINT comunicados_conteudo_len CHECK (char_length(conteudo) BETWEEN 1 AND 5000),
  CONSTRAINT comunicados_publicacao_coerente CHECK (publicado_em IS NULL OR status <> 'rascunho')
);
CREATE INDEX IF NOT EXISTS comunicados_org_status_idx
  ON public.comunicados (organization_id, status, COALESCE(publicado_em, created_at) DESC);

CREATE TABLE IF NOT EXISTS public.comunicado_destinos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comunicado_id uuid NOT NULL REFERENCES public.comunicados(id) ON DELETE CASCADE,
  bairro_id uuid REFERENCES public.bairros(id) ON DELETE RESTRICT,
  todo_municipio boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comunicado_destinos_escopo CHECK (todo_municipio OR bairro_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS comunicado_destinos_bairro_key
  ON public.comunicado_destinos (comunicado_id, bairro_id) WHERE bairro_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS comunicado_destinos_todos_key
  ON public.comunicado_destinos (comunicado_id) WHERE todo_municipio;
CREATE INDEX IF NOT EXISTS comunicado_destinos_comunicado_idx
  ON public.comunicado_destinos (comunicado_id);

CREATE TABLE IF NOT EXISTS public.comunicado_leituras (
  comunicado_id uuid NOT NULL REFERENCES public.comunicados(id) ON DELETE CASCADE,
  leitor_uid uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lido_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comunicado_id, leitor_uid)
);
CREATE INDEX IF NOT EXISTS comunicado_leituras_comunicado_idx
  ON public.comunicado_leituras (comunicado_id);

CREATE TABLE IF NOT EXISTS public.canais_externos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT canais_externos_tipo_valid CHECK (tipo IN ('whatsapp_comunidade'))
);
CREATE INDEX IF NOT EXISTS canais_externos_org_idx ON public.canais_externos (organization_id, ativo);

-- Fail-closed: acesso exclusivo por RPCs SECURITY DEFINER. As policies SELECT
-- abaixo são defesa em profundidade caso grants sejam reintroduzidos.
ALTER TABLE public.bairros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunicado_destinos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunicado_leituras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canais_externos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.bairros, public.comunicados, public.comunicado_destinos,
  public.comunicado_leituras, public.canais_externos FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS bairros_portal_select ON public.bairros;
CREATE POLICY bairros_portal_select ON public.bairros FOR SELECT TO authenticated
USING (
  (SELECT private.is_owner_admin())
  OR organization_id = (SELECT private.current_organization_id())
);

DROP POLICY IF EXISTS comunicados_portal_select ON public.comunicados;
CREATE POLICY comunicados_portal_select ON public.comunicados FOR SELECT TO authenticated
USING (
  (SELECT private.is_owner_admin())
  OR (
    organization_id = (SELECT private.current_organization_id())
    AND (
      status <> 'rascunho'
      OR (SELECT private.organization_role(organization_id)) IN ('master', 'admin')
    )
  )
);

DROP POLICY IF EXISTS comunicado_destinos_portal_select ON public.comunicado_destinos;
CREATE POLICY comunicado_destinos_portal_select ON public.comunicado_destinos FOR SELECT TO authenticated
USING (
  (SELECT private.is_owner_admin())
  OR EXISTS (
    SELECT 1 FROM public.comunicados c
    WHERE c.id = comunicado_destinos.comunicado_id
      AND c.organization_id = (SELECT private.current_organization_id())
      AND (
        c.status <> 'rascunho'
        OR (SELECT private.organization_role(c.organization_id)) IN ('master', 'admin')
      )
  )
);

DROP POLICY IF EXISTS comunicado_leituras_portal_select ON public.comunicado_leituras;
CREATE POLICY comunicado_leituras_portal_select ON public.comunicado_leituras FOR SELECT TO authenticated
USING (
  (SELECT private.is_owner_admin())
  OR leitor_uid = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.comunicados c
    WHERE c.id = comunicado_leituras.comunicado_id
      AND c.organization_id = (SELECT private.current_organization_id())
      AND (SELECT private.organization_role(c.organization_id)) IN ('master', 'admin')
  )
);

DROP POLICY IF EXISTS canais_externos_portal_select ON public.canais_externos;
CREATE POLICY canais_externos_portal_select ON public.canais_externos FOR SELECT TO authenticated
USING (
  (SELECT private.is_owner_admin())
  OR (
    organization_id = (SELECT private.current_organization_id())
    AND (SELECT private.organization_role(organization_id)) IN ('master', 'admin')
  )
);

-- ---------------------------------------------------------------------------
-- RPCs do portal — única via de leitura/escrita dos comunicados.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.portal_list_comunicados()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
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
        'pode_editar', v_role IN ('master', 'admin')
      )
      ORDER BY CASE c.status WHEN 'publicado' THEN 0 WHEN 'rascunho' THEN 1 ELSE 2 END,
               COALESCE(c.publicado_em, c.created_at) DESC
    )
    FROM public.comunicados c
    LEFT JOIN public.users u ON u.uid = c.autor_uid
    WHERE c.organization_id = v_org
      AND (c.status <> 'rascunho' OR v_role IN ('master', 'admin'))
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.portal_list_comunicados() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_list_comunicados() TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_list_bairros()
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
      'id', b.id,
      'nome', b.nome,
      'ativo', b.ativo,
      'em_uso', EXISTS (
        SELECT 1 FROM public.comunicado_destinos d
        WHERE d.bairro_id = b.id
      ),
      'pode_gerenciar', private.organization_role(b.organization_id) IN ('master', 'admin')
    ) ORDER BY b.nome)
    FROM public.bairros b
    WHERE b.organization_id = v_org
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.portal_list_bairros() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_list_bairros() TO authenticated;

-- Cria (p_id NULL) ou atualiza um rascunho. Publicação é transição explícita
-- via portal_set_comunicado_status. Destinos ausentes => todo o município.
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
    IF v_comunicado.status <> 'rascunho' THEN
      RAISE EXCEPTION 'somente_rascunho_editavel' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.comunicados (organization_id, titulo, conteudo, severidade, autor_uid, expira_em)
    VALUES (v_org, v_titulo, v_conteudo, v_severidade, auth.uid(), v_expira)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.comunicados
    SET titulo = v_titulo, conteudo = v_conteudo, severidade = v_severidade,
        expira_em = v_expira, updated_at = now()
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

CREATE OR REPLACE FUNCTION public.portal_set_comunicado_status(p_comunicado_id uuid, p_status text)
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
  IF p_status NOT IN ('publicado', 'arquivado') THEN RAISE EXCEPTION 'status_invalido' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_comunicado FROM public.comunicados
  WHERE id = p_comunicado_id AND organization_id = v_org;
  IF v_comunicado.id IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_comunicado.status = p_status THEN RETURN true; END IF;
  IF v_comunicado.status = 'rascunho' AND p_status <> 'publicado' THEN
    RAISE EXCEPTION 'transicao_invalida' USING ERRCODE = '22023';
  END IF;

  UPDATE public.comunicados
  SET status = p_status,
      publicado_em = CASE WHEN p_status = 'publicado' THEN now() ELSE publicado_em END,
      updated_at = now()
  WHERE id = p_comunicado_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_set_comunicado_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_set_comunicado_status(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_delete_comunicado(p_comunicado_id uuid)
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

  DELETE FROM public.comunicados
  WHERE id = p_comunicado_id AND organization_id = v_org AND status = 'rascunho';
  IF NOT FOUND THEN RAISE EXCEPTION 'somente_rascunho_exclusivel' USING ERRCODE = '22023'; END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_delete_comunicado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_delete_comunicado(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_register_comunicado_leitura(p_comunicado_id uuid)
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

  SELECT * INTO v_comunicado FROM public.comunicados
  WHERE id = p_comunicado_id AND organization_id = v_org;
  IF v_comunicado.id IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_comunicado.status <> 'publicado' THEN RAISE EXCEPTION 'nao_publicado' USING ERRCODE = '22023'; END IF;
  IF v_comunicado.expira_em IS NOT NULL AND v_comunicado.expira_em <= now() THEN
    RAISE EXCEPTION 'expirado' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.comunicado_leituras (comunicado_id, leitor_uid)
  VALUES (p_comunicado_id, auth.uid())
  ON CONFLICT (comunicado_id, leitor_uid) DO NOTHING;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_register_comunicado_leitura(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_register_comunicado_leitura(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_upsert_bairro(p_nome text, p_bairro_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid := private.current_organization_id();
  v_nome text := btrim(coalesce(p_nome, ''));
  v_id uuid := p_bairro_id;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF v_org IS NULL THEN RAISE EXCEPTION 'municipal_membership_required' USING ERRCODE = '42501'; END IF;
  IF private.organization_role(v_org) NOT IN ('master', 'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF char_length(v_nome) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'nome_invalido' USING ERRCODE = '22023'; END IF;

  IF v_id IS NOT NULL THEN
    UPDATE public.bairros SET nome = v_nome, updated_at = now()
    WHERE id = v_id AND organization_id = v_org;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  ELSE
    INSERT INTO public.bairros (organization_id, nome) VALUES (v_org, v_nome)
    ON CONFLICT (organization_id, lower(btrim(nome))) DO UPDATE
      SET nome = excluded.nome, ativo = true, updated_at = now()
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_upsert_bairro(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_upsert_bairro(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_delete_bairro(p_bairro_id uuid)
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

  IF EXISTS (SELECT 1 FROM public.comunicado_destinos WHERE bairro_id = p_bairro_id) THEN
    RAISE EXCEPTION 'bairro_em_uso' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.bairros WHERE id = p_bairro_id AND organization_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_delete_bairro(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_delete_bairro(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Permissões do portal: communication.read/write.
-- Escrita restrita a master/admin municipal; leitura para toda a equipe.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_portal_access_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_profile public.users;
  v_member public.organization_members;
  v_org public.organizations;
  v_subscription public.subscriptions;
  v_plan public.plans;
  v_version public.plan_versions;
  v_permissions text[];
  v_features jsonb := '{}'::jsonb;
  v_limits jsonb := '{}'::jsonb;
  v_usage jsonb := '{}'::jsonb;
  v_creation_allowed boolean := false;
  v_restriction text;
  v_invite_permissions jsonb := jsonb_build_object(
    'can_invite', false,
    'target_roles', '[]'::jsonb
  );
  v_target_roles text[];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;

  -- Dono interno TCS é papel distinto: nunca recebe contexto de portal de cliente.
  IF EXISTS (
    SELECT 1 FROM public.internal_staff
    WHERE user_id = v_user AND status = 'active'
  ) THEN RETURN NULL; END IF;

  SELECT * INTO v_profile FROM public.users WHERE uid = v_user;
  IF v_profile.uid IS NULL OR NOT coalesce(v_profile."isApproved", false) THEN RETURN NULL; END IF;

  -- Afiliação municipal ativa é o caminho de autorização; invited/suspended
  -- aparecem apenas para expor o status no contrato, sem autorizar criação.
  SELECT * INTO v_member FROM public.organization_members
  WHERE user_id = v_user AND status IN ('active', 'invited', 'suspended')
  ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'invited' THEN 1 ELSE 2 END
  LIMIT 1;

  IF v_member.id IS NOT NULL THEN
    SELECT * INTO v_org FROM public.organizations WHERE id = v_member.organization_id;
    -- Assinatura atual da organização: ranking preserva histórico, não apaga nada.
    SELECT * INTO v_subscription FROM public.subscriptions
    WHERE organization_id = v_member.organization_id
    ORDER BY CASE status
        WHEN 'active' THEN 0 WHEN 'trial' THEN 1 WHEN 'grace' THEN 2
        WHEN 'past_due' THEN 3 ELSE 4
      END, created_at DESC
    LIMIT 1;
  ELSE
    -- Conta individual: a assinatura corrente do próprio usuário.
    SELECT * INTO v_subscription FROM public.subscriptions
    WHERE user_id = v_user
    ORDER BY CASE status
        WHEN 'active' THEN 0 WHEN 'trial' THEN 1 WHEN 'grace' THEN 2
        WHEN 'past_due' THEN 3 ELSE 4
      END, created_at DESC
    LIMIT 1;
  END IF;

  IF v_subscription.id IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.plans WHERE id = v_subscription.plan_id;
    -- Resolve a plan_version publicada: preferencia da subscription, senão a
    -- versão current_version do plano (compatibilidade com deployments legados).
    SELECT * INTO v_version FROM public.plan_versions
    WHERE id = coalesce(v_subscription.plan_version_id, (
      SELECT id FROM public.plan_versions
      WHERE plan_id = v_plan.id
      ORDER BY published_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    ));
    IF v_version.id IS NULL AND v_plan.id IS NOT NULL THEN
      SELECT * INTO v_version FROM public.plan_versions
      WHERE plan_id = v_plan.id AND version = v_plan.current_version;
    END IF;

    SELECT coalesce(jsonb_object_agg(feature_code, enabled), '{}'::jsonb) INTO v_features
    FROM public.plan_version_features WHERE plan_version_id = v_version.id;
    IF v_features = '{}'::jsonb AND v_plan.id IS NOT NULL THEN
      SELECT coalesce(jsonb_object_agg(feature_code, enabled), '{}'::jsonb) INTO v_features
      FROM public.plan_features WHERE plan_id = v_plan.id;
    END IF;

    SELECT coalesce(jsonb_object_agg(resource_code, hard_limit), '{}'::jsonb) INTO v_limits
    FROM public.plan_version_limits WHERE plan_version_id = v_version.id;
    IF v_limits = '{}'::jsonb AND v_plan.id IS NOT NULL THEN
      SELECT coalesce(jsonb_object_agg(resource_code, hard_limit), '{}'::jsonb) INTO v_limits
      FROM public.plan_limits WHERE plan_id = v_plan.id;
    END IF;

    SELECT coalesce(jsonb_object_agg(resource_code, consumed), '{}'::jsonb) INTO v_usage
    FROM public.usage_counters
    WHERE period_start = v_subscription.current_period_start
      AND (
        (v_member.id IS NULL AND user_id = v_user)
        OR (v_member.id IS NOT NULL AND organization_id = v_member.organization_id)
      );
  END IF;

  -- Permissões efetivas derivadas do servidor, nunca do metadata do cliente.
  -- communication.*: leitura de comunicados para toda a equipe municipal;
  -- escrita restrita a master/admin (espelha as RPCs portal_*_comunicado).
  IF v_member.id IS NULL THEN
    v_permissions := ARRAY[
      'dashboard.read','inspection.read','inspection.create','map.read',
      'appointment.read','document.read','report.read','usage.read',
      'billing.read','billing.manage','support.read','support.create',
      'profile.read','profile.manage'
    ];
  ELSIF v_member.role = 'master' THEN
    v_permissions := ARRAY[
      'dashboard.read','inspection.read','inspection.create','map.read',
      'appointment.read','document.read','report.read','team.read','team.manage',
      'invite.agent','invite.manage','usage.read','billing.read','billing.manage',
      'support.read','support.create','settings.read','settings.manage',
      'profile.read','profile.manage','communication.read','communication.write'
    ];
  ELSIF v_member.role = 'admin' THEN
    v_permissions := ARRAY[
      'dashboard.read','inspection.read','inspection.create','map.read',
      'appointment.read','document.read','report.read','team.read','team.manage',
      'invite.agent','invite.manage','usage.read','billing.read',
      'support.read','support.create','profile.read','profile.manage',
      'communication.read','communication.write'
    ];
  ELSIF v_member.role = 'supervisor' THEN
    v_permissions := ARRAY[
      'dashboard.read','inspection.read','inspection.create','map.read',
      'appointment.read','document.read','report.read','team.read',
      'invite.agent','usage.read','support.read','support.create',
      'profile.read','profile.manage','communication.read'
    ];
  ELSE
    v_permissions := ARRAY[
      'dashboard.read','inspection.read','inspection.create','map.read',
      'appointment.read','document.read','report.read',
      'support.read','support.create','profile.read','profile.manage',
      'communication.read'
    ];
  END IF;

  -- Permissões efetivas de convite espelham private.portal_invite_role_allowed,
  -- mas são derivadas aqui para o contrato tipado sem depender de chamada cruzada.
  IF v_member.id IS NOT NULL AND v_member.status = 'active' THEN
    IF v_member.role = 'master' THEN
      v_target_roles := ARRAY['admin', 'supervisor', 'agent'];
      v_invite_permissions := jsonb_build_object('can_invite', true, 'target_roles', to_jsonb(v_target_roles));
    ELSIF v_member.role = 'admin' THEN
      v_target_roles := ARRAY['supervisor', 'agent'];
      v_invite_permissions := jsonb_build_object('can_invite', true, 'target_roles', to_jsonb(v_target_roles));
    ELSIF v_member.role = 'supervisor' THEN
      v_target_roles := ARRAY['agent'];
      v_invite_permissions := jsonb_build_object('can_invite', true, 'target_roles', to_jsonb(v_target_roles));
    ELSE
      v_invite_permissions := jsonb_build_object('can_invite', false, 'target_roles', '[]'::jsonb);
    END IF;
  END IF;

  -- trial, active e grace permitem criação. membership_inactive tem precedência.
  v_creation_allowed := (v_member.id IS NULL OR v_member.status = 'active')
    AND coalesce(v_subscription.status IN ('trial', 'active', 'grace'), false);

  IF v_member.id IS NOT NULL AND v_member.status <> 'active' THEN
    v_restriction := 'membership_inactive';
  ELSIF v_subscription.id IS NULL OR v_subscription.status IN ('canceled', 'expired', 'none') THEN
    v_restriction := 'subscription_inactive';
  ELSIF v_subscription.status = 'past_due' THEN
    v_restriction := 'subscription_past_due';
  END IF;

  RETURN jsonb_build_object(
    'account_kind', CASE WHEN v_member.id IS NULL THEN 'individual' ELSE 'organization' END,
    'user_id', v_user,
    'display_name', coalesce(nullif(trim(v_profile.name), ''), v_profile.email, 'Cliente TCS'),
    'organization_id', v_member.organization_id,
    'organization_name', v_org.display_name,
    'role', v_member.role,
    'membership_status', v_member.status,
    'subscription_status', coalesce(v_subscription.status, 'none'),
    'cancel_at_period_end', coalesce(v_subscription.cancel_at_period_end, false),
    'plan_id', v_plan.id,
    'plan_version_id', v_version.id,
    'plan_name', v_plan.name,
    'features', v_features,
    'limits', v_limits,
    'usage', v_usage,
    'period_start', v_subscription.current_period_start,
    'period_end', v_subscription.current_period_end,
    'permissions', to_jsonb(v_permissions),
    'invite_permissions', v_invite_permissions,
    'creation_allowed', v_creation_allowed,
    'restriction_cause', v_restriction
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_portal_access_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_portal_access_context() TO authenticated;

COMMENT ON FUNCTION public.portal_list_comunicados() IS
  'Comunicados municipais v1: lista comunicados da organização do usuário (rascunhos visíveis apenas para master/admin), com destinos, leituras e flags de leitura/permissão. Contas sem vínculo municipal recebem lista vazia.';
COMMENT ON FUNCTION public.portal_upsert_comunicado(jsonb) IS
  'Cria/atualiza rascunho de comunicado (master/admin municipal). Destinos: array de {bairro_id} ou {todo_municipio:true}; sem destinos => todo o município.';
