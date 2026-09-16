-- Owner é a conta mestra da plataforma. Ela deve operar e consultar todas as
-- vistorias, independentemente de organização, município ou agente responsável.
--
-- A trava é adquirida antes de qualquer alteração de função ou política. Assim,
-- uma sincronização concorrente falha rápido com lock_not_available em vez de
-- formar um deadlock com a troca das políticas RLS.
BEGIN;
LOCK TABLE public.vistorias IN ACCESS EXCLUSIVE MODE NOWAIT;

CREATE OR REPLACE FUNCTION private.internal_permissions(p_role text)
RETURNS text[]
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_role
    WHEN 'owner' THEN ARRAY[
      'console.read', 'dashboard.executive.read', 'customer.read', 'customer.sensitive.read',
      'customer.write', 'commercial.read', 'commercial.write', 'support.read', 'support.write',
      'session.read', 'session.terminate', 'staff.read', 'staff.manage', 'audit.read',
      'technical.read', 'technical.write', 'build.request', 'build.approve', 'configuration.publish',
      'mobile.inspection.manage', 'mobile.map.read'
    ]::text[]
    WHEN 'developer' THEN ARRAY[
      'console.read', 'dashboard.technical.read', 'customer.read', 'customer.sensitive.request',
      'commercial.read', 'support.read', 'support.write', 'session.read', 'session.terminate',
      'audit.read', 'technical.read', 'technical.write', 'build.request', 'configuration.prepare'
    ]::text[]
    WHEN 'support' THEN ARRAY[]::text[]
    WHEN 'auditor' THEN ARRAY[]::text[]
    ELSE ARRAY[]::text[]
  END;
$$;

CREATE OR REPLACE FUNCTION private.is_active_internal_owner()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.internal_staff
    WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION private.is_active_internal_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_active_internal_owner() TO authenticated;

DROP POLICY IF EXISTS vistorias_portal_select ON public.vistorias;
DROP POLICY IF EXISTS vistorias_portal_insert ON public.vistorias;
DROP POLICY IF EXISTS vistorias_portal_update ON public.vistorias;
DROP POLICY IF EXISTS vistorias_portal_delete ON public.vistorias;

CREATE POLICY vistorias_portal_select ON public.vistorias FOR SELECT TO authenticated USING (
  (SELECT private.is_active_internal_owner())
  OR (
    NOT (SELECT private.is_active_internal_staff())
    AND (
      (SELECT private.is_owner_admin())
      OR (organization_id IS NOT NULL AND organization_id = (SELECT private.current_organization_id()) AND private.portal_agent_allowed(organization_id, "agenteUid"::text))
      OR (organization_id IS NULL AND "agenteUid"::text = (SELECT auth.uid()::text))
    )
  )
  OR ((SELECT private.can_read_own_mobile_field_data()) AND organization_id IS NULL AND "agenteUid"::text = (SELECT auth.uid()::text))
);

CREATE POLICY vistorias_portal_insert ON public.vistorias FOR INSERT TO authenticated WITH CHECK (
  (SELECT private.is_active_internal_owner())
  OR (
    NOT (SELECT private.is_active_internal_staff())
    AND ((SELECT private.is_owner_admin()) OR (organization_id IS NOT NULL AND organization_id = (SELECT private.current_organization_id()) AND private.portal_agent_allowed(organization_id, "agenteUid"::text)) OR (organization_id IS NULL AND "agenteUid"::text = (SELECT auth.uid()::text)))
  )
  OR ((SELECT private.can_manage_own_mobile_field_inspections()) AND organization_id IS NULL AND "agenteUid"::text = (SELECT auth.uid()::text))
);

CREATE POLICY vistorias_portal_update ON public.vistorias FOR UPDATE TO authenticated
USING (
  (SELECT private.is_active_internal_owner())
  OR (
    NOT (SELECT private.is_active_internal_staff())
    AND ((SELECT private.is_owner_admin()) OR (organization_id IS NOT NULL AND organization_id = (SELECT private.current_organization_id()) AND private.portal_agent_allowed(organization_id, "agenteUid"::text)) OR (organization_id IS NULL AND "agenteUid"::text = (SELECT auth.uid()::text)))
  )
  OR ((SELECT private.can_manage_own_mobile_field_inspections()) AND organization_id IS NULL AND "agenteUid"::text = (SELECT auth.uid()::text))
)
WITH CHECK (
  (SELECT private.is_active_internal_owner())
  OR (
    NOT (SELECT private.is_active_internal_staff())
    AND ((SELECT private.is_owner_admin()) OR (organization_id IS NOT NULL AND organization_id = (SELECT private.current_organization_id()) AND private.portal_agent_allowed(organization_id, "agenteUid"::text)) OR (organization_id IS NULL AND "agenteUid"::text = (SELECT auth.uid()::text)))
  )
  OR ((SELECT private.can_manage_own_mobile_field_inspections()) AND organization_id IS NULL AND "agenteUid"::text = (SELECT auth.uid()::text))
);

CREATE POLICY vistorias_portal_delete ON public.vistorias FOR DELETE TO authenticated USING (
  (SELECT private.is_active_internal_owner())
  OR (
    NOT (SELECT private.is_active_internal_staff())
    AND ((SELECT private.is_owner_admin()) OR (organization_id IS NOT NULL AND organization_id = (SELECT private.current_organization_id()) AND private.portal_agent_allowed(organization_id, "agenteUid"::text)) OR (organization_id IS NULL AND "agenteUid"::text = (SELECT auth.uid()::text)))
  )
  OR ((SELECT private.can_manage_own_mobile_field_inspections()) AND organization_id IS NULL AND "agenteUid"::text = (SELECT auth.uid()::text))
);

-- A trava de escopo de campo continua protegendo os demais colaboradores
-- internos; a conta owner é a exceção explícita de administração global.
CREATE OR REPLACE FUNCTION private.enforce_internal_mobile_field_inspection_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_active_internal_staff() OR private.is_active_internal_owner() THEN
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
  IF TG_OP = 'UPDATE' AND (OLD.organization_id IS NOT NULL OR OLD."agenteUid"::text IS DISTINCT FROM auth.uid()::text) THEN
    RAISE EXCEPTION 'mobile_inspection_scope_violation' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

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

  IF private.is_active_internal_owner() THEN RETURN true; END IF;
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

-- Restaura a matriz vigente do console e acrescenta somente as capacidades
-- mobile globais exclusivas do owner.
CREATE OR REPLACE FUNCTION private.internal_permissions(p_role text)
RETURNS text[]
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT private.internal_permissions_before_whatsapp(p_role)
    || CASE p_role
      WHEN 'owner' THEN ARRAY['whatsapp.read', 'whatsapp.recover', 'whatsapp.manage']::text[]
      WHEN 'developer' THEN ARRAY['whatsapp.read', 'whatsapp.recover', 'whatsapp.manage']::text[]
      WHEN 'support' THEN ARRAY['whatsapp.read', 'whatsapp.recover']::text[]
      WHEN 'auditor' THEN ARRAY['whatsapp.read']::text[]
      ELSE ARRAY[]::text[]
    END
    || CASE WHEN p_role = 'owner'
      THEN ARRAY['mobile.inspection.manage', 'mobile.map.read']::text[]
      ELSE ARRAY[]::text[]
    END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
