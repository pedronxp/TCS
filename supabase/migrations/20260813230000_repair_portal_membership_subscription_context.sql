-- ENTREGA A1 — Contexto de acesso tipado.
-- Repara e unifica get_portal_access_context para devolver um contrato estável
-- consumido pelo portal (e por SubscriptionContext via get_subscription_context):
-- organizationId, role, subscriptionStatus, creationAllowed, restrictionCause e
-- permissões efetivas de convite (invite_permissions).
--
-- Princípios:
-- - Supabase/RPC é a única fonte de autorização. O ator é derivado do servidor.
-- - Dono interno TCS (internal_staff) e Master municipal são papéis distintos:
--   contas internas ativas nunca recebem contexto de portal de cliente (NULL).
-- - trial, active e grace permitem criação. Sem assinatura, a consulta permanece
--   e o bloqueio é explícito apenas para operações de criação.
-- - Histórico de subscriptions é preservado: nenhum registro é apagado. A
--   assinatura "atual" é selecionada por ranking de status, nunca por exclusão.
--
-- Causas explícitas: subscription_inactive, subscription_past_due,
-- membership_inactive (esta última tem precedência sobre a assinatura, pois
-- um vínculo suspenso não autoriza criação mesmo com assinatura ativa).

CREATE OR REPLACE FUNCTION public.get_portal_access_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_profile public.users;
  v_member public.organization_members;
  v_org public.organizations;
  v_subscription public.subscriptions;
  v_plan public.plans;
  v_version public.plan_versions;
  v_permissions text[];
  v_features jsonb := '{}'::jsonb;
  v_limits jsonb := '{}'::jsonb;
  v_usage jsonb := '{}'::jsonb;
  v_creation_allowed boolean := false;
  v_restriction text;
  v_invite_permissions jsonb := jsonb_build_object(
    'can_invite', false,
    'target_roles', '[]'::jsonb
  );
  v_target_roles text[];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;

  -- Dono interno TCS é papel distinto: nunca recebe contexto de portal de cliente.
  IF EXISTS (
    SELECT 1 FROM public.internal_staff
    WHERE user_id = v_user AND status = 'active'
  ) THEN RETURN NULL; END IF;

  SELECT * INTO v_profile FROM public.users WHERE uid = v_user;
  IF v_profile.uid IS NULL OR NOT coalesce(v_profile."isApproved", false) THEN RETURN NULL; END IF;

  -- Afiliação municipal ativa é o caminho de autorização; invited/suspended
  -- aparecem apenas para expor o status no contrato, sem autorizar criação.
  SELECT * INTO v_member FROM public.organization_members
  WHERE user_id = v_user AND status IN ('active', 'invited', 'suspended')
  ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'invited' THEN 1 ELSE 2 END
  LIMIT 1;

  IF v_member.id IS NOT NULL THEN
    SELECT * INTO v_org FROM public.organizations WHERE id = v_member.organization_id;
    -- Assinatura atual da organização: ranking preserva histórico, não apaga nada.
    -- A parcial UNIQUE INDEX (subscriptions_one_current_org) já garante uma só
    -- assinatura "corrente" por organização dentre trial/active/grace/past_due.
    SELECT * INTO v_subscription FROM public.subscriptions
    WHERE organization_id = v_member.organization_id
    ORDER BY CASE status
        WHEN 'active' THEN 0 WHEN 'trial' THEN 1 WHEN 'grace' THEN 2
        WHEN 'past_due' THEN 3 ELSE 4
      END, created_at DESC
    LIMIT 1;
  ELSE
    -- Conta individual: a assinatura corrente do próprio usuário.
    SELECT * INTO v_subscription FROM public.subscriptions
    WHERE user_id = v_user
    ORDER BY CASE status
        WHEN 'active' THEN 0 WHEN 'trial' THEN 1 WHEN 'grace' THEN 2
        WHEN 'past_due' THEN 3 ELSE 4
      END, created_at DESC
    LIMIT 1;
  END IF;

  IF v_subscription.id IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.plans WHERE id = v_subscription.plan_id;
    -- Resolve a plan_version publicada: preferencia da subscription, senão a
    -- versão current_version do plano (compatibilidade com deployments legados).
    SELECT * INTO v_version FROM public.plan_versions
    WHERE id = coalesce(v_subscription.plan_version_id, (
      SELECT id FROM public.plan_versions
      WHERE plan_id = v_plan.id
      ORDER BY published_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    ));
    IF v_version.id IS NULL AND v_plan.id IS NOT NULL THEN
      SELECT * INTO v_version FROM public.plan_versions
      WHERE plan_id = v_plan.id AND version = v_plan.current_version;
    END IF;

    SELECT coalesce(jsonb_object_agg(feature_code, enabled), '{}'::jsonb) INTO v_features
    FROM public.plan_version_features WHERE plan_version_id = v_version.id;
    IF v_features = '{}'::jsonb AND v_plan.id IS NOT NULL THEN
      SELECT coalesce(jsonb_object_agg(feature_code, enabled), '{}'::jsonb) INTO v_features
      FROM public.plan_features WHERE plan_id = v_plan.id;
    END IF;

    SELECT coalesce(jsonb_object_agg(resource_code, hard_limit), '{}'::jsonb) INTO v_limits
    FROM public.plan_version_limits WHERE plan_version_id = v_version.id;
    IF v_limits = '{}'::jsonb AND v_plan.id IS NOT NULL THEN
      SELECT coalesce(jsonb_object_agg(resource_code, hard_limit), '{}'::jsonb) INTO v_limits
      FROM public.plan_limits WHERE plan_id = v_plan.id;
    END IF;

    SELECT coalesce(jsonb_object_agg(resource_code, consumed), '{}'::jsonb) INTO v_usage
    FROM public.usage_counters
    WHERE period_start = v_subscription.current_period_start
      AND (
        (v_member.id IS NULL AND user_id = v_user)
        OR (v_member.id IS NOT NULL AND organization_id = v_member.organization_id)
      );
  END IF;

  -- Permissões efetivas derivadas do servidor, nunca do metadata do cliente.
  IF v_member.id IS NULL THEN
    v_permissions := ARRAY[
      'dashboard.read','inspection.read','inspection.create','map.read',
      'appointment.read','document.read','report.read','usage.read',
      'billing.read','billing.manage','support.read','support.create',
      'profile.read','profile.manage'
    ];
  ELSIF v_member.role = 'master' THEN
    v_permissions := ARRAY[
      'dashboard.read','inspection.read','inspection.create','map.read',
      'appointment.read','document.read','report.read','team.read','team.manage',
      'invite.agent','invite.manage','usage.read','billing.read','billing.manage',
      'support.read','support.create','settings.read','settings.manage',
      'profile.read','profile.manage'
    ];
  ELSIF v_member.role = 'admin' THEN
    v_permissions := ARRAY[
      'dashboard.read','inspection.read','inspection.create','map.read',
      'appointment.read','document.read','report.read','team.read','team.manage',
      'invite.agent','invite.manage','usage.read','billing.read',
      'support.read','support.create','profile.read','profile.manage'
    ];
  ELSIF v_member.role = 'supervisor' THEN
    v_permissions := ARRAY[
      'dashboard.read','inspection.read','inspection.create','map.read',
      'appointment.read','document.read','report.read','team.read',
      'invite.agent','usage.read','support.read','support.create',
      'profile.read','profile.manage'
    ];
  ELSE
    v_permissions := ARRAY[
      'dashboard.read','inspection.read','inspection.create','map.read',
      'appointment.read','document.read','report.read',
      'support.read','support.create','profile.read','profile.manage'
    ];
  END IF;

  -- Permissões efetivas de convite espelham private.portal_invite_role_allowed,
  -- mas são derivadas aqui para o contrato tipado sem depender de chamada cruzada.
  IF v_member.id IS NOT NULL AND v_member.status = 'active' THEN
    IF v_member.role = 'master' THEN
      v_target_roles := ARRAY['admin', 'supervisor', 'agent'];
      v_invite_permissions := jsonb_build_object('can_invite', true, 'target_roles', to_jsonb(v_target_roles));
    ELSIF v_member.role = 'admin' THEN
      v_target_roles := ARRAY['supervisor', 'agent'];
      v_invite_permissions := jsonb_build_object('can_invite', true, 'target_roles', to_jsonb(v_target_roles));
    ELSIF v_member.role = 'supervisor' THEN
      v_target_roles := ARRAY['agent'];
      v_invite_permissions := jsonb_build_object('can_invite', true, 'target_roles', to_jsonb(v_target_roles));
    ELSE
      v_invite_permissions := jsonb_build_object('can_invite', false, 'target_roles', '[]'::jsonb);
    END IF;
  END IF;

  -- trial, active e grace permitem criação. membership_inactive tem precedência.
  v_creation_allowed := (v_member.id IS NULL OR v_member.status = 'active')
    AND coalesce(v_subscription.status IN ('trial', 'active', 'grace'), false);

  IF v_member.id IS NOT NULL AND v_member.status <> 'active' THEN
    v_restriction := 'membership_inactive';
  ELSIF v_subscription.id IS NULL OR v_subscription.status IN ('canceled', 'expired', 'none') THEN
    v_restriction := 'subscription_inactive';
  ELSIF v_subscription.status = 'past_due' THEN
    v_restriction := 'subscription_past_due';
  END IF;

  RETURN jsonb_build_object(
    'account_kind', CASE WHEN v_member.id IS NULL THEN 'individual' ELSE 'organization' END,
    'user_id', v_user,
    'display_name', coalesce(nullif(trim(v_profile.name), ''), v_profile.email, 'Cliente TCS'),
    'organization_id', v_member.organization_id,
    'organization_name', v_org.display_name,
    'role', v_member.role,
    'membership_status', v_member.status,
    'subscription_status', coalesce(v_subscription.status, 'none'),
    'cancel_at_period_end', coalesce(v_subscription.cancel_at_period_end, false),
    'plan_id', v_plan.id,
    'plan_version_id', v_version.id,
    'plan_name', v_plan.name,
    'features', v_features,
    'limits', v_limits,
    'usage', v_usage,
    'period_start', v_subscription.current_period_start,
    'period_end', v_subscription.current_period_end,
    'permissions', to_jsonb(v_permissions),
    'invite_permissions', v_invite_permissions,
    'creation_allowed', v_creation_allowed,
    'restriction_cause', v_restriction
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_portal_access_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_portal_access_context() TO authenticated;

COMMENT ON FUNCTION public.get_portal_access_context() IS
  'ENTREGA A1: contrato de acesso tipado. Devolve organizationId, role, subscriptionStatus, creationAllowed, restrictionCause e invite_permissions. Dono interno TCS não recebe contexto (NULL). Histórico de subscriptions preservado; assinatura atual via ranking de status. Causas: subscription_inactive, subscription_past_due, membership_inactive.';
