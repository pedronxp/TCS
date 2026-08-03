BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(5);

UPDATE public.subscription_settings
SET google_customer_auth_enabled = true,
    password_recovery_enabled = true,
    individual_bootstrap_enabled = true,
    municipal_bootstrap_enabled = true
WHERE singleton;

CREATE TEMP TABLE rollout_counts AS
SELECT
  (SELECT count(*) FROM auth.users) AS identities,
  (SELECT count(*) FROM public.organizations) AS organizations,
  (SELECT count(*) FROM public.organization_members) AS memberships,
  (SELECT count(*) FROM public.subscriptions) AS subscriptions,
  (SELECT count(*) FROM public.subscription_audit_events) AS audit_events;

UPDATE public.subscription_settings
SET google_customer_auth_enabled = false,
    password_recovery_enabled = false,
    individual_bootstrap_enabled = false,
    municipal_bootstrap_enabled = false
WHERE singleton;

SELECT extensions.ok(
  NOT google_customer_auth_enabled
  AND NOT password_recovery_enabled
  AND NOT individual_bootstrap_enabled
  AND NOT municipal_bootstrap_enabled,
  'rollback disables every public entry capability'
)
FROM public.subscription_settings WHERE singleton;
SELECT extensions.is((SELECT count(*) FROM auth.users), (SELECT identities FROM rollout_counts), 'rollback preserves Auth identities');
SELECT extensions.is((SELECT count(*) FROM public.organizations), (SELECT organizations FROM rollout_counts), 'rollback preserves organizations');
SELECT extensions.is((SELECT count(*) FROM public.organization_members), (SELECT memberships FROM rollout_counts), 'rollback preserves memberships');
SELECT extensions.ok(
  (SELECT count(*) FROM public.subscriptions) = (SELECT subscriptions FROM rollout_counts)
  AND (SELECT count(*) FROM public.subscription_audit_events) = (SELECT audit_events FROM rollout_counts),
  'rollback preserves subscriptions and authoritative audit'
);

SELECT * FROM extensions.finish();
ROLLBACK;
