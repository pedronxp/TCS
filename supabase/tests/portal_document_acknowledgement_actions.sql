BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(16);

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
SELECT extensions.ok(
  pg_get_functiondef('public.portal_create_document_acknowledgement_link(uuid,integer)'::regprocedure) LIKE '%portal_agent_allowed%',
  'portal link creation enforces the same agent scope as listing and revocation'
);
SELECT extensions.ok(
  pg_get_functiondef('public.create_document_acknowledgement_link(uuid,integer)'::regprocedure) NOT LIKE '%get_portal_access_context%'
  AND pg_get_functiondef('public.create_document_acknowledgement_link(uuid,integer)'::regprocedure) LIKE '%pg_advisory_xact_lock%',
  'mobile link creation keeps its own authorization contract and serializes final state'
);
SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'document_acknowledgement_events_one_outcome_idx'
      AND indexdef LIKE '%UNIQUE%'
      AND indexdef LIKE '%event_kind%outcome%'
  ),
  'database enforces one final outcome per immutable document version'
);
SELECT extensions.has_column(
  'public', 'document_acknowledgement_requests', 'revoked_by',
  'link revocation records its author'
);
SELECT extensions.has_column(
  'public', 'document_acknowledgement_requests', 'revoked_at',
  'link revocation records its timestamp'
);
SELECT extensions.ok(
  pg_get_functiondef('public.finalize_document_acknowledgement(jsonb)'::regprocedure) LIKE '%pg_advisory_xact_lock%'
  AND pg_get_functiondef('public.finalize_remote_document_acknowledgement(text,jsonb)'::regprocedure) LIKE '%pg_advisory_xact_lock%'
  AND NOT has_function_privilege('authenticated', 'private.finalize_document_acknowledgement(jsonb)', 'EXECUTE'),
  'all exposed finalization channels share the document lock and private core is not directly callable'
);

SELECT * FROM extensions.finish();
ROLLBACK;
