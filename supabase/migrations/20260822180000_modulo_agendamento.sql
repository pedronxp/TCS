-- Módulo de comunicados como produto: ativo por plano/pagamento para o
-- município (features do catálogo de planos), TCS staff sempre liberado, e
-- publicação de agendados vencida de forma robusta (o bot publica em ciclo).
--
-- Regra do módulo (private.organization_comunicados_ativo):
-- - Sem assinatura/versão de plano com catálogo de features → ATIVO (piloto
--   legado continua funcionando);
-- - Com catálogo → ativo somente se a feature 'comunicados' estiver habilitada
--   na versão do plano corrente (dinâmico por pagamento/ativação).

CREATE OR REPLACE FUNCTION private.organization_comunicados_ativo(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH assinatura AS (
    SELECT s.plan_id, s.plan_version_id
    FROM public.subscriptions s
    WHERE s.organization_id = p_organization_id
    ORDER BY CASE s.status
        WHEN 'active' THEN 0 WHEN 'trial' THEN 1 WHEN 'grace' THEN 2
        WHEN 'past_due' THEN 3 ELSE 4 END, s.created_at DESC
    LIMIT 1
  ), versao AS (
    SELECT pv.id
    FROM assinatura a
    JOIN public.plans p ON p.id = a.plan_id
    LEFT JOIN public.plan_versions pv ON pv.id = a.plan_version_id
    WHERE true
    UNION ALL
    SELECT pv2.id
    FROM assinatura a
    JOIN public.plans p2 ON p2.id = a.plan_id
    CROSS JOIN LATERAL (
      SELECT pv3.id FROM public.plan_versions pv3
      WHERE pv3.plan_id = p2.id
      ORDER BY pv3.published_at DESC NULLS LAST, pv3.created_at DESC
      LIMIT 1
    ) pv2
    WHERE a.plan_version_id IS NULL
    LIMIT 1
  )
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM assinatura) THEN true
    WHEN NOT EXISTS (
      SELECT 1 FROM public.plan_version_features pvf
      WHERE pvf.plan_version_id IN (SELECT id FROM versao)
    ) THEN true
    ELSE COALESCE((
      SELECT pvf.enabled
      FROM public.plan_version_features pvf
      WHERE pvf.plan_version_id IN (SELECT id FROM versao)
        AND pvf.feature_code = 'comunicados'
      LIMIT 1
    ), false)
  END;
$$;
REVOKE ALL ON FUNCTION private.organization_comunicados_ativo(uuid) FROM PUBLIC, anon;

-- Gate nas AÇÕES municipais do módulo (leitura permanece; criação, números e
-- disparo exigem módulo ativo). Console interno (TCS) não passa pelo gate.

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
  IF NOT private.organization_comunicados_ativo(v_org) THEN
    RAISE EXCEPTION 'modulo_nao_ativo' USING ERRCODE = '42501';
  END IF;
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
  IF NOT private.organization_comunicados_ativo(v_org) THEN
    RAISE EXCEPTION 'modulo_nao_ativo' USING ERRCODE = '42501';
  END IF;
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

CREATE OR REPLACE FUNCTION public.portal_disparar_envio_bot(
  p_comunicado_id uuid,
  p_canal_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid := private.current_organization_id();
  v_role text;
  v_comunicado public.comunicados;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF v_org IS NULL THEN RAISE EXCEPTION 'municipal_membership_required' USING ERRCODE = '42501'; END IF;
  IF NOT private.organization_comunicados_ativo(v_org) THEN
    RAISE EXCEPTION 'modulo_nao_ativo' USING ERRCODE = '42501';
  END IF;
  v_role := private.organization_role(v_org);
  IF v_role NOT IN ('master', 'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_comunicado FROM public.comunicados
  WHERE id = p_comunicado_id AND organization_id = v_org;
  IF v_comunicado.id IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_comunicado.status NOT IN ('publicado', 'arquivado') THEN
    RAISE EXCEPTION 'nao_publicado' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.canal_envios (canal_id, comunicado_id, registrado_por, status, origem)
  SELECT k.id, p_comunicado_id, auth.uid(), 'pendente', 'bot'
  FROM public.canais_externos k
  WHERE k.organization_id = v_org
    AND k.ativo
    AND k.chat_id IS NOT NULL
    AND (p_canal_id IS NULL OR k.id = p_canal_id)
  ON CONFLICT (canal_id, comunicado_id) DO UPDATE
    SET status = 'pendente', origem = 'bot', erro = NULL,
        registrado_por = EXCLUDED.registrado_por, bot_atualizado_em = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_disparar_envio_bot(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_disparar_envio_bot(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Agendamento robusto: console também promove vencidos e o bot (service_role)
-- publica em ciclo mesmo sem ninguém com a tela aberta.
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.portal_publish_due_comunicados() TO service_role;

CREATE OR REPLACE FUNCTION public.internal_comunicados_org(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
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

  PERFORM public.portal_publish_due_comunicados();

  RETURN jsonb_build_object(
    'organization', jsonb_build_object(
      'id', v_org.id, 'name', v_org.display_name, 'municipality', v_org.municipality_name
    ),
    'sessoes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'telefone', public.mascarar_telefone(s.telefone), 'status', s.status,
        'vinculado_por_nome', u.name, 'vinculado_em', s.vinculado_em, 'atualizado_em', s.atualizado_em,
        'total_chats', (SELECT count(*) FROM public.bot_chats c WHERE c.sessao_id = s.id)
      ) ORDER BY s.status, s.criado_em DESC)
      FROM public.bot_sessoes s
      LEFT JOIN public.users u ON u.uid = s.vinculado_por
      WHERE s.organization_id = p_organization_id
    ), '[]'::jsonb),
    'chats', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
          'chat_id', g.chat_id, 'nome', g.nome, 'tipo', g.tipo,
          'sessao_telefone', public.mascarar_telefone(g.telefone), 'visto_em', g.visto_em,
          'total_admins', g.total_admins, 'total_participantes', g.total_participantes
        ) ORDER BY g.nome)
      FROM (
        SELECT c.chat_id, c.nome, c.tipo,
               max(s.telefone) AS telefone,
               max(c.visto_em) AS visto_em,
               max(c.total_admins) AS total_admins,
               max(c.total_participantes) AS total_participantes
        FROM public.bot_chats c
        JOIN public.bot_sessoes s ON s.id = c.sessao_id
        WHERE s.organization_id = p_organization_id AND s.status <> 'banido'
        GROUP BY c.chat_id, c.nome, c.tipo
      ) g
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
            'erro', e.erro, 'enviado_em', e.enviado_em,
            'tentativas', CASE WHEN e.tentativas IS NULL THEN NULL ELSE (
              SELECT jsonb_agg(jsonb_build_object(
                'telefone', public.mascarar_telefone(t->>'telefone'),
                'erro', t->>'erro'
              ))
              FROM jsonb_array_elements(e.tentativas) t
            ) END,
            'sessao_telefone', public.mascarar_telefone(s2.telefone)
          ) ORDER BY e.created_at DESC)
          FROM public.canal_envios e
          JOIN public.canais_externos k2 ON k2.id = e.canal_id
          LEFT JOIN public.bot_sessoes s2 ON s2.id = e.sessao_id
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
