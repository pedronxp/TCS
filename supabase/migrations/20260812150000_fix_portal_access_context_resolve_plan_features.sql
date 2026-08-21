-- Corrige get_portal_access_context:
-- 1) Resolve plan_name a partir de plans.name (antes era NULL).
-- 2) Resolve features e limits da plan_version publicada (antes vinham vazios '{}').
-- 3) Trata plan_version_id NULL caindo para a versão publicada mais recente do plano.
-- 4) Mantém o mesmo shape de saída para não quebrar o cliente (parsePortalAccessContext).
-- Bug original: features='{}'::jsonb e plan_name=NULL mesmo com assinatura ativa,
-- então módulos do plano nunca eram liberados ao ativar/trocar de plano.
-- Aplicado em produção via MCP Supabase em 2026-08-12.

CREATE OR REPLACE FUNCTION public.get_portal_access_context()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
  WITH params AS (
    SELECT auth.uid() AS v_user
  ),
  resolved AS (
    SELECT
      profile.uid,
      profile.name,
      profile.email,
      sub.id AS sub_id,
      sub.status AS sub_status,
      sub.cancel_at_period_end AS sub_cancel,
      sub.plan_id,
      sub.plan_version_id,
      plan.code AS plan_code,
      plan.name AS plan_name
    FROM params
    JOIN public.users profile ON profile.uid = params.v_user
    LEFT JOIN LATERAL (
      SELECT * FROM public.subscriptions
      WHERE user_id = profile.uid
      ORDER BY created_at DESC
      LIMIT 1
    ) sub ON true
    LEFT JOIN public.plans plan ON plan.id = sub.plan_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.internal_staff staff
      WHERE staff.user_id = profile.uid AND staff.status = 'active'
    )
  ),
  plan_version AS (
    -- Preferencia: plan_version_id da subscription; senão, versão publicada mais recente do plano.
    SELECT pv.id
    FROM resolved r
    JOIN public.plan_versions pv ON pv.id = COALESCE(
      r.plan_version_id,
      (SELECT p2.id FROM public.plan_versions p2
       WHERE p2.plan_id = r.plan_id
       ORDER BY p2.published_at DESC NULLS LAST, p2.created_at DESC
       LIMIT 1)
    )
    WHERE r.plan_id IS NOT NULL
    LIMIT 1
  ),
  feature_agg AS (
    SELECT
      pvf.plan_version_id,
      jsonb_object_agg(pvf.feature_code, pvf.enabled) AS features
    FROM public.plan_version_features pvf
    JOIN plan_version pv ON pv.id = pvf.plan_version_id
    WHERE pvf.enabled IS NOT NULL
    GROUP BY pvf.plan_version_id
  ),
  limit_agg AS (
    SELECT
      pvl.plan_version_id,
      jsonb_object_agg(pvl.resource_code, pvl.hard_limit) AS limits
    FROM public.plan_version_limits pvl
    JOIN plan_version pv ON pv.id = pvl.plan_version_id
    GROUP BY pvl.plan_version_id
  )
  SELECT jsonb_build_object(
    'account_kind', 'individual',
    'user_id', r.uid,
    'display_name', COALESCE(NULLIF(trim(r.name), ''), r.email, 'Cliente TCS'),
    'organization_id', NULL,
    'organization_name', NULL,
    'role', NULL,
    'membership_status', NULL,
    'subscription_status', COALESCE(r.sub_status, 'none'),
    'cancel_at_period_end', COALESCE(r.sub_cancel, false),
    'plan_id', r.plan_id,
    'plan_version_id', r.plan_version_id,
    'plan_name', r.plan_name,
    'features', COALESCE(fa.features, '{}'::jsonb),
    'limits', COALESCE(la.limits, '{}'::jsonb),
    'usage', '{}'::jsonb,
    'permissions', jsonb_build_array(
      'dashboard.read', 'inspection.read', 'inspection.create', 'map.read',
      'appointment.read', 'document.read', 'report.read', 'usage.read',
      'billing.read', 'billing.manage', 'support.read', 'support.create',
      'profile.read', 'profile.manage'
    ),
    'creation_allowed', COALESCE(r.sub_status IN ('trial', 'active', 'grace'), false),
    'restriction_cause', CASE
      WHEN r.sub_id IS NULL THEN 'subscription_inactive'
      WHEN r.sub_status = 'past_due' THEN 'subscription_past_due'
      WHEN r.sub_status IN ('canceled', 'expired') THEN 'subscription_inactive'
      ELSE NULL
    END
  )
  FROM resolved r
  LEFT JOIN feature_agg fa ON fa.plan_version_id = COALESCE(r.plan_version_id, (SELECT id FROM plan_version))
  LEFT JOIN limit_agg la ON la.plan_version_id = COALESCE(r.plan_version_id, (SELECT id FROM plan_version));
$function$;

COMMENT ON FUNCTION public.get_portal_access_context() IS 'Devolve o contexto de acesso do portal individual: plano, features e limits resolvidos da plan_version ativa. Quando plan_version_id é NULL, cai para a versão publicada mais recente do plano.';
