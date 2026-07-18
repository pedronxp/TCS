-- Contas explicitamente marcadas pelo administrador como locais podem autenticar
-- e consultar dados de apoio, mas não podem gerar dados operacionais remotos.
CREATE OR REPLACE FUNCTION private.is_local_test_account()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (NULLIF(auth.jwt() -> 'app_metadata' ->> 'local_test_mode', ''))::boolean,
    false
  );
$$;

REVOKE ALL ON FUNCTION private.is_local_test_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_local_test_account() TO authenticated;

DROP POLICY IF EXISTS vistorias_block_local_test_insert ON public.vistorias;
CREATE POLICY vistorias_block_local_test_insert
ON public.vistorias AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (NOT (SELECT private.is_local_test_account()));

DROP POLICY IF EXISTS vistorias_block_local_test_update ON public.vistorias;
CREATE POLICY vistorias_block_local_test_update
ON public.vistorias AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (NOT (SELECT private.is_local_test_account()))
WITH CHECK (NOT (SELECT private.is_local_test_account()));

DROP POLICY IF EXISTS vistorias_block_local_test_delete ON public.vistorias;
CREATE POLICY vistorias_block_local_test_delete
ON public.vistorias AS RESTRICTIVE
FOR DELETE TO authenticated
USING (NOT (SELECT private.is_local_test_account()));

DROP POLICY IF EXISTS storage_block_local_test_insert ON storage.objects;
CREATE POLICY storage_block_local_test_insert
ON storage.objects AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (NOT (SELECT private.is_local_test_account()));

DROP POLICY IF EXISTS storage_block_local_test_update ON storage.objects;
CREATE POLICY storage_block_local_test_update
ON storage.objects AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (NOT (SELECT private.is_local_test_account()))
WITH CHECK (NOT (SELECT private.is_local_test_account()));

DROP POLICY IF EXISTS storage_block_local_test_delete ON storage.objects;
CREATE POLICY storage_block_local_test_delete
ON storage.objects AS RESTRICTIVE
FOR DELETE TO authenticated
USING (NOT (SELECT private.is_local_test_account()));

CREATE OR REPLACE FUNCTION private.block_local_test_operational_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF private.is_local_test_account() THEN
    RAISE EXCEPTION 'local_test_account_write_blocked'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.block_local_test_operational_write() FROM PUBLIC;

DROP TRIGGER IF EXISTS block_local_test_vistorias ON public.vistorias;
CREATE TRIGGER block_local_test_vistorias
BEFORE INSERT OR UPDATE OR DELETE ON public.vistorias
FOR EACH ROW EXECUTE FUNCTION private.block_local_test_operational_write();

DROP TRIGGER IF EXISTS block_local_test_generated_documents ON public.generated_documents;
CREATE TRIGGER block_local_test_generated_documents
BEFORE INSERT OR UPDATE OR DELETE ON public.generated_documents
FOR EACH ROW EXECUTE FUNCTION private.block_local_test_operational_write();

DROP TRIGGER IF EXISTS block_local_test_acknowledgement_events ON public.document_acknowledgement_events;
CREATE TRIGGER block_local_test_acknowledgement_events
BEFORE INSERT OR UPDATE OR DELETE ON public.document_acknowledgement_events
FOR EACH ROW EXECUTE FUNCTION private.block_local_test_operational_write();

DROP TRIGGER IF EXISTS block_local_test_active_sessions ON public.active_sessions;
CREATE TRIGGER block_local_test_active_sessions
BEFORE INSERT OR UPDATE OR DELETE ON public.active_sessions
FOR EACH ROW EXECUTE FUNCTION private.block_local_test_operational_write();

DROP TRIGGER IF EXISTS block_local_test_users ON public.users;
CREATE TRIGGER block_local_test_users
BEFORE INSERT OR UPDATE OR DELETE ON public.users
FOR EACH ROW EXECUTE FUNCTION private.block_local_test_operational_write();

DROP TRIGGER IF EXISTS block_local_test_agendamentos ON public.agendamentos;
CREATE TRIGGER block_local_test_agendamentos
BEFORE INSERT OR UPDATE OR DELETE ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION private.block_local_test_operational_write();

DROP TRIGGER IF EXISTS block_local_test_activity_logs ON public.activity_logs;
CREATE TRIGGER block_local_test_activity_logs
BEFORE INSERT OR UPDATE OR DELETE ON public.activity_logs
FOR EACH ROW EXECUTE FUNCTION private.block_local_test_operational_write();

DROP TRIGGER IF EXISTS block_local_test_audit_logs ON public.audit_logs;
CREATE TRIGGER block_local_test_audit_logs
BEFORE INSERT OR UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION private.block_local_test_operational_write();
