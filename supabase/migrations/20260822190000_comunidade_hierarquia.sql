-- Hierarquia Comunidade -> grupos: o protocolo expõe o grupo pai (linkedParent)
-- de cada grupo membro de uma Comunidade. Guardamos o vínculo para o painel
-- apresentar "Comunidade X → grupo Y" e permitir criar/selecionar dentro dela.

ALTER TABLE public.bot_chats ADD COLUMN IF NOT EXISTS comunidade_id text;
ALTER TABLE public.bot_chats ADD COLUMN IF NOT EXISTS comunidade_nome text;
CREATE INDEX IF NOT EXISTS bot_chats_comunidade_idx ON public.bot_chats (comunidade_id);

-- Contrato do console passa a devolver a hierarquia nos chats.
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
          'comunidade_id', g.comunidade_id, 'comunidade_nome', g.comunidade_nome,
          'sessao_telefone', public.mascarar_telefone(g.telefone), 'visto_em', g.visto_em,
          'total_admins', g.total_admins, 'total_participantes', g.total_participantes
        ) ORDER BY g.comunidade_nome NULLS LAST, g.nome)
      FROM (
        SELECT c.chat_id, c.nome, c.tipo,
               min(c.comunidade_id) AS comunidade_id,
               min(c.comunidade_nome) AS comunidade_nome,
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
