-- Non-destructive emergency rollback for public customer entry. It prevents
-- new OAuth/recovery/bootstrap operations and preserves every identity,
-- membership, organization, subscription and audit event already committed.
BEGIN;
SET LOCAL lock_timeout = '5s';

UPDATE public.subscription_settings
SET google_customer_auth_enabled = false,
    password_recovery_enabled = false,
    individual_bootstrap_enabled = false,
    municipal_bootstrap_enabled = false
WHERE singleton;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.subscription_settings
    WHERE singleton
      AND (
        google_customer_auth_enabled
        OR password_recovery_enabled
        OR individual_bootstrap_enabled
        OR municipal_bootstrap_enabled
      )
  ) THEN
    RAISE EXCEPTION 'customer_public_entry_rollback_failed';
  END IF;
END;
$$;

COMMIT;

SELECT
  google_customer_auth_enabled,
  password_recovery_enabled,
  individual_bootstrap_enabled,
  municipal_bootstrap_enabled,
  hardened_auth_enabled,
  authoritative_audit_enabled,
  legacy_invite_compatibility_enabled
FROM public.subscription_settings
WHERE singleton;
