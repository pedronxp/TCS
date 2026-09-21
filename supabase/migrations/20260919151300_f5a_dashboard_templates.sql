-- ============================================================
-- F5 — Templates de dashboard por organização × papel
-- layout JSONB: [{widget, visivel, ordem, config?}]
-- organization_id NULL = template global (owner/master)
-- Precedência: (org, papel) > (global, papel) > default em código
-- (Aplicada via MCP; este arquivo espelha o remoto)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.dashboard_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'agent'
    CHECK (role IN ('agent','supervisor','admin')),
  layout          jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_por      uuid,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS dashboard_templates_org_role_idx
  ON public.dashboard_templates (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), role);

ALTER TABLE public.dashboard_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY dashboard_templates_read ON public.dashboard_templates
FOR SELECT TO authenticated
USING (
  is_approved()
  AND (
    organization_id IS NULL
    OR organization_id IN (SELECT my_organization_ids())
    OR get_my_role() = ANY (ARRAY['owner','master_admin','developer'])
  )
);

CREATE OR REPLACE FUNCTION public.get_dashboard_layout(p_role text DEFAULT 'agent')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_org uuid;
  v_layout jsonb;
BEGIN
  SELECT organization_id INTO v_org FROM public.organization_members
  WHERE user_id = auth.uid() AND status='active' ORDER BY created_at LIMIT 1;

  IF v_org IS NOT NULL THEN
    SELECT layout INTO v_layout FROM public.dashboard_templates
    WHERE organization_id = v_org AND role = p_role;
    IF FOUND THEN RETURN v_layout; END IF;
  END IF;

  SELECT layout INTO v_layout FROM public.dashboard_templates
  WHERE organization_id IS NULL AND role = p_role;
  IF FOUND THEN RETURN v_layout; END IF;

  RETURN '[]'::jsonb;
END $$;
REVOKE ALL ON FUNCTION public.get_dashboard_layout(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_layout(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_dashboard_layout(p_role text, p_layout jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_role text; v_org uuid;
BEGIN
  SELECT u.role INTO v_role FROM public.users u
  WHERE u.uid = auth.uid() AND coalesce(u."isApproved", false);
  IF v_role NOT IN ('admin','master_admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

  IF p_role NOT IN ('agent','supervisor','admin') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(p_layout) <> 'array' OR jsonb_array_length(p_layout) > 30 THEN
    RAISE EXCEPTION 'invalid_layout' USING ERRCODE='22023'; END IF;

  SELECT organization_id INTO v_org FROM public.organization_members
  WHERE user_id = auth.uid() AND status='active' ORDER BY created_at LIMIT 1;
  IF v_org IS NULL AND v_role <> 'master_admin' THEN
    RAISE EXCEPTION 'no_organization' USING ERRCODE='42501'; END IF;

  INSERT INTO public.dashboard_templates (organization_id, role, layout, criado_por)
  VALUES (v_org, p_role, p_layout, auth.uid())
  ON CONFLICT ((coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)), role)
  DO UPDATE SET layout = EXCLUDED.layout, atualizado_em = now();
END $$;
REVOKE ALL ON FUNCTION public.save_dashboard_layout(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_dashboard_layout(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_dashboard_layout_global(p_role text, p_layout jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT public.is_owner_admin() THEN RAISE EXCEPTION 'owner_only' USING ERRCODE='42501'; END IF;
  IF p_role NOT IN ('agent','supervisor','admin') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE='22023'; END IF;

  INSERT INTO public.dashboard_templates (organization_id, role, layout, criado_por)
  VALUES (NULL, p_role, p_layout, auth.uid())
  ON CONFLICT ((coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)), role)
  DO UPDATE SET layout = EXCLUDED.layout, atualizado_em = now();
END $$;
REVOKE ALL ON FUNCTION public.save_dashboard_layout_global(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_dashboard_layout_global(text,jsonb) TO authenticated;
