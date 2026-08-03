-- Read-only migration inventory for customer identity and first administrator.
-- Run with an administrative database connection. It intentionally omits email,
-- names, inspection contents and invitation token hashes.

-- 1. Approved/legacy profiles without an organization membership.
SELECT
  profile.uid AS user_id,
  profile.role AS legacy_role,
  profile."isApproved" AS legacy_approved,
  profile.organization_id AS legacy_organization_id,
  CASE
    WHEN profile.role = 'agent' AND profile.organization_id IS NULL THEN 'possible_individual'
    WHEN profile.role IN ('admin', 'supervisor') THEN 'legacy_authority_without_membership'
    ELSE 'manual_review'
  END AS classification
FROM public.users AS profile
WHERE NOT EXISTS (
  SELECT 1
  FROM public.organization_members AS membership
  WHERE membership.user_id = profile.uid
    AND membership.status IN ('invited', 'active', 'suspended')
)
ORDER BY classification, profile.uid;

-- 2. Legacy administrators whose compatibility projection does not match the
-- canonical membership. Do not infer a replacement organization automatically.
SELECT
  profile.uid AS user_id,
  profile.role AS legacy_role,
  profile.organization_id AS legacy_organization_id,
  membership.organization_id AS membership_organization_id,
  membership.role AS membership_role,
  membership.status AS membership_status
FROM public.users AS profile
LEFT JOIN public.organization_members AS membership
  ON membership.user_id = profile.uid
 AND membership.status IN ('invited', 'active', 'suspended')
WHERE profile.role IN ('admin', 'supervisor')
  AND (
    membership.id IS NULL
    OR profile.organization_id IS DISTINCT FROM membership.organization_id
    OR profile.role IS DISTINCT FROM CASE
      WHEN membership.role IN ('owner', 'coordinator') THEN 'admin'
      WHEN membership.role = 'supervisor' THEN 'supervisor'
      ELSE 'agent'
    END
  )
ORDER BY profile.uid;

-- 3. Active invitations that need migration/reconciliation.
SELECT
  invitation.id,
  invitation.organization_id,
  invitation.role,
  invitation.status,
  invitation.expires_at,
  CASE WHEN invitation.expires_at <= now() THEN 'expire' ELSE 'preserve' END AS recommendation
FROM public.organization_invites AS invitation
WHERE invitation.status = 'pending'
ORDER BY invitation.expires_at;

-- 3b. Legacy invitations that could not be migrated automatically. Email and
-- bearer token are intentionally omitted from this operational summary.
SELECT
  legacy.organization_id,
  legacy.role,
  legacy."expiraEm" AS expires_at,
  legacy.migration_review_reason,
  count(*) AS invitation_count
FROM public.invite_tokens AS legacy
WHERE legacy.migrated_to_organization_invite_id IS NULL
  AND coalesce(legacy.usado, false) = false
GROUP BY legacy.organization_id, legacy.role, legacy."expiraEm", legacy.migration_review_reason
ORDER BY legacy.migration_review_reason, legacy.organization_id;

-- 4. Auth identities without a compatibility profile or authoritative context.
SELECT
  identity.id AS user_id,
  identity.created_at,
  identity.email_confirmed_at IS NOT NULL AS email_verified,
  EXISTS (
    SELECT 1 FROM auth.identities AS provider
    WHERE provider.user_id = identity.id AND provider.provider = 'google'
  ) AS has_google_identity,
  CASE
    WHEN bootstrap.id IS NOT NULL THEN 'bootstrap_present'
    WHEN membership.id IS NOT NULL THEN 'membership_present_profile_missing'
    ELSE 'orphan_identity'
  END AS classification
FROM auth.users AS identity
LEFT JOIN public.users AS profile ON profile.uid = identity.id
LEFT JOIN private.customer_bootstrap_states AS bootstrap ON bootstrap.user_id = identity.id
LEFT JOIN LATERAL (
  SELECT candidate.id
  FROM public.organization_members AS candidate
  WHERE candidate.user_id = identity.id
  LIMIT 1
) AS membership ON true
WHERE profile.uid IS NULL
ORDER BY classification, identity.created_at;
