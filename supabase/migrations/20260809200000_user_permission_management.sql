-- Permite que owner, developer e support gerenciem senhas e permissões pelo console.
-- Migration created: 2026-08-09

-- 1. Amplia as permissões do papel "support" para que ele tenha acesso real ao console.
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
      'technical.read', 'technical.write', 'build.request', 'build.approve', 'configuration.publish'
    ]::text[]
    WHEN 'developer' THEN ARRAY[
      'console.read', 'dashboard.technical.read', 'customer.read', 'customer.sensitive.request',
      'commercial.read', 'support.read', 'support.write', 'session.read', 'session.terminate',
      'audit.read', 'technical.read', 'technical.write', 'build.request', 'configuration.prepare'
    ]::text[]
    WHEN 'support' THEN ARRAY[
      'console.read', 'customer.read', 'customer.write', 'support.read', 'support.write',
      'session.read', 'staff.read', 'audit.read'
    ]::text[]
    WHEN 'auditor' THEN ARRAY[
      'console.read', 'audit.read'
    ]::text[]
    ELSE ARRAY[]::text[]
  END;
$$;

COMMENT ON FUNCTION private.internal_permissions IS
'Permissões derivadas do papel interno do console (owner/developer/support/auditor).';

-- 2. Recria a RPC de reset de senha autorizando owner, developer E support.
--    Resetando a senha de QUALQUER usuário do sistema (auth.users), com auditoria.
CREATE OR REPLACE FUNCTION public.internal_reset_password(
  p_target_user_id uuid,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_actor_role text;
  v_actor_status text;
  v_target_exists boolean;
BEGIN
  -- Valida entradas
  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id_required' USING ERRCODE = '22023';
  END IF;

  IF length(p_new_password) < 8 THEN
    RAISE EXCEPTION 'password_too_short' USING ERRCODE = '22023';
  END IF;

  -- Recupera papel/status do caller em internal_staff
  SELECT role, status INTO v_actor_role, v_actor_status
  FROM public.internal_staff
  WHERE user_id = auth.uid();

  -- Exige staff ativo com papel autorizado
  IF v_actor_status IS NULL OR v_actor_status != 'active' THEN
    RAISE EXCEPTION 'not_authorized_staff' USING ERRCODE = '42501';
  END IF;

  IF v_actor_role NOT IN ('owner', 'developer', 'support') THEN
    RAISE EXCEPTION 'insufficient_permissions' USING ERRCODE = '42501';
  END IF;

  -- Verifica existência do alvo em auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_target_user_id)
  INTO v_target_exists;

  IF NOT v_target_exists THEN
    RAISE EXCEPTION 'target_user_not_found' USING ERRCODE = '22023';
  END IF;

  -- Redefine a senha usando bcrypt
  UPDATE auth.users
  SET
    encrypted_password = crypt(p_new_password, gen_salt('bf')),
    updated_at = now()
  WHERE id = p_target_user_id;

  -- Auditoria
  INSERT INTO public.internal_access_events (
    actor_id, actor_role, action, target_type, target_id, result, metadata
  ) VALUES (
    auth.uid(),
    v_actor_role,
    'reset_password',
    'user',
    p_target_user_id::text,
    'allowed',
    jsonb_build_object('timestamp', now())
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Password reset successfully'
  );
END;
$$;

COMMENT ON FUNCTION public.internal_reset_password IS
'Permite a Owner, Developer e Support redefinir a senha de qualquer usuário do sistema via console.';

REVOKE ALL ON FUNCTION public.internal_reset_password(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_reset_password(uuid, text) TO authenticated;
