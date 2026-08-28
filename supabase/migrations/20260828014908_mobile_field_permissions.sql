-- Mobile field access is explicit, audited and strictly personal. It is not a
-- role default: an internal user must receive an individual grant through the
-- existing manage_internal_staff_permissions flow.

CREATE OR REPLACE FUNCTION private.is_valid_internal_permission(p_permission text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_permission = ANY (ARRAY[
    'console.read', 'dashboard.executive.read', 'dashboard.technical.read',
    'customer.read', 'customer.sensitive.read', 'customer.sensitive.request', 'customer.write',
    'commercial.read', 'commercial.write', 'support.read', 'support.write',
    'session.read', 'session.terminate', 'staff.read', 'staff.manage', 'audit.read',
    'technical.read', 'technical.write', 'build.request', 'build.approve',
    'configuration.prepare', 'configuration.publish', 'protocol.read', 'protocol.rotate',
    'account.approve', 'account.lock', 'account.recover_invite',
    'token.manage', 'notification.manage', 'communication.manage',
    'whatsapp.read', 'whatsapp.recover', 'whatsapp.manage',
    'mobile.inspection.manage', 'mobile.map.read'
  ]::text[]);
$$;

CREATE OR REPLACE FUNCTION private.is_active_internal_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.internal_staff
    WHERE user_id = auth.uid() AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION private.can_read_own_mobile_field_data()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_active_internal_staff()
    AND (
      private.has_internal_permission('mobile.inspection.manage')
      OR private.has_internal_permission('mobile.map.read')
    );
$$;

CREATE OR REPLACE FUNCTION private.can_manage_own_mobile_field_inspections()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_active_internal_staff()
    AND private.has_internal_permission('mobile.inspection.manage');
$$;

REVOKE ALL ON FUNCTION private.is_active_internal_staff(),
  private.can_read_own_mobile_field_data(),
  private.can_manage_own_mobile_field_inspections() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_active_internal_staff(),
  private.can_read_own_mobile_field_data(),
  private.can_manage_own_mobile_field_inspections() TO authenticated;

-- Security-definer RPCs and direct table writes both pass through this trigger.
-- An internal field grant can never be used to put an inspection in an
-- organization or under another agent's identity.
CREATE OR REPLACE FUNCTION private.enforce_internal_mobile_field_inspection_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_active_internal_staff() THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF NOT private.can_manage_own_mobile_field_inspections() THEN
    RAISE EXCEPTION 'mobile_inspection_permission_required' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.organization_id IS NOT NULL OR OLD."agenteUid"::text IS DISTINCT FROM auth.uid()::text THEN
      RAISE EXCEPTION 'mobile_inspection_scope_violation' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.organization_id IS NOT NULL OR NEW."agenteUid"::text IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'mobile_inspection_scope_violation' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE'
    AND (OLD.organization_id IS NOT NULL OR OLD."agenteUid"::text IS DISTINCT FROM auth.uid()::text)
  THEN
    RAISE EXCEPTION 'mobile_inspection_scope_violation' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zy_vistorias_enforce_internal_mobile_scope ON public.vistorias;
CREATE TRIGGER zy_vistorias_enforce_internal_mobile_scope
BEFORE INSERT OR UPDATE OR DELETE ON public.vistorias
FOR EACH ROW EXECUTE FUNCTION private.enforce_internal_mobile_field_inspection_scope();

-- Existing generic owner-admin bypasses are retained for non-internal legacy
-- accounts. Active internal staff must instead pass one of the narrow rules
-- below, which keeps the mobile workspace separate from municipalities.
DROP POLICY IF EXISTS vistorias_portal_select ON public.vistorias;
DROP POLICY IF EXISTS vistorias_portal_insert ON public.vistorias;
DROP POLICY IF EXISTS vistorias_portal_update ON public.vistorias;
DROP POLICY IF EXISTS vistorias_portal_delete ON public.vistorias;

CREATE POLICY vistorias_portal_select ON public.vistorias FOR SELECT TO authenticated USING (
  (
    NOT (SELECT private.is_active_internal_staff())
    AND (
      (SELECT private.is_owner_admin())
      OR (
        organization_id IS NOT NULL
        AND organization_id = (SELECT private.current_organization_id())
        AND private.portal_agent_allowed(organization_id, "agenteUid"::text)
      )
      OR (organization_id IS NULL AND "agenteUid"::text = (SELECT auth.uid()::text))
    )
  )
  OR (
    (SELECT private.can_read_own_mobile_field_data())
    AND organization_id IS NULL
    AND "agenteUid"::text = (SELECT auth.uid()::text)
  )
);

CREATE POLICY vistorias_portal_insert ON public.vistorias FOR INSERT TO authenticated WITH CHECK (
  (
    NOT (SELECT private.is_active_internal_staff())
    AND (
      (SELECT private.is_owner_admin())
      OR (
        organization_id IS NOT NULL
        AND organization_id = (SELECT private.current_organization_id())
        AND private.portal_agent_allowed(organization_id, "agenteUid"::text)
      )
      OR (organization_id IS NULL AND "agenteUid"::text = (SELECT auth.uid()::text))
    )
  )
  OR (
    (SELECT private.can_manage_own_mobile_field_inspections())
    AND organization_id IS NULL
    AND "agenteUid"::text = (SELECT auth.uid()::text)
  )
);

CREATE POLICY vistorias_portal_update ON public.vistorias FOR UPDATE TO authenticated
USING (
  (
    NOT (SELECT private.is_active_internal_staff())
    AND (
      (SELECT private.is_owner_admin())
      OR (
        organization_id IS NOT NULL
        AND organization_id = (SELECT private.current_organization_id())
        AND private.portal_agent_allowed(organization_id, "agenteUid"::text)
      )
      OR (organization_id IS NULL AND "agenteUid"::text = (SELECT auth.uid()::text))
    )
  )
  OR (
    (SELECT private.can_manage_own_mobile_field_inspections())
    AND organization_id IS NULL
    AND "agenteUid"::text = (SELECT auth.uid()::text)
  )
)
WITH CHECK (
  (
    NOT (SELECT private.is_active_internal_staff())
    AND (
      (SELECT private.is_owner_admin())
      OR (
        organization_id IS NOT NULL
        AND organization_id = (SELECT private.current_organization_id())
        AND private.portal_agent_allowed(organization_id, "agenteUid"::text)
      )
      OR (organization_id IS NULL AND "agenteUid"::text = (SELECT auth.uid()::text))
    )
  )
  OR (
    (SELECT private.can_manage_own_mobile_field_inspections())
    AND organization_id IS NULL
    AND "agenteUid"::text = (SELECT auth.uid()::text)
  )
);

CREATE POLICY vistorias_portal_delete ON public.vistorias FOR DELETE TO authenticated USING (
  (
    NOT (SELECT private.is_active_internal_staff())
    AND (
      (SELECT private.is_owner_admin())
      OR (
        organization_id IS NOT NULL
        AND organization_id = (SELECT private.current_organization_id())
        AND private.portal_agent_allowed(organization_id, "agenteUid"::text)
      )
      OR (organization_id IS NULL AND "agenteUid"::text = (SELECT auth.uid()::text))
    )
  )
  OR (
    (SELECT private.can_manage_own_mobile_field_inspections())
    AND organization_id IS NULL
    AND "agenteUid"::text = (SELECT auth.uid()::text)
  )
);

-- The upload edge function calls this RPC using the caller's JWT. The legacy
-- administrative paths remain unchanged for non-internal users.
CREATE OR REPLACE FUNCTION public.authorize_inspection_upload(p_inspection_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile public.users;
  v_inspection public.vistorias;
  v_actor uuid := auth.uid();
  v_inspection_municipio text;
BEGIN
  IF v_actor IS NULL THEN RETURN false; END IF;
  SELECT * INTO v_profile FROM public.users WHERE uid = v_actor;
  SELECT * INTO v_inspection FROM public.vistorias WHERE id = p_inspection_id;
  IF v_profile.uid IS NULL OR v_profile."isApproved" IS NOT TRUE OR v_inspection.id IS NULL THEN
    RETURN false;
  END IF;

  IF private.is_active_internal_staff() THEN
    RETURN private.can_manage_own_mobile_field_inspections()
      AND v_inspection.organization_id IS NULL
      AND v_inspection."agenteUid"::text = v_actor::text;
  END IF;

  v_inspection_municipio := coalesce(v_inspection.municipio, v_inspection.municipio_agente, 'geral');
  RETURN v_inspection."agenteUid"::text = v_actor::text
    OR v_profile.role = 'master_admin'
    OR (v_profile.role = 'admin' AND v_profile.municipio = v_inspection_municipio);
END;
$$;
REVOKE ALL ON FUNCTION public.authorize_inspection_upload(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authorize_inspection_upload(uuid) TO authenticated;
