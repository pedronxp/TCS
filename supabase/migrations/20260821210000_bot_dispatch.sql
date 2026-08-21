-- Bot WhatsApp externo: fila de disparo e vínculo de chats.
-- Ver docs/decisions/bot-whatsapp-externo.md — decisão do dono do produto com
-- risco de banimento assumido; o bot é componente opcional e isolado.
--
-- Fluxo: painel cria canal_envios 'pendente' (origem 'bot') -> bot (hospedagem
-- própria, chave service_role só no ambiente dele) consome a fila e grava o
-- resultado. Chats descobertos pelo bot alimentam bot_chats para vínculo.

-- Fila: status 'pendente' + origem + erro + carimbo do bot.
ALTER TABLE public.canal_envios DROP CONSTRAINT IF EXISTS canal_envios_status_valid;
ALTER TABLE public.canal_envios
  ADD CONSTRAINT canal_envios_status_valid
  CHECK (status IN ('pendente', 'enviado', 'falhou'));

ALTER TABLE public.canal_envios ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual';
ALTER TABLE public.canal_envios ADD COLUMN IF NOT EXISTS erro text;
ALTER TABLE public.canal_envios ADD COLUMN IF NOT EXISTS bot_atualizado_em timestamptz;
ALTER TABLE public.canal_envios DROP CONSTRAINT IF EXISTS canal_envios_origem_valid;
ALTER TABLE public.canal_envios
  ADD CONSTRAINT canal_envios_origem_valid CHECK (origem IN ('manual', 'bot'));

CREATE INDEX IF NOT EXISTS canal_envios_fila_idx
  ON public.canal_envios (status, created_at) WHERE status = 'pendente';

-- Vínculo da comunidade registrada com o chat real do WhatsApp (grupo/grupo de
-- anúncios da Comunidade), informado pelo bot.
ALTER TABLE public.canais_externos ADD COLUMN IF NOT EXISTS chat_id text;

-- Chats descobertos pelo bot (uma conta por bot; piloto opera um bot).
CREATE TABLE IF NOT EXISTS public.bot_chats (
  chat_id text PRIMARY KEY,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'grupo',
  visto_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_chats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bot_chats FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS bot_chats_portal_select ON public.bot_chats;
CREATE POLICY bot_chats_portal_select ON public.bot_chats FOR SELECT TO authenticated
USING ((SELECT private.is_owner_admin()) OR private.organization_role(coalesce(private.current_organization_id(), '00000000-0000-0000-0000-000000000000'::uuid)) IN ('master', 'admin'));

-- ---------------------------------------------------------------------------
-- RPCs do painel: disparar pelo bot, listar chats, vincular chat à comunidade.
-- ---------------------------------------------------------------------------

-- Enfileira disparo: comunidade específica ou todas as ativas com chat vinculado.
-- Reenvio reenfileira o mesmo registro (canal+comunicado é único).
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
      'chat_id', c.chat_id, 'nome', c.nome, 'tipo', c.tipo, 'visto_em', c.visto_em
    ) ORDER BY c.nome)
    FROM public.bot_chats c
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.portal_list_bot_chats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_list_bot_chats() TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_vincular_canal_chat(p_canal_id uuid, p_chat_id text)
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
  IF p_chat_id IS NULL OR p_chat_id = '' THEN
    UPDATE public.canais_externos SET chat_id = NULL, updated_at = now()
    WHERE id = p_canal_id AND organization_id = v_org;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.bot_chats WHERE chat_id = p_chat_id) THEN
      RAISE EXCEPTION 'chat_invalido' USING ERRCODE = '22023';
    END IF;
    UPDATE public.canais_externos SET chat_id = p_chat_id, updated_at = now()
    WHERE id = p_canal_id AND organization_id = v_org;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_vincular_canal_chat(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_vincular_canal_chat(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Contratos atualizados: canais trazem chat_id; envios trazem status/origem/erro.
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
      'chat_id', k.chat_id,
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
            'status', e.status,
            'origem', e.origem,
            'erro', e.erro,
            'enviado_em', e.enviado_em,
            'registrado_por_nome', uu.name
          ) ORDER BY e.created_at DESC)
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

COMMENT ON FUNCTION public.portal_disparar_envio_bot(uuid, uuid) IS
  'Enfileira disparo pelo bot WhatsApp externo (decisão docs/decisions/bot-whatsapp-externo.md). O bot consome canal_envios pendente com service_role e grava enviado/falhou com auditoria.';
