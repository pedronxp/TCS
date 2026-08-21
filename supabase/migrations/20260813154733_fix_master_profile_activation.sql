-- Keep the legacy public.users projection aligned with the normalized municipal hierarchy.
CREATE OR REPLACE FUNCTION public.activate_customer_profile_after_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    PERFORM set_config('tcs.customer_bootstrap_user_id', NEW.user_id::text, true);
    UPDATE public.users AS profile
    SET organization_id = NEW.organization_id,
        "isApproved" = true,
        municipio = organization.municipality_name,
        role = CASE
          WHEN NEW.role IN ('owner', 'coordinator', 'master', 'admin') THEN 'admin'
          WHEN NEW.role = 'supervisor' THEN 'supervisor'
          ELSE 'agent'
        END
    FROM public.organizations AS organization
    WHERE profile.uid = NEW.user_id
      AND organization.id = NEW.organization_id
      AND coalesce(profile."isApproved", false) = false;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_customer_profile_after_invite()
  FROM PUBLIC, anon, authenticated;
