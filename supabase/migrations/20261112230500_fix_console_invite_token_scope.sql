CREATE OR REPLACE FUNCTION public.list_console_invite_tokens(p_municipio text DEFAULT NULL)
RETURNS TABLE(management_id uuid, role text, municipio text, created_at timestamptz, expires_at timestamptz, used boolean, revoked_at timestamptz, status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_scope text := nullif(btrim(p_municipio), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT private.can_manage_invite_tokens(coalesce(v_scope, (SELECT actor.municipio FROM public.users AS actor WHERE actor.uid = auth.uid())), auth.uid()) THEN RAISE EXCEPTION 'token_management_not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT token.management_id, token.role, token.municipio, token."criadoEm", token."expiraEm", coalesce(token.usado, false), token.revoked_at,
    CASE WHEN token.revoked_at IS NOT NULL THEN 'revoked' WHEN coalesce(token.usado, false) THEN 'used' WHEN token."expiraEm" <= now() THEN 'expired' ELSE 'active' END
  FROM public.invite_tokens token
  WHERE (v_scope IS NULL OR token.municipio = v_scope)
    AND private.can_manage_invite_tokens(token.municipio, auth.uid())
  ORDER BY token."criadoEm" DESC;
END;
$$;
