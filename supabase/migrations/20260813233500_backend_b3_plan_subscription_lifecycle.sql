-- ENTRADA B3 — Ciclo de vida de planos e assinaturas.
--
-- Princípios atendidos:
--  * Toda transição de estado ocorre no servidor/RPC, sob AAL2 e permissão
--    commercial.write; o navegador nunca altera diretamente estado confirmado
--    por provedor de pagamento.
--  * Plano com histórico NÃO é apagado: torna-se "retired" (arquivado). As
--    assinaturas existentes continuam apontando para a versão histórica
--    consumida (plan_version_id), preservando o contrato já vigente.
--  * Toda transição administrativa registra ator, alvo, justificativa,
--    estado anterior e novo estado em subscription_audit_events e em
--    internal_access_events (auditáveis).
--  * Temporalidade: upgrade é imediato; downgrade e cancelamento aplicam-se
--    ao fim do período corrente (cancel_at_period_end); reativação reverte
--    um cancelamento agendado.
--  * Idempotência via operation_id em internal_operations.

-- 1) Colunas de intenção diferida em subscriptions ----------------------
-- Para downgrade/cancelamento ao fim do período, registramos a intenção sem
-- aplicar imediatamente: pending_action ('downgrade'|'cancel'|NULL) e
-- pending_plan_id (plano alvo do downgrade). Um job/Edge Function de cobrança
-- consome essas intenções em current_period_end.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS pending_action text
    CHECK (pending_action IS NULL OR pending_action IN ('downgrade','cancel'));
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS pending_plan_id uuid;
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_pending_plan_id_fkey;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_pending_plan_id_fkey
  FOREIGN KEY (pending_plan_id) REFERENCES public.plans(id);

-- 2) Ciclo de vida do PLANO ---------------------------------------------
-- manage_plan_lifecycle: activate/deactivate/retire. Nunca apaga o plano ou
-- seu histórico de versões. "retire" arquiva: status='retired' e o plano
-- sai de novas vendas, mas assinaturas ativas permanecem apontando para a
-- versão histórica já consumida (plan_version_id é preservado por linha).
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

  -- Validar transições permitidas (não se reaproveita retired ativo).
  IF p_action = 'activate' AND (v_before->>'status') = 'retired' THEN
    RAISE EXCEPTION 'retired_plan_cannot_be_reactivated' USING ERRCODE = '22023';
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

REVOKE ALL ON FUNCTION public.manage_plan_lifecycle(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_plan_lifecycle(uuid, text, text, uuid) TO authenticated;

-- 3) Ciclo de vida da ASSINATURA ----------------------------------------
-- manage_subscription_lifecycle: upgrade|downgrade|cancel|reactivate.
--   upgrade    -> plan_id/plan_version_id trocados AGORA, status='active'.
--   downgrade  -> cancel_at_period_end=false; pending_action='downgrade';
--                 pending_plan_id=alvo. Aplicado ao fim do período pelo job
--                 de cobrança (fora deste escopo SQL).
--   cancel     -> cancel_at_period_end=true; pending_action='cancel'. A
--                 assinatura permanece ativa até current_period_end.
--   reactivate -> cancel_at_period_end=false; limpa intenções pendentes.
-- Toda transição é idempotente e auditada (subscription_audit_events com
-- before/after/reason em metadata + internal_access_events).
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
  -- upgrade/downgrade exigem plano alvo válido e não retired.
  IF p_action IN ('upgrade','downgrade') THEN
    IF p_plan_id IS NULL THEN
      RAISE EXCEPTION 'plan_id_required' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_target_plan FROM public.plans WHERE id = p_plan_id;
    IF v_target_plan.id IS NULL OR v_target_plan.status = 'retired' THEN
      RAISE EXCEPTION 'plan_not_available' USING ERRCODE = '42501';
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
      canceled_at = NULL,
      updated_at = now()
    WHERE id = p_subscription_id RETURNING * INTO v_after;
  ELSIF p_action = 'downgrade' THEN
    -- Downgrade diferido: aplica ao fim do período corrente. Registra a
    -- intenção sem alterar o plano vigente imediatamente.
    UPDATE public.subscriptions SET
      pending_action = 'downgrade',
      pending_plan_id = p_plan_id,
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
        'pending_action', v_prev.pending_action, 'pending_plan_id', v_prev.pending_plan_id
      ),
      'after', jsonb_build_object(
        'plan_id', v_after.plan_id, 'plan_version_id', v_after.plan_version_id,
        'status', v_after.status, 'cancel_at_period_end', v_after.cancel_at_period_end,
        'pending_action', v_after.pending_action, 'pending_plan_id', v_after.pending_plan_id
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
      'cancel_at_period_end', v_after.cancel_at_period_end
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
    'pending_plan_id', v_after.pending_plan_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.manage_subscription_lifecycle(uuid, text, uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_subscription_lifecycle(uuid, text, uuid, text, uuid) TO authenticated;

-- 4) Job de aplicação das intenções diferidas ---------------------------
-- apply_pending_subscription_transitions: aplica downgrade/cancel agendados
-- cujo current_period_end já passou. Executado por Edge Function/service_role
-- (não pelo navegador). Garante que a transição auditada só vira efetiva no
-- fim do período — nunca antes. Mantém o plan_version_id histórico quando
-- cancela (a assinatura registra o plano vigente, sem apagar histórico).
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
  v_target_version uuid;
BEGIN
  -- Apenas service_role (jobs de cobrança), nunca authenticated/anon.
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;

  FOR v_row IN
    SELECT id, pending_action, pending_plan_id, plan_version_id
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
      SELECT id INTO v_target_version FROM public.plan_versions
      WHERE plan_id = v_row.pending_plan_id
      ORDER BY version DESC LIMIT 1;
      UPDATE public.subscriptions SET
        plan_id = v_row.pending_plan_id,
        plan_version_id = COALESCE(v_target_version, plan_version_id),
        pending_action = NULL,
        pending_plan_id = NULL,
        updated_at = now()
      WHERE id = v_row.id;
      v_downgraded := v_downgraded + 1;
    END IF;
    v_applied := v_applied + 1;
  END LOOP;

  RETURN jsonb_build_object('applied', v_applied, 'canceled', v_canceled, 'downgraded', v_downgraded);
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_pending_subscription_transitions(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_pending_subscription_transitions(integer) TO service_role;

COMMENT ON FUNCTION public.manage_plan_lifecycle(uuid, text, text, uuid) IS
  'Ciclo de vida do plano: activate/deactivate/retire. Plano retired é arquivado (não apagado); assinaturas ativas permanecem na versão histórica. Exige commercial.write + AAL2 + justificativa. Idempotente e auditado.';
COMMENT ON FUNCTION public.manage_subscription_lifecycle(uuid, text, uuid, text, uuid) IS
  'Ciclo de vida da assinatura: upgrade (imediato), downgrade/cancel (ao fim do período corrente), reactivate. Toda transição auditada em subscription_audit_events com before/after/reason. Exige commercial.write + AAL2 + justificativa. Idempotente via operation_id.';
COMMENT ON FUNCTION public.apply_pending_subscription_transitions(integer) IS
  'Job service_role: aplica downgrade/cancel agendados quando current_period_end passou. Garante temporalidade — transições só viram efetivas no fim do período, nunca antes. Mantém plan_version_id histórico.';
