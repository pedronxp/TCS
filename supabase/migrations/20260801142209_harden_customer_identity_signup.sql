-- Harden customer identity creation and keep the legacy mobile invitation flow
-- compatible without trusting user-editable Auth metadata for authorization.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;

ALTER TABLE public.subscription_settings
  ADD COLUMN IF NOT EXISTS hardened_auth_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS google_customer_auth_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_recovery_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS individual_bootstrap_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS municipal_bootstrap_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS authoritative_audit_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.subscription_settings.hardened_auth_enabled IS
  'Security baseline: Auth metadata never grants a customer or internal role.';

CREATE TABLE IF NOT EXISTS private.signup_invite_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce_hash text NOT NULL UNIQUE CHECK (nonce_hash ~ '^[0-9a-f]{64}$'),
  legacy_invite_code text NOT NULL,
  email text NOT NULL CHECK (email = lower(trim(email))),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'consumed', 'expired', 'revoked')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK (
    (status = 'consumed' AND consumed_at IS NOT NULL AND consumed_by IS NOT NULL)
    OR (status <> 'consumed' AND consumed_at IS NULL AND consumed_by IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS signup_invite_claims_one_pending_per_invite
  ON private.signup_invite_claims (legacy_invite_code)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS signup_invite_claims_expiry_idx
  ON private.signup_invite_claims (expires_at)
  WHERE status = 'pending';

REVOKE ALL ON TABLE private.signup_invite_claims FROM PUBLIC, anon, authenticated;

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
BEGIN
  IF p_codigo IS NULL OR trim(p_codigo) = '' OR v_email = '' THEN
    RAISE EXCEPTION 'invalid_invitation' USING ERRCODE = '22023';
  END IF;

  SELECT invitation.*
  INTO v_invite
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
  WHERE legacy_invite_code = v_invite.codigo
    AND status = 'pending';

  v_nonce := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO private.signup_invite_claims (
    nonce_hash,
    legacy_invite_code,
    email,
    expires_at
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

REVOKE ALL ON FUNCTION public.prepare_legacy_invite_signup(text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_legacy_invite_signup(text, text)
  TO anon, authenticated;

-- The old endpoint could bind any bearer invitation code to an arbitrary uid.
-- Invitation consumption now happens inside the auth.users insert transaction.
REVOKE ALL ON FUNCTION public.mark_token_used(text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  v_claim_nonce text := nullif(trim(v_meta->>'signup_claim_nonce'), '');
  v_claim private.signup_invite_claims%ROWTYPE;
  v_invite public.invite_tokens%ROWTYPE;
  v_email text := lower(trim(coalesce(NEW.email, '')));
  v_role text := 'agent';
  v_municipality text;
  v_organization_id uuid;
  v_approved boolean := false;
  v_name text;
  v_username text;
  v_phone text;
  v_member_role text;
BEGIN
  v_name := left(
    regexp_replace(
      coalesce(
        nullif(trim(v_meta->>'name'), ''),
        nullif(trim(v_meta->>'full_name'), ''),
        nullif(split_part(v_email, '@', 1), ''),
        'Cliente TCS'
      ),
      '[[:cntrl:]]', '', 'g'
    ),
    150
  );
  v_username := left(
    coalesce(
      nullif(regexp_replace(lower(v_meta->>'username'), '[^a-z0-9_.-]', '', 'g'), ''),
      nullif(regexp_replace(lower(split_part(v_email, '@', 1)), '[^a-z0-9_.-]', '', 'g'), ''),
      'cliente'
    ) || '-' || left(replace(NEW.id::text, '-', ''), 8),
    120
  );
  v_phone := nullif(left(regexp_replace(coalesce(v_meta->>'phone', ''), '[^0-9+]', '', 'g'), 20), '');

  IF v_claim_nonce IS NOT NULL THEN
    SELECT claim.*
    INTO v_claim
    FROM private.signup_invite_claims AS claim
    WHERE claim.nonce_hash = encode(extensions.digest(v_claim_nonce, 'sha256'), 'hex')
    FOR UPDATE;

    IF NOT FOUND OR v_claim.status <> 'pending' OR v_claim.expires_at <= now() THEN
      RAISE EXCEPTION 'invalid_or_expired_signup_claim' USING ERRCODE = '42501';
    END IF;
    IF v_email = '' OR v_claim.email <> v_email THEN
      RAISE EXCEPTION 'signup_claim_email_mismatch' USING ERRCODE = '42501';
    END IF;

    SELECT invitation.*
    INTO v_invite
    FROM public.invite_tokens AS invitation
    WHERE invitation.codigo = v_claim.legacy_invite_code
    FOR UPDATE;

    IF NOT FOUND
       OR coalesce(v_invite.usado, false)
       OR (v_invite."expiraEm" IS NOT NULL AND v_invite."expiraEm" <= now()) THEN
      RAISE EXCEPTION 'invalid_invitation' USING ERRCODE = '42501';
    END IF;
    IF v_invite.email_destinatario IS NOT NULL
       AND lower(trim(v_invite.email_destinatario)) <> v_email THEN
      RAISE EXCEPTION 'invitation_email_mismatch' USING ERRCODE = '42501';
    END IF;

    v_role := coalesce(nullif(trim(v_invite.role), ''), 'agent');
    IF v_role NOT IN ('admin', 'supervisor', 'agent') THEN
      RAISE EXCEPTION 'invalid_invitation_role' USING ERRCODE = '42501';
    END IF;
    v_municipality := nullif(trim(v_invite.municipio), '');
    v_organization_id := v_invite.organization_id;
    v_approved := v_role <> 'admin';
  END IF;

  INSERT INTO public.users (
    uid,
    name,
    username,
    email,
    phone,
    role,
    municipio,
    "isApproved",
    organization_id,
    "createdAt"
  ) VALUES (
    NEW.id,
    v_name,
    v_username,
    nullif(v_email, ''),
    v_phone,
    v_role,
    v_municipality,
    v_approved,
    v_organization_id,
    now()
  )
  ON CONFLICT (uid) DO NOTHING;

  IF v_claim_nonce IS NOT NULL THEN
    UPDATE public.invite_tokens
    SET usado = true,
        "usadoPorUid" = NEW.id,
        "usadoPorNome" = v_name,
        "usadoEm" = now(),
        usado_em = now()
    WHERE codigo = v_invite.codigo;

    UPDATE private.signup_invite_claims
    SET status = 'consumed',
        consumed_at = now(),
        consumed_by = NEW.id
    WHERE id = v_claim.id;

    -- The nonce is transport-only. Remove it before the surrounding signup
    -- transaction commits so it does not remain in user-editable metadata.
    UPDATE auth.users
    SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      - 'signup_claim_nonce'
    WHERE id = NEW.id;

    IF v_organization_id IS NOT NULL AND v_approved THEN
      v_member_role := CASE v_role
        WHEN 'supervisor' THEN 'supervisor'
        WHEN 'agent' THEN 'agent'
        ELSE 'coordinator'
      END;
      INSERT INTO public.organization_members (
        organization_id,
        user_id,
        role,
        status,
        joined_at
      ) VALUES (
        v_organization_id,
        NEW.id,
        v_member_role,
        'active',
        now()
      )
      ON CONFLICT (organization_id, user_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Permit only the exact neutral -> verified individual transition. All other
-- authorization fields remain server-managed.
CREATE OR REPLACE FUNCTION private.protect_user_authorization_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.is_owner_admin() THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.uid
     AND OLD.role = 'agent'
     AND coalesce(OLD."isApproved", false) = false
     AND OLD.municipio IS NULL
     AND OLD.organization_id IS NULL
     AND NEW.role = 'agent'
     AND NEW."isApproved" = true
     AND NEW.municipio IS NULL
     AND NEW.organization_id IS NULL
     AND EXISTS (
       SELECT 1
       FROM auth.users AS identity
       WHERE identity.id = OLD.uid
         AND identity.email IS NOT NULL
         AND identity.email_confirmed_at IS NOT NULL
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.internal_staff
       WHERE user_id = OLD.uid AND status = 'active'
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members
       WHERE user_id = OLD.uid AND status IN ('active', 'invited', 'suspended')
     ) THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.municipio IS DISTINCT FROM OLD.municipio
     OR NEW."isApproved" IS DISTINCT FROM OLD."isApproved" THEN
    RAISE EXCEPTION 'authorization_fields_are_server_managed' USING ERRCODE = '42501';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     AND NEW.organization_id IS DISTINCT FROM private.current_organization_id() THEN
    RAISE EXCEPTION 'organization_field_is_server_managed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.protect_user_authorization_fields()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.portal_ensure_individual_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_auth auth.users;
  v_profile public.users;
  v_name text;
  v_username text;
  v_created boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.internal_staff
    WHERE user_id = v_user AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'customer_identity_required' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = v_user AND status IN ('active', 'invited', 'suspended')
  ) THEN
    RETURN jsonb_build_object('created', false, 'reason', 'municipal_membership_exists');
  END IF;

  SELECT * INTO v_auth FROM auth.users WHERE id = v_user;
  IF v_auth.id IS NULL OR v_auth.email IS NULL OR v_auth.email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'verified_email_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_profile FROM public.users WHERE uid = v_user;
  IF v_profile.uid IS NOT NULL AND (
    v_profile.role IS DISTINCT FROM 'agent'
    OR v_profile.municipio IS NOT NULL
    OR v_profile.organization_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'neutral_customer_profile_required' USING ERRCODE = '42501';
  END IF;
  IF v_profile.uid IS NOT NULL AND coalesce(v_profile."isApproved", false) THEN
    RETURN jsonb_build_object('created', false, 'activated', false, 'reason', 'already_individual');
  END IF;

  v_created := v_profile.uid IS NULL;
  v_name := coalesce(
    nullif(trim(v_auth.raw_user_meta_data->>'name'), ''),
    nullif(trim(v_auth.raw_user_meta_data->>'full_name'), ''),
    split_part(v_auth.email, '@', 1)
  );
  v_username := left(
    coalesce(
      nullif(regexp_replace(lower(split_part(v_auth.email, '@', 1)), '[^a-z0-9_.-]', '', 'g'), ''),
      'cliente'
    ) || '-' || left(replace(v_user::text, '-', ''), 8),
    120
  );

  INSERT INTO public.users (
    uid, email, name, username, role, "isApproved", organization_id
  ) VALUES (
    v_user, lower(v_auth.email), left(v_name, 150), v_username, 'agent', true, NULL
  )
  ON CONFLICT (uid) DO UPDATE
  SET email = EXCLUDED.email,
      name = EXCLUDED.name,
      username = EXCLUDED.username,
      role = 'agent',
      municipio = NULL,
      "isApproved" = true,
      organization_id = NULL;

  RETURN jsonb_build_object(
    'created', v_created,
    'activated', true,
    'user_id', v_user
  );
END;
$$;

REVOKE ALL ON FUNCTION public.portal_ensure_individual_profile()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_ensure_individual_profile()
  TO authenticated;
