-- Move only unambiguous active legacy invitations to the authoritative
-- organization invitation model. Admin/owner invitations and incomplete rows
-- are intentionally left for manual reconciliation.

ALTER TABLE public.subscription_settings
  ADD COLUMN IF NOT EXISTS legacy_invite_compatibility_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.invite_tokens
  ADD COLUMN IF NOT EXISTS migrated_to_organization_invite_id uuid
    REFERENCES public.organization_invites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS migration_review_reason text;

WITH eligible AS (
  SELECT
    legacy.codigo,
    legacy.organization_id,
    lower(trim(legacy.email_destinatario)) AS email,
    legacy.role,
    legacy."expiraEm" AS expires_at,
    legacy."criadoPor" AS created_by,
    encode(extensions.digest(upper(trim(legacy.codigo)), 'sha256'), 'hex') AS token_hash
  FROM public.invite_tokens AS legacy
  JOIN auth.users AS creator ON creator.id = legacy."criadoPor"
  WHERE coalesce(legacy.usado, false) = false
    AND legacy."expiraEm" > now()
    AND legacy.organization_id IS NOT NULL
    AND nullif(trim(legacy.email_destinatario), '') IS NOT NULL
    AND legacy.role IN ('supervisor', 'agent')
), inserted AS (
  INSERT INTO public.organization_invites (
    organization_id,
    token_hash,
    email,
    role,
    status,
    expires_at,
    created_by,
    created_at
  )
  SELECT
    organization_id,
    token_hash,
    email,
    role,
    'pending',
    expires_at,
    created_by,
    now()
  FROM eligible
  ON CONFLICT (token_hash) DO NOTHING
  RETURNING id, token_hash
)
UPDATE public.invite_tokens AS legacy
SET migrated_to_organization_invite_id = authoritative.id,
    migration_review_reason = NULL
FROM public.organization_invites AS authoritative
WHERE authoritative.token_hash = encode(
  extensions.digest(upper(trim(legacy.codigo)), 'sha256'),
  'hex'
)
  AND legacy.organization_id = authoritative.organization_id
  AND legacy.migrated_to_organization_invite_id IS NULL;

UPDATE public.invite_tokens AS legacy
SET migration_review_reason = CASE
  WHEN coalesce(legacy.usado, false) THEN 'already_used'
  WHEN legacy."expiraEm" IS NULL OR legacy."expiraEm" <= now() THEN 'expired_or_missing_expiry'
  WHEN legacy.organization_id IS NULL THEN 'organization_missing'
  WHEN nullif(trim(legacy.email_destinatario), '') IS NULL THEN 'recipient_email_missing'
  WHEN legacy."criadoPor" IS NULL
    OR NOT EXISTS (SELECT 1 FROM auth.users creator WHERE creator.id = legacy."criadoPor")
    THEN 'creator_identity_missing'
  WHEN legacy.role = 'admin' THEN 'admin_invite_requires_manual_review'
  WHEN legacy.role NOT IN ('supervisor', 'agent') OR legacy.role IS NULL THEN 'unsupported_role'
  ELSE 'migration_conflict'
END
WHERE legacy.migrated_to_organization_invite_id IS NULL
  AND legacy.migration_review_reason IS NULL;

CREATE OR REPLACE VIEW private.legacy_invite_migration_exceptions
WITH (security_invoker = true)
AS
SELECT
  codigo,
  organization_id,
  email_destinatario,
  role,
  "expiraEm" AS expires_at,
  migration_review_reason
FROM public.invite_tokens
WHERE migrated_to_organization_invite_id IS NULL
  AND coalesce(usado, false) = false;

REVOKE ALL ON private.legacy_invite_migration_exceptions FROM PUBLIC, anon, authenticated;

-- No client may create new legacy invitations. Existing eligible invitations
-- remain consumable only while the explicit compatibility switch is enabled.
REVOKE INSERT, UPDATE, DELETE ON public.invite_tokens FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.prepare_legacy_invite_signup(
  p_codigo text,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite public.invite_tokens%ROWTYPE;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_nonce text;
  v_expires_at timestamptz := now() + interval '15 minutes';
  v_role text;
  v_compatibility_enabled boolean;
BEGIN
  SELECT legacy_invite_compatibility_enabled
  INTO v_compatibility_enabled
  FROM public.subscription_settings
  WHERE singleton;

  IF NOT coalesce(v_compatibility_enabled, false) THEN
    RAISE EXCEPTION 'legacy_invitation_disabled' USING ERRCODE = '42501';
  END IF;
  IF p_codigo IS NULL OR trim(p_codigo) = '' OR v_email = '' THEN
    RAISE EXCEPTION 'invalid_invitation' USING ERRCODE = '22023';
  END IF;

  SELECT invitation.* INTO v_invite
  FROM public.invite_tokens AS invitation
  WHERE upper(trim(invitation.codigo)) = upper(trim(p_codigo))
  FOR UPDATE;

  IF NOT FOUND
     OR coalesce(v_invite.usado, false)
     OR (v_invite."expiraEm" IS NOT NULL AND v_invite."expiraEm" <= now()) THEN
    RAISE EXCEPTION 'invalid_invitation' USING ERRCODE = '22023';
  END IF;
  IF v_invite.email_destinatario IS NOT NULL
     AND lower(trim(v_invite.email_destinatario)) <> v_email THEN
    RAISE EXCEPTION 'invitation_email_mismatch' USING ERRCODE = '42501';
  END IF;

  v_role := coalesce(nullif(trim(v_invite.role), ''), 'agent');
  IF v_role NOT IN ('admin', 'supervisor', 'agent') THEN
    RAISE EXCEPTION 'invalid_invitation_role' USING ERRCODE = '42501';
  END IF;

  UPDATE private.signup_invite_claims
  SET status = CASE WHEN expires_at <= now() THEN 'expired' ELSE 'revoked' END
  WHERE legacy_invite_code = v_invite.codigo AND status = 'pending';

  v_nonce := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO private.signup_invite_claims (
    nonce_hash, legacy_invite_code, email, expires_at
  ) VALUES (
    encode(extensions.digest(v_nonce, 'sha256'), 'hex'),
    v_invite.codigo,
    v_email,
    v_expires_at
  );

  RETURN jsonb_build_object(
    'signup_claim_nonce', v_nonce,
    'expires_at', v_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_legacy_invite_signup(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_legacy_invite_signup(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.sync_migrated_legacy_invite_consumption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(OLD.usado, false) = false
     AND coalesce(NEW.usado, false) = true
     AND NEW.migrated_to_organization_invite_id IS NOT NULL
     AND NEW."usadoPorUid" IS NOT NULL THEN
    UPDATE public.organization_invites
    SET status = 'accepted',
        accepted_by = NEW."usadoPorUid",
        accepted_at = coalesce(NEW."usadoEm", now())
    WHERE id = NEW.migrated_to_organization_invite_id
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_migrated_legacy_invite_consumption()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS invite_tokens_sync_migrated_consumption ON public.invite_tokens;
CREATE TRIGGER invite_tokens_sync_migrated_consumption
AFTER UPDATE OF usado ON public.invite_tokens
FOR EACH ROW EXECUTE FUNCTION private.sync_migrated_legacy_invite_consumption();

COMMENT ON COLUMN public.subscription_settings.legacy_invite_compatibility_enabled IS
  'Temporary switch. Set false only after private.legacy_invite_migration_exceptions is reconciled and the compatibility window ends.';
