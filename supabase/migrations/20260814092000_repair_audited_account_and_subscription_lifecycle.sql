-- CORREÇÃO P0/P1 — Fechamento de bypasses em ações de conta e ciclo de vida.
--
-- Bloqueios corrigidos:
-- 1. Remover/revogar set_user_approval(uuid, boolean) legado sem justificativa,
--    AAL2 ou operation_id. Só pode existir o fluxo auditado de 4 parâmetros.
-- 2. Bloquear/desbloquear não pode reutilizar isApproved de forma que desbloquear
--    uma conta pendente a aprove automaticamente (separar estado de bloqueio
--    do estado de aprovação).
-- 3. Plano retired é terminal; não pode voltar a draft/active.
-- 4. Upgrade/downgrade só aceita plano e versão ativos (status='active').
-- 5. Persistir pending_plan_version_id no agendamento; aplicar exatamente a
--    versão aceita, mesmo que o plano seja editado antes do fim do ciclo.

-- CORREÇÃO 1: Remover sobrecarga legada de set_user_approval(uuid, boolean).
-- A sobrecarga de 2 parâmetros permitia aprovar/reprovar sem justificativa,
-- AAL2 ou operation_id, violando o contrato de auditoria. Revogamos e deixamos
-- apenas a sobrecarga de 4 parâmetros já existente.
DROP FUNCTION IF EXISTS public.set_user_approval(uuid, boolean);

-- CORREÇÃO 2: Separar estado de bloqueio do estado de aprovação.
-- Adicionar coluna account_locked (boolean) para distinguir bloqueio administrativo
-- de aprovação pendente. Migrar lógica de set_account_lock_state para usar a nova
-- coluna. Contas com isApproved=false E account_locked=false são pendentes de
-- aprovação; contas com account_locked=true estão bloqueadas independentemente.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_locked boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS users_account_locked_idx
  ON public.users(account_locked) WHERE account_locked = true;

COMMENT ON COLUMN public.users.account_locked IS
  'Bloqueio administrativo via set_account_lock_state. Separado de isApproved (aprovação de cadastro). Conta bloqueada: account_locked=true; conta pendente: isApproved=false AND account_locked=false; conta ativa: isApproved=true AND account_locked=false.';

-- Reescrever set_account_lock_state para usar account_locked.
CREATE OR REPLACE FUNCTION public.set_account_lock_state(
  p_target_uid uuid,
  p_locked boolean,
  p_reason text,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_target text;
  v_before jsonb;
  v_after jsonb;
  v_hash text;
  v_prior_result jsonb;
BEGIN
  IF v_actor IS NULL OR p_target_uid IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_target_uid = v_actor THEN
    RAISE EXCEPTION 'cannot_change_own_lock' USING ERRCODE = '42501';
  END IF;
  IF char_length(trim(COALESCE(p_reason,''))) NOT BETWEEN 8 AND 500 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;
  IF NOT private.has_internal_permission('account.lock', v_actor) THEN
    RAISE EXCEPTION 'account_lock_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_aal2() THEN
    RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501';
  END IF;

  SELECT uid INTO v_target FROM public.users WHERE uid = p_target_uid FOR UPDATE;
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'target_profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_hash := md5(concat_ws('|', p_target_uid, p_locked, trim(p_reason)));
  SELECT io.result INTO v_prior_result FROM public.internal_operations io
  WHERE io.actor_id = v_actor AND io.operation_id = p_operation_id AND io.request_hash = v_hash;
  IF v_prior_result IS NOT NULL THEN RETURN v_prior_result; END IF;
  INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash)
  VALUES (p_operation_id, v_actor, 'account.lock', v_hash);

  v_before := jsonb_build_object(
    'isApproved', (SELECT "isApproved" FROM public.users WHERE uid = p_target_uid),
    'account_locked', (SELECT account_locked FROM public.users WHERE uid = p_target_uid)
  );

  -- CORREÇÃO 2: Usar account_locked explicitamente; não tocar em isApproved.
  UPDATE public.users SET account_locked = p_locked WHERE uid = p_target_uid;

  v_after := jsonb_build_object(
    'isApproved', (SELECT "isApproved" FROM public.users WHERE uid = p_target_uid),
    'account_locked', p_locked
  );

  INSERT INTO public.internal_access_events(
    actor_id, actor_role, action, target_type, target_id, result, reason, metadata
  ) VALUES (
    v_actor, private.current_internal_role(v_actor), 'account.lock',
    'user', p_target_uid::text, 'allowed', left(trim(p_reason),500),
    jsonb_build_object('before', v_before, 'after', v_after, 'locked', p_locked)
  );

  UPDATE public.internal_operations
  SET status = 'succeeded',
      result = jsonb_build_object('uid', p_target_uid, 'locked', p_locked),
      completed_at = now()
  WHERE actor_id = v_actor AND operation_id = p_operation_id;

  RETURN jsonb_build_object('uid', p_target_uid, 'locked', p_locked);
END;
$function$;

COMMENT ON FUNCTION public.set_account_lock_state(uuid, boolean, text, uuid) IS
  'Bloqueia/desbloqueia conta: account_locked = p_locked. Separado de isApproved (aprovação de cadastro). Exige account.lock + AAL2 + justificativa. Idempotente e auditado com before/after.';

-- CORREÇÃO 3: Plano retired é terminal; não pode voltar a draft/active.
-- A validação já existe em manage_plan_lifecycle; garantir consistência na descrição.
-- Nenhuma alteração de código necessária; o bloqueio já está em:
--   IF p_action = 'activate' AND (v_before->>'status') = 'retired' THEN
--     RAISE EXCEPTION 'retired_plan_cannot_be_reactivated' USING ERRCODE = '22023';
-- Mas adicionar validação para deactivate também (retired -> draft é inválido).
CREATE OR REPLACE FUNCTION public.manage_plan_lifecycle(
  p_plan_id uuid,
  p_action text,
  p_reason text,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_before jsonb;
  v_after text;
  v_hash text;
  v_prior jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_internal_permission('commercial.write', v_actor) THEN
    RAISE EXCEPTION 'commercial_write_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_aal2() THEN
    RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501';
  END IF;
  IF p_plan_id IS NULL THEN
    RAISE EXCEPTION 'plan_id_required' USING ERRCODE = '22023';
  END IF;
  IF p_action NOT IN ('activate','deactivate','retire') THEN
    RAISE EXCEPTION 'invalid_plan_action' USING ERRCODE = '22023';
  END IF;
  IF char_length(trim(COALESCE(p_reason,''))) NOT BETWEEN 8 AND 500 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  v_hash := md5(concat_ws('|', p_plan_id, p_action, trim(p_reason)));
  SELECT io.result INTO v_prior FROM public.internal_operations io
  WHERE io.actor_id = v_actor AND io.operation_id = p_operation_id AND io.request_hash = v_hash;
  IF v_prior IS NOT NULL THEN RETURN v_prior; END IF;
  IF p_operation_id IS NOT NULL THEN
    INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash)
    VALUES (p_operation_id, v_actor, 'plan.' || p_action, v_hash);
  END IF;

  SELECT jsonb_build_object('status', p.status, 'current_version', p.current_version)
  INTO v_before FROM public.plans p WHERE p.id = p_plan_id FOR UPDATE;
  IF v_before IS NULL THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- CORREÇÃO 3: retired é terminal; não pode voltar a active ou draft.
  IF (v_before->>'status') = 'retired' THEN
    RAISE EXCEPTION 'retired_plan_is_terminal' USING ERRCODE = '22023';
  END IF;

  UPDATE public.plans SET
    status = CASE p_action
               WHEN 'activate' THEN 'active'
               WHEN 'deactivate' THEN 'draft'
               WHEN 'retire' THEN 'retired'
             END,
    updated_at = now()
  WHERE id = p_plan_id RETURNING status INTO v_after;

  INSERT INTO public.internal_access_events(
    actor_id, actor_role, action, target_type, target_id, result, reason, metadata
  ) VALUES (
    v_actor, private.current_internal_role(v_actor), 'plan.' || p_action,
    'plan', p_plan_id::text, 'allowed', left(trim(p_reason),500),
    jsonb_build_object('before', v_before, 'after', jsonb_build_object('status', v_after),
                       'action', p_action)
  );

  IF p_operation_id IS NOT NULL THEN
    UPDATE public.internal_operations
    SET status = 'succeeded',
        result = jsonb_build_object('plan_id', p_plan_id, 'status', v_after, 'action', p_action),
        completed_at = now()
    WHERE actor_id = v_actor AND operation_id = p_operation_id;
  END IF;

  RETURN jsonb_build_object('plan_id', p_plan_id, 'status', v_after, 'action', p_action);
END;
$function$;

COMMENT ON FUNCTION public.manage_plan_lifecycle(uuid, text, text, uuid) IS
  'Ciclo de vida do plano: activate/deactivate/retire. Plano retired é terminal (não volta a active/draft); assinaturas ativas permanecem na versão histórica. Exige commercial.write + AAL2 + justificativa. Idempotente e auditado.';

-- CORREÇÃO 4: Upgrade/downgrade só aceita plano com status='active'.
-- A validação parcial já existe; reforçar para garantir que status='active'.
-- CORREÇÃO 5: Persistir pending_plan_version_id no agendamento.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS pending_plan_version_id uuid;
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_pending_plan_version_id_fkey;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_pending_plan_version_id_fkey
  FOREIGN KEY (pending_plan_version_id) REFERENCES public.plan_versions(id);

COMMENT ON COLUMN public.subscriptions.pending_plan_version_id IS
  'Versão exata do plano alvo no agendamento de downgrade. Garante que a versão aceita pelo usuário seja aplicada, mesmo que o plano seja editado antes do fim do ciclo.';

CREATE OR REPLACE FUNCTION public.manage_subscription_lifecycle(
  p_subscription_id uuid,
  p_action text,
  p_plan_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_operation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_prev public.subscriptions;
  v_target_plan public.plans;
  v_target_version uuid;
  v_after public.subscriptions;
  v_hash text;
  v_prior jsonb;
  v_org uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_internal_permission('commercial.write', v_actor) THEN
    RAISE EXCEPTION 'commercial_write_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_aal2() THEN
    RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501';
  END IF;
  IF p_subscription_id IS NULL THEN
    RAISE EXCEPTION 'subscription_id_required' USING ERRCODE = '22023';
  END IF;
  IF p_action NOT IN ('upgrade','downgrade','cancel','reactivate') THEN
    RAISE EXCEPTION 'invalid_subscription_lifecycle_action' USING ERRCODE = '22023';
  END IF;
  IF char_length(trim(COALESCE(p_reason,''))) NOT BETWEEN 8 AND 500 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;
  -- CORREÇÃO 4: upgrade/downgrade exigem plano ativo (status='active').
  IF p_action IN ('upgrade','downgrade') THEN
    IF p_plan_id IS NULL THEN
      RAISE EXCEPTION 'plan_id_required' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_target_plan FROM public.plans WHERE id = p_plan_id;
    IF v_target_plan.id IS NULL THEN
      RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'P0002';
    END IF;
    IF v_target_plan.status <> 'active' THEN
      RAISE EXCEPTION 'plan_must_be_active' USING ERRCODE = '42501';
    END IF;
    SELECT id INTO v_target_version FROM public.plan_versions
    WHERE plan_id = p_plan_id AND version = v_target_plan.current_version;
    IF v_target_version IS NULL THEN
      RAISE EXCEPTION 'plan_version_not_found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  v_hash := md5(concat_ws('|', p_subscription_id, p_action, COALESCE(p_plan_id::text,''), trim(p_reason)));
  SELECT io.result INTO v_prior FROM public.internal_operations io
  WHERE io.actor_id = v_actor AND io.operation_id = p_operation_id AND io.request_hash = v_hash;
  IF v_prior IS NOT NULL THEN RETURN v_prior; END IF;
  IF p_operation_id IS NOT NULL THEN
    INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash)
    VALUES (p_operation_id, v_actor, 'subscription.' || p_action, v_hash);
  END IF;

  SELECT * INTO v_prev FROM public.subscriptions
  WHERE id = p_subscription_id FOR UPDATE;
  IF v_prev.id IS NULL THEN
    RAISE EXCEPTION 'subscription_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Temporalidade das transições:
  IF p_action = 'upgrade' THEN
    -- Upgrade é IMEDIATO: troca plano e versão agora, mantém status ativo.
    UPDATE public.subscriptions SET
      plan_id = p_plan_id,
      plan_version_id = v_target_version,
      status = 'active',
      cancel_at_period_end = false,
      pending_action = NULL,
      pending_plan_id = NULL,
      pending_plan_version_id = NULL,
      canceled_at = NULL,
      updated_at = now()
    WHERE id = p_subscription_id RETURNING * INTO v_after;
  ELSIF p_action = 'downgrade' THEN
    -- CORREÇÃO 5: Downgrade diferido persiste pending_plan_version_id.
    UPDATE public.subscriptions SET
      pending_action = 'downgrade',
      pending_plan_id = p_plan_id,
      pending_plan_version_id = v_target_version,
      cancel_at_period_end = false,
      canceled_at = NULL,
      updated_at = now()
    WHERE id = p_subscription_id RETURNING * INTO v_after;
  ELSIF p_action = 'cancel' THEN
    -- Cancelamento ao fim do período: permanece ativo até current_period_end.
    UPDATE public.subscriptions SET
      cancel_at_period_end = true,
      pending_action = 'cancel',
      pending_plan_id = NULL,
      pending_plan_version_id = NULL,
      updated_at = now()
    WHERE id = p_subscription_id RETURNING * INTO v_after;
  ELSIF p_action = 'reactivate' THEN
    -- Reativar só faz sentido se há cancelamento agendado ou já cancelado.
    IF v_prev.cancel_at_period_end IS NOT TRUE
       AND v_prev.pending_action IS NULL
       AND v_prev.status <> 'canceled' THEN
      RAISE EXCEPTION 'nothing_to_reactivate' USING ERRCODE = '22023';
    END IF;
    UPDATE public.subscriptions SET
      cancel_at_period_end = false,
      pending_action = NULL,
      pending_plan_id = NULL,
      pending_plan_version_id = NULL,
      canceled_at = NULL,
      status = CASE WHEN v_prev.status = 'canceled' THEN 'active' ELSE status END,
      updated_at = now()
    WHERE id = p_subscription_id RETURNING * INTO v_after;
  END IF;

  v_org := COALESCE(v_after.organization_id, v_prev.organization_id);

  INSERT INTO public.subscription_audit_events(
    organization_id, actor_id, event_type, entity_type, entity_id, metadata
  ) VALUES (
    v_org, v_actor, 'subscription_' || p_action, 'subscription', p_subscription_id::text,
    jsonb_build_object(
      'reason', left(trim(p_reason),500),
      'action', p_action,
      'before', jsonb_build_object(
        'plan_id', v_prev.plan_id, 'plan_version_id', v_prev.plan_version_id,
        'status', v_prev.status, 'cancel_at_period_end', v_prev.cancel_at_period_end,
        'pending_action', v_prev.pending_action, 'pending_plan_id', v_prev.pending_plan_id,
        'pending_plan_version_id', v_prev.pending_plan_version_id
      ),
      'after', jsonb_build_object(
        'plan_id', v_after.plan_id, 'plan_version_id', v_after.plan_version_id,
        'status', v_after.status, 'cancel_at_period_end', v_after.cancel_at_period_end,
        'pending_action', v_after.pending_action, 'pending_plan_id', v_after.pending_plan_id,
        'pending_plan_version_id', v_after.pending_plan_version_id
      )
    )
  );

  INSERT INTO public.internal_access_events(
    actor_id, actor_role, action, target_type, target_id, result, reason, metadata
  ) VALUES (
    v_actor, private.current_internal_role(v_actor), 'subscription.' || p_action,
    'subscription', p_subscription_id::text, 'allowed', left(trim(p_reason),500),
    jsonb_build_object(
      'action', p_action,
      'before_plan_id', v_prev.plan_id, 'after_plan_id', v_after.plan_id,
      'cancel_at_period_end', v_after.cancel_at_period_end,
      'pending_plan_version_id', v_after.pending_plan_version_id
    )
  );

  IF p_operation_id IS NOT NULL THEN
    UPDATE public.internal_operations
    SET status = 'succeeded',
        result = jsonb_build_object('subscription_id', p_subscription_id, 'action', p_action,
                                    'status', v_after.status, 'plan_id', v_after.plan_id),
        completed_at = now()
    WHERE actor_id = v_actor AND operation_id = p_operation_id;
  END IF;

  RETURN jsonb_build_object(
    'subscription_id', p_subscription_id,
    'action', p_action,
    'status', v_after.status,
    'plan_id', v_after.plan_id,
    'plan_version_id', v_after.plan_version_id,
    'cancel_at_period_end', v_after.cancel_at_period_end,
    'pending_action', v_after.pending_action,
    'pending_plan_id', v_after.pending_plan_id,
    'pending_plan_version_id', v_after.pending_plan_version_id
  );
END;
$function$;

COMMENT ON FUNCTION public.manage_subscription_lifecycle(uuid, text, uuid, text, uuid) IS
  'Ciclo de vida da assinatura: upgrade (imediato), downgrade/cancel (ao fim do período corrente), reactivate. Upgrade/downgrade só aceita plano com status=active. Downgrade persiste pending_plan_version_id (versão exata aceita). Toda transição auditada em subscription_audit_events com before/after/reason. Exige commercial.write + AAL2 + justificativa. Idempotente via operation_id.';

-- CORREÇÃO 5: apply_pending_subscription_transitions aplica a versão persistida.
CREATE OR REPLACE FUNCTION public.apply_pending_subscription_transitions(
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_applied integer := 0;
  v_canceled integer := 0;
  v_downgraded integer := 0;
  v_row record;
BEGIN
  -- Apenas service_role (jobs de cobrança), nunca authenticated/anon.
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;

  FOR v_row IN
    SELECT id, pending_action, pending_plan_id, pending_plan_version_id, plan_version_id
    FROM public.subscriptions
    WHERE pending_action IS NOT NULL
      AND current_period_end IS NOT NULL
      AND current_period_end <= now()
      AND status NOT IN ('canceled','expired')
    ORDER BY current_period_end
    LIMIT LEAST(GREATEST(p_limit, 1), 500)
    FOR UPDATE SKIP LOCKED
  LOOP
    IF v_row.pending_action = 'cancel' THEN
      UPDATE public.subscriptions SET
        status = 'canceled',
        canceled_at = now(),
        cancel_at_period_end = false,
        pending_action = NULL,
        updated_at = now()
      WHERE id = v_row.id;
      v_canceled := v_canceled + 1;
    ELSIF v_row.pending_action = 'downgrade' THEN
      -- CORREÇÃO 5: Aplicar pending_plan_version_id se disponível; fallback para
      -- current_version do plano se não persistido (compatibilidade com assinaturas
      -- agendadas antes desta correção).
      UPDATE public.subscriptions SET
        plan_id = v_row.pending_plan_id,
        plan_version_id = COALESCE(v_row.pending_plan_version_id, (
          SELECT pv.id FROM public.plan_versions pv
          JOIN public.plans p ON p.id = pv.plan_id
          WHERE pv.plan_id = v_row.pending_plan_id AND pv.version = p.current_version
          LIMIT 1
        ), plan_version_id),
        pending_action = NULL,
        pending_plan_id = NULL,
        pending_plan_version_id = NULL,
        updated_at = now()
      WHERE id = v_row.id;
      v_downgraded := v_downgraded + 1;
    END IF;
    v_applied := v_applied + 1;
  END LOOP;

  RETURN jsonb_build_object('applied', v_applied, 'canceled', v_canceled, 'downgraded', v_downgraded);
END;
$function$;

COMMENT ON FUNCTION public.apply_pending_subscription_transitions(integer) IS
  'Job service_role: aplica downgrade/cancel agendados quando current_period_end passou. Garante temporalidade — transições só viram efetivas no fim do período, nunca antes. Aplica pending_plan_version_id (versão exata aceita pelo usuário).';
