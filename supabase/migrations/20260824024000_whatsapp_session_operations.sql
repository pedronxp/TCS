-- Operações explícitas das sessões do WhatsApp.
--
-- Desconectar preserva o estado criptografado para retomada rápida.
-- Sair pede ao worker que encerre a sessão no WhatsApp e apague o estado.
-- Banir remove o número do fallback sem confundir o evento com uma queda comum.

ALTER TABLE public.bot_sessoes
  ADD COLUMN IF NOT EXISTS acao_pendente text;

ALTER TABLE public.bot_sessoes
  DROP CONSTRAINT IF EXISTS bot_sessoes_acao_pendente_valid;
ALTER TABLE public.bot_sessoes
  ADD CONSTRAINT bot_sessoes_acao_pendente_valid
  CHECK (acao_pendente IS NULL OR acao_pendente = 'sair');

CREATE INDEX IF NOT EXISTS bot_sessoes_acao_pendente_idx
  ON public.bot_sessoes (acao_pendente)
  WHERE acao_pendente IS NOT NULL;

CREATE OR REPLACE FUNCTION private.apply_whatsapp_session_action(
  p_sessao_id uuid,
  p_acao text,
  p_organization_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
BEGIN
  IF p_acao NOT IN ('desconectar', 'reconectar', 'sair', 'banir') THEN
    RAISE EXCEPTION 'acao_invalida' USING ERRCODE = '22023';
  END IF;

  SELECT status INTO v_status
  FROM public.bot_sessoes
  WHERE id = p_sessao_id
    AND (p_organization_id IS NULL OR organization_id = p_organization_id)
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_status = 'banido' AND p_acao <> 'banir' THEN
    RAISE EXCEPTION 'sessao_banida' USING ERRCODE = '22023';
  END IF;

  UPDATE public.bot_sessoes
  SET status = CASE p_acao
      WHEN 'reconectar' THEN 'aguardando_qr'
      WHEN 'banir' THEN 'banido'
      ELSE 'desconectado'
    END,
    acao_pendente = CASE WHEN p_acao = 'sair' THEN 'sair' ELSE NULL END,
    atualizado_em = now()
  WHERE id = p_sessao_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION private.apply_whatsapp_session_action(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.apply_whatsapp_session_action(uuid, text, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.portal_operar_sessao_bot(
  p_sessao_id uuid,
  p_acao text
)
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
  IF private.organization_role(v_org) NOT IN ('master', 'admin')
     OR NOT private.has_whatsapp_module_access(auth.uid(), v_org) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN private.apply_whatsapp_session_action(p_sessao_id, p_acao, v_org);
END;
$$;

REVOKE ALL ON FUNCTION public.portal_operar_sessao_bot(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_operar_sessao_bot(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.internal_operar_sessao_bot(
  p_sessao_id uuid,
  p_acao text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT private.has_internal_permission('whatsapp.manage') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN private.apply_whatsapp_session_action(p_sessao_id, p_acao, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.internal_operar_sessao_bot(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_operar_sessao_bot(uuid, text) TO authenticated;

COMMENT ON COLUMN public.bot_sessoes.acao_pendente IS
  'Comando assíncrono consumido pelo worker. sair encerra a conta e remove o estado criptografado.';
