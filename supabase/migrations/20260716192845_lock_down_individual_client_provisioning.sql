-- Defense in depth: the policy already denies anonymous reads, but table
-- privileges are also removed explicitly so anon never reaches RLS here.
REVOKE ALL ON TABLE public.individual_client_provisioning FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.individual_client_provisioning TO authenticated;

CREATE OR REPLACE FUNCTION private.strip_individual_provisioning_audit_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.action = 'customer.individual.provision' THEN
    NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) - 'email';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.strip_individual_provisioning_audit_email() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER strip_individual_provisioning_audit_email
BEFORE INSERT OR UPDATE OF metadata ON public.internal_access_events
FOR EACH ROW
EXECUTE FUNCTION private.strip_individual_provisioning_audit_email();
