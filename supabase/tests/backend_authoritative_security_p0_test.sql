BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(13);

-- mark_token_used is server-owned. Browser roles must never execute it.
SELECT extensions.ok(
  CASE WHEN to_regprocedure('public.mark_token_used(text, uuid, text, text)') IS NULL THEN false
       ELSE NOT has_function_privilege('anon', 'public.mark_token_used(text, uuid, text, text)', 'EXECUTE') END,
  'anon cannot execute mark_token_used'
);

SELECT extensions.ok(
  CASE WHEN to_regprocedure('public.mark_token_used(text, uuid, text, text)') IS NULL THEN false
       ELSE NOT has_function_privilege('authenticated', 'public.mark_token_used(text, uuid, text, text)', 'EXECUTE') END,
  'authenticated cannot execute mark_token_used'
);

-- consumir_token is absent from the versioned history. The test passes when the
-- RPC is missing; when present on a legacy catalog, anon/authenticated must not
-- have EXECUTE (the conditional revoke in the migration enforces this).
SELECT extensions.ok(
  CASE WHEN to_regprocedure('public.consumir_token(text, uuid, text, text)') IS NULL THEN true
       ELSE NOT has_function_privilege('anon', 'public.consumir_token(text, uuid, text, text)', 'EXECUTE') END,
  'anon cannot execute consumir_token when present'
);

SELECT extensions.ok(
  CASE WHEN to_regprocedure('public.consumir_token(text, uuid, text, text)') IS NULL THEN true
       ELSE NOT has_function_privilege('authenticated', 'public.consumir_token(text, uuid, text, text)', 'EXECUTE') END,
  'authenticated cannot execute consumir_token when present'
);

-- master_delete_user is absent from the versioned history but hardened on legacy
-- catalogs. The P0 semantics: anon gets no EXECUTE; authenticated retains
-- EXECUTE. Pass when missing; enforce the P0 semantics when present.
SELECT extensions.ok(
  CASE WHEN to_regprocedure('public.master_delete_user(uuid, boolean)') IS NULL THEN true
       ELSE NOT has_function_privilege('anon', 'public.master_delete_user(uuid, boolean)', 'EXECUTE') END,
  'anon cannot execute master_delete_user when present'
);

SELECT extensions.ok(
  CASE WHEN to_regprocedure('public.master_delete_user(uuid, boolean)') IS NULL THEN true
       ELSE has_function_privilege('authenticated', 'public.master_delete_user(uuid, boolean)', 'EXECUTE') END,
  'authenticated retains EXECUTE on master_delete_user when present (P0 semantics)'
);

-- get_push_token_by_uid is defined by the reconcile migration on a clean catalog
-- (consumed by the notify-expiring-tokens Edge Function) and hardened on legacy
-- catalogs. anon/authenticated must never have EXECUTE.
SELECT extensions.ok(
  CASE WHEN to_regprocedure('public.get_push_token_by_uid(uuid)') IS NULL THEN true
       ELSE NOT has_function_privilege('anon', 'public.get_push_token_by_uid(uuid)', 'EXECUTE') END,
  'anon cannot execute get_push_token_by_uid when present'
);

SELECT extensions.ok(
  CASE WHEN to_regprocedure('public.get_push_token_by_uid(uuid)') IS NULL THEN true
       ELSE NOT has_function_privilege('authenticated', 'public.get_push_token_by_uid(uuid)', 'EXECUTE') END,
  'authenticated cannot execute get_push_token_by_uid when present'
);

-- provision_organization_with_coordinator must use the real signature
-- (jsonb, text, text, text, text). Browser roles must not execute it.
SELECT extensions.ok(
  CASE WHEN to_regprocedure('public.provision_organization_with_coordinator(jsonb, text, text, text, text)') IS NULL THEN false
       ELSE NOT has_function_privilege('anon', 'public.provision_organization_with_coordinator(jsonb, text, text, text, text)', 'EXECUTE') END,
  'anon cannot execute provision_organization_with_coordinator'
);

SELECT extensions.ok(
  CASE WHEN to_regprocedure('public.provision_organization_with_coordinator(jsonb, text, text, text, text)') IS NULL THEN false
       ELSE NOT has_function_privilege('authenticated', 'public.provision_organization_with_coordinator(jsonb, text, text, text, text)', 'EXECUTE') END,
  'authenticated cannot execute provision_organization_with_coordinator'
);

-- Private tables must have RLS enabled so accidental future grants fail closed.
SELECT extensions.is(
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'private.customer_affiliation_states'::regclass
  ),
  true,
  'customer_affiliation_states should have RLS enabled'
);
SELECT extensions.is(
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'private.inspection_ownership_audit'::regclass
  ),
  true,
  'inspection_ownership_audit should have RLS enabled'
);
SELECT extensions.is(
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'private.signup_invite_claims'::regclass
  ),
  true,
  'signup_invite_claims should have RLS enabled'
);

SELECT * FROM extensions.finish();
ROLLBACK;
