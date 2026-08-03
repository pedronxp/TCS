-- Minimal public capability discovery and authoritative completion events for
-- customer authentication. No account existence or customer data is exposed.

-- The former portal helper activated a verified identity without terms, plan,
-- idempotency or a trial transaction. All new activation uses bootstrap RPCs.
REVOKE ALL ON FUNCTION public.portal_ensure_individual_profile()
  FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.portal_ensure_individual_profile() IS
  'Deprecated: use bootstrap_individual_customer with terms and idempotency.';

-- Membership is authoritative. This compatibility trigger projects an active
-- membership into public.users so the existing mobile administration remains
-- available without treating public.users as the source of authority.
CREATE OR REPLACE FUNCTION private.sync_user_profile_from_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_organization public.organizations;
  v_legacy_role text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.internal_staff
    WHERE user_id = NEW.user_id AND status = 'active'
  ) THEN RETURN NEW; END IF;

  IF NEW.status <> 'active' THEN
    PERFORM set_config('tcs.customer_bootstrap_user_id', NEW.user_id::text, true);
    UPDATE public.users
    SET "isApproved" = false
    WHERE uid = NEW.user_id
      AND organization_id = NEW.organization_id;
    RETURN NEW;
  END IF;

  SELECT * INTO v_organization
  FROM public.organizations
  WHERE id = NEW.organization_id;
  IF v_organization.id IS NULL THEN RETURN NEW; END IF;

  v_legacy_role := CASE
    WHEN NEW.role IN ('owner', 'coordinator') THEN 'admin'
    WHEN NEW.role = 'supervisor' THEN 'supervisor'
    ELSE 'agent'
  END;
  PERFORM set_config('tcs.customer_bootstrap_user_id', NEW.user_id::text, true);
  UPDATE public.users
  SET role = v_legacy_role,
      municipio = v_organization.municipality_name,
      "isApproved" = true,
      organization_id = NEW.organization_id
  WHERE uid = NEW.user_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_user_profile_from_membership()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS organization_members_sync_legacy_profile
  ON public.organization_members;
CREATE TRIGGER organization_members_sync_legacy_profile
  AFTER INSERT OR UPDATE OF role, status, organization_id
  ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_user_profile_from_membership();

-- The original context treated every profile without membership as an
-- individual, even when it was neutral. Keep its mature permission logic behind
-- a guard that requires server approval.
ALTER FUNCTION public.get_portal_access_context()
  RENAME TO get_portal_access_context_approved;
REVOKE ALL ON FUNCTION public.get_portal_access_context_approved()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_portal_access_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE uid = v_user AND coalesce("isApproved", false)
  ) THEN
    RETURN NULL;
  END IF;
  RETURN public.get_portal_access_context_approved();
END;
$$;

REVOKE ALL ON FUNCTION public.get_portal_access_context()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_portal_access_context()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_auth_capabilities()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'google_auth', coalesce(settings.google_customer_auth_enabled, false),
    'password_recovery', coalesce(settings.password_recovery_enabled, false)
  )
  FROM public.subscription_settings AS settings
  WHERE settings.singleton
$$;

REVOKE ALL ON FUNCTION public.get_public_auth_capabilities()
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_auth_capabilities()
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_password_recovery_completed(
  p_other_sessions_revoked boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.subscription_audit_events(
    actor_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_user,
    'password_recovery_completed',
    'customer_identity',
    v_user::text,
    jsonb_build_object(
      'other_sessions_revoked', coalesce(p_other_sessions_revoked, false),
      'recorded_at_source', 'database'
    )
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_password_recovery_completed(boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_password_recovery_completed(boolean)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.record_google_identity_reconciled()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM auth.identities AS identity
    WHERE identity.user_id = v_user
      AND identity.provider = 'google'
  ) THEN
    RAISE EXCEPTION 'google_identity_required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.subscription_audit_events AS event
    WHERE event.actor_id = v_user
      AND event.event_type = 'google_identity_reconciled'
  ) THEN
    INSERT INTO public.subscription_audit_events(
      actor_id,
      event_type,
      entity_type,
      entity_id,
      metadata
    ) VALUES (
      v_user,
      'google_identity_reconciled',
      'customer_identity',
      v_user::text,
      jsonb_build_object('provider', 'google', 'recorded_at_source', 'database')
    );
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_google_identity_reconciled()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_google_identity_reconciled()
  TO authenticated;
