-- SCRIPT PARA DEPLOY NO SQL EDITOR DO SUPABASE
-- Permite que usuários master resetem a senha de outros no App.

CREATE OR REPLACE FUNCTION admin_reset_password(p_uid UUID, p_new_password TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Verificar a role de quem chama
  SELECT role INTO v_role FROM users WHERE uid = auth.uid();
  IF v_role != 'master_admin' THEN
    RAISE EXCEPTION 'Acesso negado: apenas master admins podem redefinir senhas (role atual: %).', v_role;
  END IF;

  -- Se for master_admin, altera auth.users e encryta a senha.
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
  WHERE id = p_uid;

  -- Em auditoria nativa a mudança se propaga, não precisa mais nada!
END;
$$;
