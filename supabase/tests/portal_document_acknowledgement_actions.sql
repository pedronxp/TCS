BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(10);

SELECT extensions.has_function(
  'public',
  'portal_create_document_acknowledgement_link',
  ARRAY['uuid', 'integer'],
  'portal can create an acknowledgement link through an authorized RPC'
);
SELECT extensions.has_function(
  'public',
  'portal_revoke_document_acknowledgement_link',
  ARRAY['uuid'],
  'portal can revoke an acknowledgement link through an authorized RPC'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.portal_create_document_acknowledgement_link(uuid,integer)', 'EXECUTE'),
  'anonymous callers cannot create acknowledgement links'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.portal_revoke_document_acknowledgement_link(uuid)', 'EXECUTE'),
  'anonymous callers cannot revoke acknowledgement links'
);
SELECT extensions.ok(
  has_function_privilege('authenticated', 'public.portal_create_document_acknowledgement_link(uuid,integer)', 'EXECUTE'),
  'authenticated portal sessions can invoke link creation'
);
SELECT extensions.ok(
  has_function_privilege('authenticated', 'public.portal_revoke_document_acknowledgement_link(uuid)', 'EXECUTE'),
  'authenticated portal sessions can invoke link revocation'
);
SELECT extensions.ok(
  pg_get_functiondef('public.portal_create_document_acknowledgement_link(uuid,integer)'::regprocedure) LIKE '%get_portal_access_context%'
  AND pg_get_functiondef('public.portal_create_document_acknowledgement_link(uuid,integer)'::regprocedure) LIKE '%creation_allowed%'
  AND pg_get_functiondef('public.portal_create_document_acknowledgement_link(uuid,integer)'::regprocedure) LIKE '%document.read%',
  'creation derives permission and subscription state on the server'
);
SELECT extensions.ok(
  pg_get_functiondef('public.portal_create_document_acknowledgement_link(uuid,integer)'::regprocedure) LIKE '%document_already_finalized%',
  'a final outcome prevents another link for the same document version'
);
SELECT extensions.ok(
  pg_get_functiondef('public.portal_revoke_document_acknowledgement_link(uuid)'::regprocedure) LIKE '%portal_agent_allowed%'
  AND pg_get_functiondef('public.portal_revoke_document_acknowledgement_link(uuid)'::regprocedure) LIKE '%status = ''open''%',
  'revocation enforces portal scope and only changes open requests'
);
SELECT extensions.ok(
  pg_get_functiondef('public.portal_list_acknowledgements()'::regprocedure) LIKE '%can_generate%'
  AND pg_get_functiondef('public.portal_list_acknowledgements()'::regprocedure) LIKE '%can_revoke%'
  AND pg_get_functiondef('public.portal_list_acknowledgements()'::regprocedure) LIKE '%expires_at%',
  'portal listing returns server-derived capabilities without exposing a raw token'
);

SELECT * FROM extensions.finish();
ROLLBACK;
