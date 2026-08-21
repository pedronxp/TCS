-- RPCs de registro de dispositivos do portal.
-- O cliente chama estas funções a partir do Perfil; SECURITY INVOKER respeita
-- as policies de SELECT/UPDATE existentes em active_sessions (sessions_org_select).
-- Aplicado em produção via MCP Supabase em 2026-08-12.

-- Lista apenas as sessões ativas do próprio usuário (RLS filtra por user_id).
-- The original portal helper returned JSON. Replace its signature with typed rows.
DROP FUNCTION IF EXISTS public.portal_list_own_sessions();

CREATE OR REPLACE FUNCTION public.portal_list_own_sessions()
RETURNS TABLE (
  id uuid,
  device_name text,
  platform text,
  status text,
  started_at timestamptz,
  last_heartbeat_at timestamptz
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = 'public', 'extensions'
AS $function$
  SELECT id, device_name, platform, status, started_at, last_heartbeat_at
  FROM public.active_sessions
  WHERE user_id = auth.uid()
    AND status IN ('active', 'replaced')
  ORDER BY started_at DESC;
$function$;

-- Encerra um registro operacional do próprio usuário.
-- A cláusula WHERE user_id = auth.uid() garante que não é possível encerrar
-- sessões de terceiros (defesa em profundidade além do RLS).
CREATE OR REPLACE FUNCTION public.portal_end_own_session(p_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public', 'extensions'
AS $function$
DECLARE
  v_owner uuid;
  v_current_status text;
BEGIN
  IF p_session_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT user_id, status INTO v_owner, v_current_status
  FROM public.active_sessions
  WHERE id = p_session_id;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    -- Registro não existe ou não pertence ao usuário: não expõe existência.
    RETURN false;
  END IF;

  IF v_current_status = 'ended' OR v_current_status = 'expired' THEN
    -- Já inativo: reporta que nenhuma alteração foi feita.
    RETURN false;
  END IF;

  UPDATE public.active_sessions
  SET status = 'ended',
      ended_at = now(),
      ended_by = auth.uid(),
      end_reason = 'user_request'
  WHERE id = p_session_id
    AND user_id = auth.uid();

  RETURN FOUND;
END;
$function$;

COMMENT ON FUNCTION public.portal_list_own_sessions() IS 'Lista as sessões ativas/replaced do próprio usuário para o perfil do portal.';
COMMENT ON FUNCTION public.portal_end_own_session(uuid) IS 'Encerra um registro operacional de sessão do próprio usuário. Retorna false se já inativo ou não pertencente ao caller.';
