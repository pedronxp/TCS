-- Permite que owner/suporte escolha uma conta ainda sem organização no painel.
-- Não expõe a lista para clientes, agentes municipais ou usuários anônimos.
CREATE OR REPLACE FUNCTION public.list_unlinked_agents_for_internal_link(
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  user_id uuid,
  name text,
  email text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 200));
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.internal_staff
    WHERE user_id = v_actor
      AND status = 'active'
      AND role IN ('owner', 'support')
  ) THEN
    RAISE EXCEPTION 'unlinked_agents_list_not_allowed' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    u.uid,
    coalesce(nullif(trim(u.name), ''), nullif(trim(u.username), ''), 'Conta sem nome'),
    u.email,
    u."createdAt"
  FROM public.users u
  WHERE u.organization_id IS NULL
    AND u.role <> 'master_admin'
    AND NOT EXISTS (
      SELECT 1
      FROM public.organization_members membership
      WHERE membership.user_id = u.uid
        AND membership.status IN ('active', 'invited', 'suspended')
    )
  ORDER BY u."createdAt" DESC NULLS LAST, u.name ASC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.list_unlinked_agents_for_internal_link(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_unlinked_agents_for_internal_link(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
