-- Bot WhatsApp multi-sessão: cada número vinculado pertence a uma organização.
--
-- Correção de desenho (decisão do dono, 2026-08-22):
-- - A Comunidade é criada no WhatsApp por um número da prefeitura; um SEGUNDO
--   número da mesma prefeitura também é admin, formando fallback de disparo —
--   se um número cair (banimento), o outro continua enviando.
-- - Sessão só nasce dentro do portal municipal (master/admin da organização):
--   conta individual sem vínculo (ex.: Pedro) nunca registra número e nunca
--   enxerga comunidades de outro município.
-- - O dispatcher do bot tenta, em sequência, todas as sessões vinculadas da
--   organização que enxergam o chat da comunidade.

CREATE TABLE IF NOT EXISTS public.bot_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vinculado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  telefone text,
  status text NOT NULL DEFAULT 'aguardando_qr',
  vinculado_em timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bot_sessoes_status_valid
    CHECK (status IN ('aguardando_qr', 'vinculado', 'desconectado', 'banido'))
);
CREATE INDEX IF NOT EXISTS bot_sessoes_org_idx
  ON public.bot_sessoes (organization_id, status);

ALTER TABLE public.bot_sessoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bot_sessoes FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS bot_sessoes_portal_select ON public.bot_sessoes;
CREATE POLICY bot_sessoes_portal_select ON public.bot_sessoes FOR SELECT TO authenticated
USING (
  (SELECT private.is_owner_admin())
  OR (
    organization_id = (SELECT private.current_organization_id())
    AND (SELECT private.organization_role(organization_id)) IN ('master', 'admin')
  )
);

-- Chats passam a pertencer à sessão que os enxerga (a tabela do piloto está vazia;
-- recriação sem perda). O mesmo grupo aparece em N sessões com N admins.
DROP TABLE IF EXISTS public.bot_chats CASCADE;
CREATE TABLE public.bot_chats (
  sessao_id uuid NOT NULL REFERENCES public.bot_sessoes(id) ON DELETE CASCADE,
  chat_id text NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'grupo',
  visto_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sessao_id, chat_id)
);
CREATE INDEX IF NOT EXISTS bot_chats_chat_idx ON public.bot_chats (chat_id);

ALTER TABLE public.bot_chats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bot_chats FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS bot_chats_portal_select ON public.bot_chats;
CREATE POLICY bot_chats_portal_select ON public.bot_chats FOR SELECT TO authenticated
USING (
  (SELECT private.is_owner_admin())
  OR EXISTS (
    SELECT 1 FROM public.bot_sessoes s
    WHERE s.id = bot_chats.sessao_id
      AND s.organization_id = (SELECT private.current_organization_id())
      AND (SELECT private.organization_role(s.organization_id)) IN ('master', 'admin')
  )
);

-- Auditoria do fallback: qual sessão enviou e o histórico de tentativas.
ALTER TABLE public.canal_envios ADD COLUMN IF NOT EXISTS sessao_id uuid
  REFERENCES public.bot_sessoes(id) ON DELETE SET NULL;
ALTER TABLE public.canal_envios ADD COLUMN IF NOT EXISTS tentativas jsonb;

-- ---------------------------------------------------------------------------
-- RPCs do painel: vincular número, listar, desativar/banir.
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
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF v_org IS NULL THEN RAISE EXCEPTION 'municipal_membership_required' USING ERRCODE = '42501'; END IF;
  IF private.organization_role(v_org) NOT IN ('master', 'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  -- Sessões aguardando QR sem uso por mais de 30 minutos são descartadas.
  UPDATE public.bot_sessoes SET status = 'desconectado', atualizado_em = now()
  WHERE organization_id = v_org AND status = 'aguardando_qr'
    AND atualizado_em < now() - interval '30 minutes';

  INSERT INTO public.bot_sessoes (organization_id, vinculado_por)
  VALUES (v_org, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_criar_sessao_bot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_criar_sessao_bot() TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_listar_sessoes_bot()
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
      'id', s.id,
      'telefone', s.telefone,
      'status', s.status,
      'vinculado_por_nome', u.name,
      'criado_em', s.criado_em,
      'vinculado_em', s.vinculado_em,
      'atualizado_em', s.atualizado_em,
      'total_chats', (SELECT count(*) FROM public.bot_chats c WHERE c.sessao_id = s.id)
    ) ORDER BY s.status, s.criado_em DESC)
    FROM public.bot_sessoes s
    LEFT JOIN public.users u ON u.uid = s.vinculado_por
    WHERE s.organization_id = v_org
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.portal_listar_sessoes_bot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_listar_sessoes_bot() TO authenticated;

-- Banido = número caiu, o bot para a sessão e não usa mais no fallback.
-- Desconectado = pausado (reconecta se voltar a responder).
CREATE OR REPLACE FUNCTION public.portal_definir_status_sessao_bot(p_sessao_id uuid, p_status text)
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
  IF p_status NOT IN ('banido', 'desconectado') THEN RAISE EXCEPTION 'status_invalido' USING ERRCODE = '22023'; END IF;

  UPDATE public.bot_sessoes
  SET status = p_status, atualizado_em = now()
  WHERE id = p_sessao_id AND organization_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_definir_status_sessao_bot(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_definir_status_sessao_bot(uuid, text) TO authenticated;

-- Chats agora vêm das sessões da organização (com o telefone que enxerga cada um).
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
      'chat_id', c.chat_id,
      'nome', c.nome,
      'tipo', c.tipo,
      'sessao_telefone', s.telefone,
      'visto_em', max(c.visto_em)
    ) ORDER BY c.nome)
    FROM public.bot_chats c
    JOIN public.bot_sessoes s ON s.id = c.sessao_id
    WHERE s.organization_id = v_org AND s.status <> 'banido'
    GROUP BY c.chat_id, c.nome, c.tipo
  ), '[]'::jsonb);
END;
$$;

-- O vínculo agora valida que o chat é enxergado por uma sessão da própria organização.
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
    IF NOT EXISTS (
      SELECT 1 FROM public.bot_chats c
      JOIN public.bot_sessoes s ON s.id = c.sessao_id
      WHERE c.chat_id = p_chat_id AND s.organization_id = v_org AND s.status <> 'banido'
    ) THEN
      RAISE EXCEPTION 'chat_invalido' USING ERRCODE = '22023';
    END IF;
    UPDATE public.canais_externos SET chat_id = p_chat_id, updated_at = now()
    WHERE id = p_canal_id AND organization_id = v_org;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_list_bot_chats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_list_bot_chats() TO authenticated;
REVOKE ALL ON FUNCTION public.portal_vincular_canal_chat(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_vincular_canal_chat(uuid, text) TO authenticated;

COMMENT ON TABLE public.bot_sessoes IS
  'Números WhatsApp vinculados ao bot, cada um pertencente a uma organização. Criado via portal (master/admin); contas individuais sem vínculo municipal não criam sessão nem veem comunidades de outro município.';
