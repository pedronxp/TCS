-- Historical rows may still have organization_id = NULL and only a municipality
-- label. Keep that lookup compatibility, but derive authority exclusively from
-- an active canonical organization membership, never from public.users fields.
CREATE OR REPLACE FUNCTION private.can_access_legacy_municipality(
  p_municipality text,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_user_id IS NOT NULL
    AND nullif(trim(p_municipality), '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members AS member
      JOIN public.organizations AS organization
        ON organization.id = member.organization_id
      WHERE member.user_id = p_user_id
        AND member.status = 'active'
        AND member.role IN ('owner', 'coordinator', 'supervisor')
        AND organization.status IN ('onboarding', 'pilot', 'active', 'suspended')
        AND lower(trim(organization.municipality_name)) = lower(trim(p_municipality))
    );
$$;

REVOKE ALL ON FUNCTION private.can_access_legacy_municipality(text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_access_legacy_municipality(text, uuid)
  TO authenticated;

COMMENT ON FUNCTION private.can_access_legacy_municipality(text, uuid) IS
  'Compatibility lookup for organization-less historical rows; authority is canonical organization membership.';
