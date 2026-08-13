-- Operational user directories are server-scoped. The browser cannot select
-- arbitrary profiles, choose a municipality outside its authority, or obtain
-- staff email addresses unless it is an administrator.
CREATE OR REPLACE FUNCTION public.list_operational_users(
  p_role text DEFAULT NULL,
  p_municipio text DEFAULT NULL,
  p_include_unapproved boolean DEFAULT false,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(
  uid uuid,
  name text,
  email text,
  role text,
  municipio text,
  "isApproved" boolean,
  "createdAt" timestamptz,
  token_limit integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_actor_role text;
  v_actor_municipio text;
  v_role text := nullif(lower(btrim(coalesce(p_role, ''))), '');
  v_scope_municipio text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF p_offset < 0 OR p_limit NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'invalid_pagination' USING ERRCODE = '22023'; END IF;
  IF v_role IS NOT NULL AND v_role NOT IN ('agent', 'supervisor', 'admin') THEN RAISE EXCEPTION 'invalid_role_filter' USING ERRCODE = '22023'; END IF;

  SELECT u.role, u.municipio INTO v_actor_role, v_actor_municipio
  FROM public.users AS u
  WHERE u.uid = auth.uid() AND u."isApproved";
  IF v_actor_role NOT IN ('master_admin', 'admin', 'supervisor') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_include_unapproved AND v_actor_role NOT IN ('master_admin', 'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  v_scope_municipio := CASE WHEN v_actor_role = 'master_admin' THEN nullif(btrim(coalesce(p_municipio, '')), '') ELSE v_actor_municipio END;
  RETURN QUERY
  SELECT u.uid, u.name,
    CASE WHEN v_actor_role IN ('master_admin', 'admin') THEN u.email ELSE NULL END,
    u.role, u.municipio, u."isApproved", u."createdAt",
    CASE WHEN v_actor_role = 'master_admin' THEN u.token_limit ELSE NULL END
  FROM public.users AS u
  WHERE u.role <> 'master_admin'
    AND (v_role IS NULL OR u.role = v_role)
    AND (v_scope_municipio IS NULL OR u.municipio = v_scope_municipio)
    AND (p_include_unapproved OR u."isApproved")
  ORDER BY u.name NULLS LAST, u.uid
  OFFSET p_offset LIMIT p_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_operational_user(p_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_actor_role text;
  v_actor_municipio text;
  v_target public.users;
BEGIN
  IF auth.uid() IS NULL OR p_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT role, municipio INTO v_actor_role, v_actor_municipio
  FROM public.users WHERE uid = auth.uid() AND "isApproved";
  IF v_actor_role NOT IN ('master_admin', 'admin', 'supervisor') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_target FROM public.users WHERE uid = p_uid AND role <> 'master_admin';
  IF v_target.uid IS NULL OR (v_actor_role <> 'master_admin' AND v_target.municipio IS DISTINCT FROM v_actor_municipio) THEN
    RAISE EXCEPTION 'user_not_found_or_forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'uid', v_target.uid, 'name', v_target.name,
    'email', CASE WHEN v_actor_role IN ('master_admin', 'admin') THEN v_target.email ELSE NULL END,
    'role', v_target.role, 'municipio', v_target.municipio,
    'isApproved', v_target."isApproved", 'createdAt', v_target."createdAt"
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.list_operational_users(text,text,boolean,integer,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_operational_user(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_operational_users(text,text,boolean,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_operational_user(uuid) TO authenticated;
