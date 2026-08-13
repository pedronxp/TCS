-- The client may render its own profile, but its shape and identity binding are
-- defined by the backend. This also provides a safe path to revoke broad table
-- reads from public.users in a later compatibility migration.
CREATE OR REPLACE FUNCTION public.get_my_user_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_profile jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'uid', u.uid,
    'name', u.name,
    'email', u.email,
    'role', u.role,
    'municipio', u.municipio,
    'isApproved', u."isApproved",
    'createdAt', u."createdAt",
    'nameChanged', u."nameChanged",
    'phone', u.phone,
    'organizationId', u.organization_id,
    'tokenLimit', u.token_limit
  )
  INTO v_profile
  FROM public.users AS u
  WHERE u.uid = auth.uid();

  RETURN v_profile;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_user_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_user_profile() TO authenticated;
