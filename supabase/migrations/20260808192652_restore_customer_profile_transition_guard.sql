-- Restore the final authorization transition guard after the legacy signup
-- hardening migration. It permits only server-scoped customer activation.
CREATE OR REPLACE FUNCTION private.protect_user_authorization_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.is_owner_admin() THEN RETURN NEW; END IF;

  -- Membership projection is performed only by the SECURITY DEFINER trigger
  -- that sets this transaction-scoped capability. It must also reconcile
  -- already-approved legacy profiles, not only neutral signups.
  IF current_setting('tcs.customer_bootstrap_user_id', true) = OLD.uid::text
     AND NEW."isApproved" = true
     AND NEW.municipio IS NOT NULL
     AND NEW.organization_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.organization_members AS membership
       JOIN public.organizations AS organization ON organization.id = membership.organization_id
       WHERE membership.user_id = OLD.uid
         AND membership.organization_id = NEW.organization_id
         AND membership.status = 'active'
         AND organization.municipality_name = NEW.municipio
         AND NEW.role = CASE
           WHEN membership.role IN ('owner', 'coordinator') THEN 'admin'
           WHEN membership.role = 'supervisor' THEN 'supervisor'
           ELSE 'agent'
         END
     ) THEN
    RETURN NEW;
  END IF;

  IF current_setting('tcs.customer_bootstrap_user_id', true) = OLD.uid::text
     AND coalesce(OLD."isApproved", false) = false
     AND OLD.role = 'agent'
     AND OLD.municipio IS NULL
     AND OLD.organization_id IS NULL
     AND NEW."isApproved" = true
     AND NEW.role = 'agent'
     AND NEW.municipio IS NULL
     AND NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF current_setting('tcs.customer_bootstrap_user_id', true) = OLD.uid::text
     AND coalesce(OLD."isApproved", false) = false
     AND NEW."isApproved" = true
     AND NEW.municipio IS NOT NULL
     AND NEW.organization_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.organization_members AS membership
       JOIN public.organizations AS organization ON organization.id = membership.organization_id
       WHERE membership.user_id = OLD.uid
         AND membership.organization_id = NEW.organization_id
         AND membership.status = 'active'
         AND organization.municipality_name = NEW.municipio
         AND NEW.role = CASE
           WHEN membership.role IN ('owner', 'coordinator') THEN 'admin'
           WHEN membership.role = 'supervisor' THEN 'supervisor'
           ELSE 'agent'
         END
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
