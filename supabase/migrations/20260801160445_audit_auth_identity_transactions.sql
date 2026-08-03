-- Audit credential and provider identity mutations in the same database
-- transaction that changes Auth. A failed authoritative audit therefore aborts
-- the identity/password mutation instead of being silently ignored by a client.

CREATE OR REPLACE FUNCTION private.audit_google_auth_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_organization_id uuid;
  v_is_link boolean;
BEGIN
  IF NEW.provider <> 'google' THEN
    RETURN NEW;
  END IF;

  SELECT member.organization_id
  INTO v_organization_id
  FROM public.organization_members AS member
  WHERE member.user_id = NEW.user_id
    AND member.status = 'active'
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM auth.identities AS identity
    WHERE identity.user_id = NEW.user_id
      AND identity.provider <> 'google'
  ) INTO v_is_link;

  INSERT INTO public.subscription_audit_events (
    organization_id,
    actor_id,
    event_type,
    entity_type,
    entity_id,
    outcome,
    source,
    metadata
  ) VALUES (
    v_organization_id,
    NEW.user_id,
    CASE WHEN v_is_link THEN 'google_identity_linked' ELSE 'google_identity_created' END,
    'auth_identity',
    NEW.id::text,
    'allowed',
    'auth_trigger',
    jsonb_build_object('provider', 'google', 'linked_to_existing_identity', v_is_link)
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.audit_google_auth_identity()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS auth_identity_google_audit ON auth.identities;
CREATE TRIGGER auth_identity_google_audit
AFTER INSERT ON auth.identities
FOR EACH ROW
WHEN (NEW.provider = 'google')
EXECUTE FUNCTION private.audit_google_auth_identity();

CREATE OR REPLACE FUNCTION private.audit_password_credential_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_organization_id uuid;
BEGIN
  SELECT member.organization_id
  INTO v_organization_id
  FROM public.organization_members AS member
  WHERE member.user_id = NEW.id
    AND member.status = 'active'
  LIMIT 1;

  INSERT INTO public.subscription_audit_events (
    organization_id,
    actor_id,
    event_type,
    entity_type,
    entity_id,
    outcome,
    source,
    metadata
  ) VALUES (
    v_organization_id,
    NEW.id,
    'password_credential_changed',
    'customer_identity',
    NEW.id::text,
    'allowed',
    'auth_trigger',
    jsonb_build_object('credential', 'password')
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.audit_password_credential_change()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS auth_user_password_audit ON auth.users;
CREATE TRIGGER auth_user_password_audit
AFTER UPDATE OF encrypted_password ON auth.users
FOR EACH ROW
WHEN (
  OLD.encrypted_password IS DISTINCT FROM NEW.encrypted_password
  AND NEW.encrypted_password IS NOT NULL
)
EXECUTE FUNCTION private.audit_password_credential_change();

COMMENT ON FUNCTION private.audit_google_auth_identity() IS
  'Authoritative same-transaction audit for Google identity creation/linking.';
COMMENT ON FUNCTION private.audit_password_credential_change() IS
  'Authoritative same-transaction audit for password credential changes; recovery context is recorded by the recovery RPC.';
