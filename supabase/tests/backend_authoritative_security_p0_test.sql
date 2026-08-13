BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(16);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'invite_tokens'
      AND policyname = 'tokens_anon_check'
  ),
  'anonymous callers cannot enumerate valid legacy invitation tokens'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'invite_tokens'
      AND policyname = 'allow_mark_token_used'
  ),
  'authenticated callers cannot mark arbitrary invitation tokens as used'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'allow_self_insert_on_signup'
  ),
  'profile creation is not writable directly by anonymous clients'
);

SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'private.customer_affiliation_states'::regclass),
  'customer affiliation state has RLS enabled'
);

SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'private.inspection_ownership_audit'::regclass),
  'inspection ownership audit has RLS enabled'
);

SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'private.internal_agent_identity_links'::regclass),
  'internal identity links have RLS enabled'
);

SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'private.signup_invite_claims'::regclass),
  'signup invite claims have RLS enabled'
);

SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.admin_reset_password(uuid,text)', 'EXECUTE'),
  'anonymous callers cannot execute administrative password reset'
);

SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.get_push_token_by_uid(uuid)', 'EXECUTE'),
  'anonymous callers cannot retrieve device push tokens'
);

SELECT extensions.ok(
  NOT has_function_privilege('authenticated', 'public.get_push_token_by_uid(uuid)', 'EXECUTE'),
  'authenticated callers cannot retrieve another account device push token'
);

SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.get_dashboard_kpis_master()', 'EXECUTE'),
  'anonymous callers cannot retrieve global dashboard KPIs'
);

SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.master_delete_user(uuid,boolean)', 'EXECUTE'),
  'anonymous callers cannot execute user deletion routine'
);

SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.provision_organization_with_coordinator(jsonb,text,text,boolean,text)', 'EXECUTE'),
  'anonymous callers cannot execute organization provisioning'
);

SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.consumir_token(text,uuid,text,text)', 'EXECUTE'),
  'anonymous callers cannot consume invitations for an arbitrary user id'
);

SELECT extensions.ok(
  NOT has_function_privilege('authenticated', 'public.mark_token_used(text,uuid,text,text)', 'EXECUTE'),
  'authenticated callers cannot transition invitation state directly'
);

SELECT extensions.is(
  public.check_email_registered('security-regression@example.invalid'),
  false,
  'email availability helper cannot enumerate Auth accounts'
);

SELECT * FROM extensions.finish();
ROLLBACK;
