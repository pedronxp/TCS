-- ============================================================
-- F1 — Completar multi-tenancy
-- formularios isolados por org; org_id NULL = template do sistema (global)
-- system_logs / activity_logs: CONGELADAS (sem alteracao)
-- ============================================================

ALTER TABLE public.formularios ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.atribuicoes ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.audit_logs  ADD COLUMN IF NOT EXISTS organization_id UUID;

ALTER TABLE public.formularios
  ADD CONSTRAINT formularios_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.atribuicoes
  ADD CONSTRAINT atribuicoes_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

COMMENT ON COLUMN public.formularios.organization_id IS 'NULL = template do sistema (global, editavel apenas por master/owner/developer); preenchido = formulario isolado da org';

CREATE INDEX IF NOT EXISTS formularios_org_idx ON public.formularios(organization_id);
CREATE INDEX IF NOT EXISTS atribuicoes_org_idx ON public.atribuicoes(organization_id);
CREATE INDEX IF NOT EXISTS audit_logs_org_idx  ON public.audit_logs(organization_id);

CREATE OR REPLACE FUNCTION public.my_organization_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid() AND status = 'active'
$$;
REVOKE ALL ON FUNCTION public.my_organization_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_organization_ids() TO authenticated;

DROP POLICY IF EXISTS formularios_read_all    ON public.formularios;
DROP POLICY IF EXISTS formularios_admin_write ON public.formularios;
DROP POLICY IF EXISTS formularios_master_all  ON public.formularios;
DROP POLICY IF EXISTS formularios_insert_admin ON public.formularios;
DROP POLICY IF EXISTS formularios_update_admin ON public.formularios;
DROP POLICY IF EXISTS formularios_delete_admin ON public.formularios;

CREATE POLICY formularios_read ON public.formularios FOR SELECT
TO authenticated USING (
  is_approved()
  AND (ativo = true OR get_my_role() = ANY (ARRAY['admin','master_admin','owner','developer']))
  AND (
    get_my_role() = ANY (ARRAY['master_admin','owner','developer'])
    OR (
      organization_id IS NULL
      AND (municipio IS NULL OR municipio = get_my_municipio() OR get_my_role() = 'admin')
    )
    OR organization_id IN (SELECT my_organization_ids())
  )
);

CREATE POLICY formularios_insert ON public.formularios FOR INSERT
TO authenticated WITH CHECK (
  (
    get_my_role() = 'admin'
    AND organization_id IS NOT NULL
    AND organization_id IN (SELECT my_organization_ids())
  )
  OR get_my_role() = ANY (ARRAY['master_admin','owner','developer'])
);

CREATE POLICY formularios_update ON public.formularios FOR UPDATE
TO authenticated USING (
  (
    get_my_role() = 'admin'
    AND organization_id IN (SELECT my_organization_ids())
  )
  OR get_my_role() = ANY (ARRAY['master_admin','owner','developer'])
);

CREATE POLICY formularios_delete ON public.formularios FOR DELETE
TO authenticated USING (
  (
    get_my_role() = 'admin'
    AND organization_id IN (SELECT my_organization_ids())
  )
  OR get_my_role() = ANY (ARRAY['master_admin','owner','developer'])
);

CREATE POLICY atrib_org_members ON public.atribuicoes FOR ALL
TO authenticated USING (
  organization_id IS NOT NULL
  AND organization_id IN (SELECT my_organization_ids())
);

DROP POLICY IF EXISTS audit_logs_select_admin ON public.audit_logs;

CREATE POLICY audit_logs_select_admin ON public.audit_logs FOR SELECT
TO authenticated USING (
  get_my_role() = ANY (ARRAY['admin','coordenador'])
  AND (organization_id IS NULL OR organization_id IN (SELECT my_organization_ids()))
);
