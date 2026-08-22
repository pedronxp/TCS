-- Correção: agregados (max) não podem ficar aninhados dentro de jsonb_agg ->
-- jsonb_build_object ("aggregate function calls cannot be nested"). Os chats
-- agregados por (sessao, chat) passam por subselect antes do jsonb_agg.
-- Sem isso, internal_comunicados_org e portal_list_bot_chats falham em runtime.

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
          'chat_id', g.chat_id, 'nome', g.nome, 'tipo', g.tipo,
          'sessao_telefone', g.telefone, 'visto_em', g.visto_em,
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
            'erro', e.erro, 'enviado_em', e.enviado_em, 'tentativas', e.tentativas,
            'sessao_telefone', s2.telefone
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
REVOKE ALL ON FUNCTION public.internal_comunicados_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_comunicados_org(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_list_bot_chats()
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
  IF private.organization_role(v_org) NOT IN ('master', 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
        'chat_id', g.chat_id, 'nome', g.nome, 'tipo', g.tipo,
        'sessao_telefone', g.telefone, 'visto_em', g.visto_em,
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
      WHERE s.organization_id = v_org AND s.status <> 'banido'
      GROUP BY c.chat_id, c.nome, c.tipo
    ) g
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.portal_list_bot_chats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_list_bot_chats() TO authenticated;
