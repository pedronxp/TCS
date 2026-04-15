-- ============================================================
-- Migração: exclusão segura de usuários por master_admin
-- ============================================================

CREATE OR REPLACE FUNCTION public.master_delete_user(
  p_target_uid      UUID,
  p_delete_vistorias BOOLEAN DEFAULT FALSE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_role TEXT;
  v_target_role TEXT;
BEGIN
  SELECT role
  INTO v_actor_role
  FROM public.users
  WHERE uid = auth.uid();

  IF v_actor_role IS NULL OR v_actor_role <> 'master_admin' THEN
    RAISE EXCEPTION 'Acesso negado: apenas master_admin pode excluir usuários.';
  END IF;

  SELECT role
  INTO v_target_role
  FROM public.users
  WHERE uid = p_target_uid;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Usuário alvo não encontrado.';
  END IF;

  IF p_target_uid = auth.uid() THEN
    RAISE EXCEPTION 'Não é permitido excluir o próprio usuário.';
  END IF;

  IF v_target_role = 'master_admin' THEN
    RAISE EXCEPTION 'Não é permitido excluir outro master_admin.';
  END IF;

  -- Remove vínculos operacionais
  DELETE FROM public.atribuicoes
  WHERE supervisor_uid = p_target_uid::text
     OR agente_uid = p_target_uid::text;

  UPDATE public.agendamentos
  SET criado_por_uid = NULL
  WHERE criado_por_uid = p_target_uid;

  UPDATE public.agendamentos
  SET agente_uid = NULL
  WHERE agente_uid = p_target_uid;

  UPDATE public.invite_tokens
  SET "usadoPorUid" = NULL
  WHERE "usadoPorUid" = p_target_uid;

  -- Remove vistorias do usuário se solicitado
  IF p_delete_vistorias THEN
    -- vistorias."agenteUid" é TEXT no schema atual
    DELETE FROM public.vistorias
    WHERE "agenteUid" = p_target_uid::text;
  END IF;

  DELETE FROM public.users
  WHERE uid = p_target_uid;

  DELETE FROM auth.users
  WHERE id = p_target_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.master_delete_user(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.master_delete_user(UUID, BOOLEAN) TO authenticated;
