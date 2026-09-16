-- Usa os mesmos verificadores canônicos que protegem o console interno.
CREATE OR REPLACE FUNCTION public.list_unlinked_agents_for_internal_link(
  p_limit integer DEFAULT 100
)
RETURNS TABLE (user_id uuid, name text, email text, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 200));
BEGIN
  IF v_actor IS NULL OR NOT (
    private.is_owner_admin(v_actor)
    OR private.current_internal_role(v_actor) = 'support'
  ) THEN
    RAISE EXCEPTION 'unlinked_agents_list_not_allowed' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT profile.uid,
    coalesce(nullif(trim(profile.name), ''), nullif(trim(profile.username), ''), 'Conta sem nome'),
    profile.email,
    profile."createdAt"
  FROM public.users AS profile
  WHERE profile.organization_id IS NULL
    AND profile.role <> 'master_admin'
    AND NOT EXISTS (
      SELECT 1 FROM public.organization_members AS membership
      WHERE membership.user_id = profile.uid
        AND membership.status IN ('active', 'invited', 'suspended')
    )
  ORDER BY profile."createdAt" DESC NULLS LAST, profile.name ASC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.list_unlinked_agents_for_internal_link(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_unlinked_agents_for_internal_link(integer) TO authenticated;
NOTIFY pgrst, 'reload schema';
