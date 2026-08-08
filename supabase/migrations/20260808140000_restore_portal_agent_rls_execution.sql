-- The vistorias RLS policy calls this private helper for organization-scoped rows.
-- The function is not exposed through PostgREST because it lives in the private schema,
-- but the authenticated role must be allowed to execute it while PostgreSQL evaluates RLS.
GRANT EXECUTE ON FUNCTION private.portal_agent_allowed(uuid, text, uuid) TO authenticated;
