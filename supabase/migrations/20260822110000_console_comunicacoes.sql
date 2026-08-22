-- Console interno (/app): comunicação municipal para a equipe TCS (owner/developer).
-- A conta owner não recebe contexto de portal (isolation por design); esta é a
-- via dela para operar números do bot, comunidades e disparos de QUALQUER
-- prefeitura durante o piloto — mesmas tabelas, mesma auditoria.

-- Permissão interna nova: communication.manage (owner e developer).
CREATE OR REPLACE FUNCTION private.is_valid_internal_permission(p_permission text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_permission = ANY (ARRAY[
    'console.read', 'dashboard.executive.read', 'dashboard.technical.read',
    'customer.read', 'customer.sensitive.read', 'customer.sensitive.request', 'customer.write',
    'commercial.read', 'commercial.write', 'support.read', 'support.write',
    'session.read', 'session.terminate', 'staff.read', 'staff.manage', 'audit.read',
    'technical.read', 'technical.write', 'build.request', 'build.approve',
    'configuration.prepare', 'configuration.publish', 'protocol.read', 'protocol.rotate',
    'account.approve', 'account.lock', 'account.recover_invite',
    'token.manage', 'notification.manage', 'communication.manage'
  ]::text[]);
$$;

CREATE OR REPLACE FUNCTION private.internal_permissions(p_role text)
RETURNS text[]
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_role
    WHEN 'owner' THEN ARRAY[
      'console.read', 'dashboard.executive.read', 'customer.read', 'customer.sensitive.read',
      'customer.write', 'commercial.read', 'commercial.write', 'support.read', 'support.write',
      'session.read', 'session.terminate', 'staff.read', 'staff.manage', 'audit.read',
      'technical.read', 'technical.write', 'build.request', 'build.approve', 'configuration.publish',
      'protocol.read', 'protocol.rotate',
      'account.approve', 'account.lock', 'account.recover_invite',
      'token.manage', 'notification.manage', 'communication.manage'
    ]::text[]
    WHEN 'developer' THEN ARRAY[
      'console.read', 'dashboard.technical.read', 'customer.read', 'customer.sensitive.request',
      'commercial.read', 'commercial.write', 'support.read', 'support.write', 'session.read', 'session.terminate',
      'audit.read', 'technical.read', 'technical.write', 'build.request', 'configuration.prepare',
      'protocol.read', 'protocol.rotate', 'token.manage', 'notification.manage', 'communication.manage'
    ]::text[]
    WHEN 'support' THEN ARRAY[
      'console.read', 'customer.read', 'commercial.read', 'support.read', 'support.write', 'protocol.read',
      'account.approve', 'account.recover_invite'
    ]::text[]
    WHEN 'auditor' THEN ARRAY['console.read', 'customer.read', 'commercial.read', 'audit.read', 'protocol.read']::text[]
    ELSE ARRAY[]::text[] END;
$$;

-- ---------------------------------------------------------------------------
-- Leitura: organizações com resumo, e detalhe por organização.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.internal_list_orgs_comunicados()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT private.has_internal_permission('communication.manage') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'organization_id', o.id,
      'organization_name', o.display_name,
      'municipality', o.municipality_name,
      'comunicados_publicados', (SELECT count(*) FROM public.comunicados c WHERE c.organization_id = o.id AND c.status = 'publicado'),
      'comunidades_ativas', (SELECT count(*) FROM public.canais_externos k WHERE k.organization_id = o.id AND k.ativo),
      'numeros_vinculados', (SELECT count(*) FROM public.bot_sessoes s WHERE s.organization_id = o.id AND s.status = 'vinculado'),
      'envios_pendentes', (SELECT count(*) FROM public.canal_envios e
        JOIN public.canais_externos k2 ON k2.id = e.canal_id
        WHERE k2.organization_id = o.id AND e.status = 'pendente'),
      'envios_falhas', (SELECT count(*) FROM public.canal_envios e
        JOIN public.canais_externos k3 ON k3.id = e.canal_id
        WHERE k3.organization_id = o.id AND e.status = 'falhou')
    ) ORDER BY o.display_name)
    FROM public.organizations o
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.internal_list_orgs_comunicados() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_list_orgs_comunicados() TO authenticated;

CREATE OR REPLACE FUNCTION public.internal_comunicados_org(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org public.organizations;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT private.has_internal_permission('communication.manage') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_org FROM public.organizations WHERE id = p_organization_id;
  IF v_org.id IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;

  RETURN jsonb_build_object(
    'organization', jsonb_build_object(
      'id', v_org.id, 'name', v_org.display_name, 'municipality', v_org.municipality_name
    ),
    'sessoes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'telefone', s.telefone, 'status', s.status,
        'vinculado_por_nome', u.name, 'vinculado_em', s.vinculado_em, 'atualizado_em', s.atualizado_em,
        'total_chats', (SELECT count(*) FROM public.bot_chats c WHERE c.sessao_id = s.id)
      ) ORDER BY s.status, s.criado_em DESC)
      FROM public.bot_sessoes s
      LEFT JOIN public.users u ON u.uid = s.vinculado_por
      WHERE s.organization_id = p_organization_id
    ), '[]'::jsonb),
    'chats', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'chat_id', c.chat_id, 'nome', c.nome, 'tipo', c.tipo,
        'sessao_telefone', s.telefone, 'visto_em', max(c.visto_em)
      ) ORDER BY c.nome)
      FROM public.bot_chats c
      JOIN public.bot_sessoes s ON s.id = c.sessao_id
      WHERE s.organization_id = p_organization_id AND s.status <> 'banido'
      GROUP BY c.chat_id, c.nome, c.tipo
    ), '[]'::jsonb),
    'canais', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', k.id, 'nome', k.nome, 'chat_id', k.chat_id, 'ativo', k.ativo,
        'total_envios', (SELECT count(*) FROM public.canal_envios e WHERE e.canal_id = k.id)
      ) ORDER BY k.ativo DESC, k.nome)
      FROM public.canais_externos k
      WHERE k.organization_id = p_organization_id
    ), '[]'::jsonb),
    'comunicados', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'titulo', c.titulo, 'severidade', c.severidade, 'status', c.status,
        'publicado_em', c.publicado_em, 'publicar_em', c.publicar_em, 'expira_em', c.expira_em,
        'criado_em', c.created_at,
        'envios', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'canal_id', e.canal_id, 'canal_nome', k2.nome, 'status', e.status, 'origem', e.origem,
            'erro', e.erro, 'enviado_em', e.enviado_em, 'tentativas', e.tentativas
          ) ORDER BY e.created_at DESC)
          FROM public.canal_envios e
          JOIN public.canais_externos k2 ON k2.id = e.canal_id
          WHERE e.comunicado_id = c.id
        ), '[]'::jsonb)
      ) ORDER BY CASE c.status WHEN 'publicado' THEN 0 WHEN 'agendado' THEN 1 WHEN 'rascunho' THEN 2 ELSE 3 END,
                 COALESCE(c.publicado_em, c.publicar_em, c.created_at) DESC)
      FROM public.comunicados c
      WHERE c.organization_id = p_organization_id
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.internal_comunicados_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_comunicados_org(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Ações internas: sessões, comunidades, vínculo de chat e disparo.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.internal_criar_sessao_bot(p_organization_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT private.has_internal_permission('communication.manage') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
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
REVOKE ALL ON FUNCTION public.internal_criar_sessao_bot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_criar_sessao_bot(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.internal_definir_status_sessao_bot(p_sessao_id uuid, p_status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT private.has_internal_permission('communication.manage') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('banido', 'desconectado') THEN RAISE EXCEPTION 'status_invalido' USING ERRCODE = '22023'; END IF;

  UPDATE public.bot_sessoes SET status = p_status, atualizado_em = now()
  WHERE id = p_sessao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.internal_definir_status_sessao_bot(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_definir_status_sessao_bot(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.internal_upsert_canal_externo(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid := NULLIF(p_payload->>'organization_id', '')::uuid;
  v_id uuid := NULLIF(p_payload->>'id', '')::uuid;
  v_nome text := btrim(coalesce(p_payload->>'nome', ''));
  v_link text := btrim(coalesce(p_payload->>'link_convite', ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT private.has_internal_permission('communication.manage') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF v_org IS NULL THEN RAISE EXCEPTION 'organizacao_obrigatoria' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF char_length(v_nome) NOT BETWEEN 3 AND 80 THEN RAISE EXCEPTION 'nome_invalido' USING ERRCODE = '22023'; END IF;
  IF char_length(v_link) > 0 AND v_link !~ '^https?://' THEN RAISE EXCEPTION 'link_invalido' USING ERRCODE = '22023'; END IF;

  IF v_id IS NOT NULL THEN
    UPDATE public.canais_externos
    SET nome = v_nome, link_convite = nullif(v_link, ''), updated_at = now()
    WHERE id = v_id AND organization_id = v_org;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  ELSE
    INSERT INTO public.canais_externos (organization_id, nome, tipo, link_convite, ativo)
    VALUES (v_org, v_nome, 'whatsapp_comunidade', nullif(v_link, ''), true)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.internal_upsert_canal_externo(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_upsert_canal_externo(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.internal_vincular_canal_chat(p_canal_id uuid, p_chat_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_canal public.canais_externos;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT private.has_internal_permission('communication.manage') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_canal FROM public.canais_externos WHERE id = p_canal_id;
  IF v_canal.id IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;

  IF p_chat_id IS NULL OR p_chat_id = '' THEN
    UPDATE public.canais_externos SET chat_id = NULL, updated_at = now() WHERE id = p_canal_id;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.bot_chats c
      JOIN public.bot_sessoes s ON s.id = c.sessao_id
      WHERE c.chat_id = p_chat_id AND s.organization_id = v_canal.organization_id AND s.status <> 'banido'
    ) THEN
      RAISE EXCEPTION 'chat_invalido' USING ERRCODE = '22023';
    END IF;
    UPDATE public.canais_externos SET chat_id = p_chat_id, updated_at = now() WHERE id = p_canal_id;
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.internal_vincular_canal_chat(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_vincular_canal_chat(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.internal_disparar_envio_bot(
  p_comunicado_id uuid,
  p_canal_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_comunicado public.comunicados;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT private.has_internal_permission('communication.manage') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_comunicado FROM public.comunicados WHERE id = p_comunicado_id;
  IF v_comunicado.id IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_comunicado.status NOT IN ('publicado', 'arquivado') THEN
    RAISE EXCEPTION 'nao_publicado' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.canal_envios (canal_id, comunicado_id, registrado_por, status, origem)
  SELECT k.id, p_comunicado_id, auth.uid(), 'pendente', 'bot'
  FROM public.canais_externos k
  WHERE k.organization_id = v_comunicado.organization_id
    AND k.ativo AND k.chat_id IS NOT NULL
    AND (p_canal_id IS NULL OR k.id = p_canal_id)
  ON CONFLICT (canal_id, comunicado_id) DO UPDATE
    SET status = 'pendente', origem = 'bot', erro = NULL,
        registrado_por = EXCLUDED.registrado_por, bot_atualizado_em = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.internal_disparar_envio_bot(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_disparar_envio_bot(uuid, uuid) TO authenticated;
