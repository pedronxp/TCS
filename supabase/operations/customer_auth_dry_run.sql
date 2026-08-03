-- Read-only preflight. Run after migrations in homologation with an
-- administrative connection. This script never infers or changes authority.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '2s';

SELECT
  current_database() AS database_name,
  now() AS checked_at,
  google_customer_auth_enabled,
  password_recovery_enabled,
  individual_bootstrap_enabled,
  municipal_bootstrap_enabled,
  legacy_invite_compatibility_enabled
FROM public.subscription_settings
WHERE singleton;

SELECT 'orphan_auth_identity' AS exception, count(*) AS total
FROM auth.users identity
LEFT JOIN public.users profile ON profile.uid = identity.id
WHERE profile.uid IS NULL
UNION ALL
SELECT 'profile_without_canonical_context', count(*)
FROM public.users profile
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_members member
  WHERE member.user_id = profile.uid AND member.status IN ('active', 'invited', 'suspended')
)
AND NOT EXISTS (
  SELECT 1 FROM private.customer_bootstrap_states bootstrap
  WHERE bootstrap.user_id = profile.uid
)
UNION ALL
SELECT 'legacy_invite_manual_review', count(*)
FROM public.invite_tokens legacy
WHERE legacy.migrated_to_organization_invite_id IS NULL
  AND coalesce(legacy.usado, false) = false
UNION ALL
SELECT 'multiple_active_organization_contexts', count(*)
FROM (
  SELECT user_id
  FROM public.organization_members
  WHERE status IN ('active', 'invited', 'suspended')
  GROUP BY user_id
  HAVING count(*) > 1
) ambiguous;

SELECT
  migration_review_reason,
  role,
  count(*) AS total
FROM public.invite_tokens
WHERE migrated_to_organization_invite_id IS NULL
  AND coalesce(usado, false) = false
GROUP BY migration_review_reason, role
ORDER BY migration_review_reason, role;

ROLLBACK;
