-- Autoriza chamadas HTTP do painel ao worker sem expor credenciais do backend.
-- O JWT é validado pelo worker; esta função service_role confere o usuário,
-- a organização da sessão e o nível de operação solicitado.

CREATE OR REPLACE FUNCTION public.bot_authorize_session_access(
  p_session_id uuid,
  p_user_id uuid,
  p_manage boolean DEFAULT false
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bot_sessoes session
    WHERE session.id = p_session_id
      AND private.has_whatsapp_module_access(p_user_id, session.organization_id)
      AND (
        NOT p_manage
        OR EXISTS (
          SELECT 1
          FROM public.internal_staff staff
          WHERE staff.user_id = p_user_id
            AND staff.status = 'active'
            AND staff.role IN ('owner', 'developer')
        )
        OR EXISTS (
          SELECT 1
          FROM public.organization_members member
          WHERE member.organization_id = session.organization_id
            AND member.user_id = p_user_id
            AND member.status = 'active'
            AND member.role IN ('master', 'admin')
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.bot_authorize_session_access(uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_authorize_session_access(uuid, uuid, boolean)
  TO service_role;
