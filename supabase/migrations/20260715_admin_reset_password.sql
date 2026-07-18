-- Redefinição de senha com autorização no banco (não apenas na interface).
-- master_admin pode redefinir qualquer conta; admin apenas contas não-master
-- do mesmo município.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.admin_reset_password(
  p_uid UUID,
  p_new_password TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role TEXT;
  v_caller_municipio TEXT;
  v_target_role TEXT;
  v_target_municipio TEXT;
BEGIN
  IF p_uid IS NULL OR length(p_new_password) < 8 THEN
    RAISE EXCEPTION 'Dados inválidos para redefinição de senha.';
  END IF;

  SELECT role, municipio
    INTO v_caller_role, v_caller_municipio
    FROM public.users
   WHERE uid = auth.uid()
     AND "isApproved" = true;

  SELECT role, municipio
    INTO v_target_role, v_target_municipio
    FROM public.users
   WHERE uid = p_uid;

  IF v_caller_role = 'master_admin' THEN
    NULL;
  ELSIF v_caller_role = 'admin'
        AND v_target_role IS DISTINCT FROM 'master_admin'
        AND v_caller_municipio IS NOT NULL
        AND v_caller_municipio = v_target_municipio THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Acesso negado para redefinir a senha deste usuário.';
  END IF;

  UPDATE auth.users
     SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
   WHERE id = p_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_password(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_password(UUID, TEXT) TO authenticated;
