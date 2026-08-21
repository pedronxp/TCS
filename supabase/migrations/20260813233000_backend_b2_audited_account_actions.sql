-- ENTRADA B2 — Ações de conta internas auditadas.
--
-- Princípios atendidos:
--  * Toda autorização e transição de estado ocorre no servidor/RPC.
--  * Nenhuma senha é digitada por gestor: o reset vira um invite de
--    recuperação com token único (link enviado por Edge Function/mailer,
--    fora deste escopo SQL). A antiga internal_reset_password, que aceitava
--    senha em claro do gestor, deixa de ser chamável pelo navegador.
--  * Plano com histórico não é apagado; contas bloqueadas ficam
--    "isApproved=false" (lock reutiliza o estado existente, sem nova coluna).
--  * Toda alteração administrativa registra ator, alvo, justificativa,
--    estado anterior e novo estado em internal_access_events.
--
-- Permissões internas novas: account.approve, account.lock,
-- account.recover_invite. O owner interno tem as três; support tem
-- account.approve e account.recover_invite (capacidade de aprovar cadastro
-- pendente e de emitir invite de recuperação). developer/auditor não têm
-- ações de conta.

-- 1) Matriz de permissões interna estendida -------------------------------
-- Recria private.internal_permissions acrescentando as chaves de conta.
-- Mantém integralmente a matriz anterior (20260813202155) para não regredir
-- capabilities existentes (protocol.read/rotate, commercial.write do
-- developer, etc.).
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
      'protocol.read', 'protocol.rotate',
      'account.approve', 'account.lock', 'account.recover_invite'
    ]::text[]
    WHEN 'developer' THEN ARRAY[
      'console.read', 'dashboard.technical.read', 'customer.read', 'customer.sensitive.request',
      'commercial.read', 'commercial.write', 'support.read', 'support.write', 'session.read', 'session.terminate',
      'audit.read', 'technical.read', 'technical.write', 'build.request', 'configuration.prepare',
      'protocol.read', 'protocol.rotate'
    ]::text[]
    WHEN 'support' THEN ARRAY[
      'console.read', 'customer.read', 'commercial.read', 'support.read', 'support.write', 'protocol.read',
      'account.approve', 'account.recover_invite'
    ]::text[]
    WHEN 'auditor' THEN ARRAY['console.read', 'customer.read', 'commercial.read', 'audit.read', 'protocol.read']::text[]
    ELSE ARRAY[]::text[] END;
$$;

-- 2) Fila de aprovação + set_user_approval auditado -------------------------
-- Reescreve set_user_approval para:
--   * aceitar ator interno com permissão account.approve (AAL2) sobre qualquer
--     alvo municipal (fluxo do console interno);
--   * preservar o fluxo municipal vigente (master_admin/admin/supervisor do
--     mesmo município aprovando um agente);
--   * registrar idempotência em internal_operations e transição auditada
--     (before/after) em internal_access_events.
CREATE OR REPLACE FUNCTION public.set_user_approval(
  p_target_uid uuid,
  p_is_approved boolean,
  p_reason text DEFAULT NULL,
  p_operation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_actor_municipio text;
  v_actor_internal_role text;
  v_target_role text;
  v_target_municipio text;
  v_before jsonb;
  v_after jsonb;
  v_hash text;
  v_prior_result jsonb;
  v_is_internal boolean := false;
BEGIN
  IF v_actor IS NULL OR p_target_uid IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_target_uid = v_actor THEN
    RAISE EXCEPTION 'cannot_change_own_approval' USING ERRCODE = '42501';
  END IF;

  SELECT role, municipio INTO v_actor_role, v_actor_municipio
  FROM public.users WHERE uid = v_actor;
  SELECT role, municipio INTO v_target_role, v_target_municipio
  FROM public.users WHERE uid = p_target_uid FOR UPDATE;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'target_profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_actor_internal_role := private.current_internal_role(v_actor);
  v_is_internal := private.has_internal_permission('account.approve', v_actor)
                   AND private.has_aal2();

  IF v_is_internal THEN
    NULL; -- console interno autoriza qualquer alvo municipal.
  ELSIF v_actor_role = 'master_admin' AND v_target_role <> 'master_admin' THEN
    NULL;
  ELSIF v_actor_role IN ('admin', 'supervisor')
    AND v_target_role = 'agent'
    AND v_actor_municipio IS NOT NULL
    AND v_actor_municipio = v_target_municipio THEN
    NULL;
  ELSE
    -- Registra a tentativa negada para auditoria antes de recusar.
    INSERT INTO public.internal_access_events(
      actor_id, actor_role, action, target_type, target_id, result, reason, metadata
    ) VALUES (
      v_actor, COALESCE(v_actor_internal_role, v_actor_role), 'account.approve',
      'user', p_target_uid::text, 'denied', left(trim(COALESCE(p_reason,'')),500),
      jsonb_build_object('requested', p_is_approved)
    );
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Idempotência: mesma operação lógica retorna o mesmo resultado.
  v_hash := md5(concat_ws('|', p_target_uid, p_is_approved, trim(COALESCE(p_reason,''))));
  IF p_operation_id IS NOT NULL THEN
    SELECT io.result INTO v_prior_result FROM public.internal_operations io
    WHERE io.actor_id = v_actor AND io.operation_id = p_operation_id AND io.request_hash = v_hash;
    IF v_prior_result IS NOT NULL THEN RETURN v_prior_result; END IF;
    INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash)
    VALUES (p_operation_id, v_actor, 'account.approve', v_hash);
  END IF;

  v_before := jsonb_build_object('isApproved', (SELECT "isApproved" FROM public.users WHERE uid = p_target_uid));

  PERFORM set_config('tcs.server_approval_target', p_target_uid::text, true);
  UPDATE public.users SET "isApproved" = p_is_approved WHERE uid = p_target_uid;

  v_after := jsonb_build_object('isApproved', p_is_approved);

  INSERT INTO public.internal_access_events(
    actor_id, actor_role, action, target_type, target_id, result, reason, metadata
  ) VALUES (
    v_actor, COALESCE(v_actor_internal_role, v_actor_role), 'account.approve',
    'user', p_target_uid::text, 'allowed',
    left(trim(COALESCE(p_reason,'')),500),
    jsonb_build_object('before', v_before, 'after', v_after, 'internal_console', v_is_internal)
  );

  IF p_operation_id IS NOT NULL THEN
    UPDATE public.internal_operations
    SET status = 'succeeded', result = jsonb_build_object('uid', p_target_uid, 'isApproved', p_is_approved), completed_at = now()
    WHERE actor_id = v_actor AND operation_id = p_operation_id;
  END IF;

  RETURN jsonb_build_object('uid', p_target_uid, 'isApproved', p_is_approved);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_user_approval(uuid, boolean, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_approval(uuid, boolean, text, uuid) TO authenticated;

-- 3) Lock/unblock de conta -------------------------------------------------
-- Reaproveita "isApproved=false" como estado de bloqueio (sem nova coluna).
-- Apenas ator interno com account.lock (owner) pode bloquear/desbloquear
-- contas municipais. Toda transição é idempotente e auditada.
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

  v_before := jsonb_build_object('isApproved', (SELECT "isApproved" FROM public.users WHERE uid = p_target_uid));

  PERFORM set_config('tcs.server_approval_target', p_target_uid::text, true);
  UPDATE public.users SET "isApproved" = (NOT p_locked) WHERE uid = p_target_uid;

  v_after := jsonb_build_object('isApproved', (NOT p_locked));

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

REVOKE ALL ON FUNCTION public.set_account_lock_state(uuid, boolean, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_account_lock_state(uuid, boolean, text, uuid) TO authenticated;

-- 4) Invite de recuperação de senha (nunca senha do gestor) ----------------
CREATE TABLE IF NOT EXISTS public.account_recovery_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  issued_by uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS account_recovery_invites_target_idx
  ON public.account_recovery_invites(target_user_id, created_at DESC);

ALTER TABLE public.account_recovery_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_recovery_invites FROM PUBLIC, anon, authenticated;

-- O token em claro é devolvido uma única vez ao chamador autorizado para que
-- a Edge Function/mailer envie o link. O banco guarda apenas o hash (sha256).
-- A senha nunca é informada pelo gestor: o cliente redefine no consumo do link.
CREATE OR REPLACE FUNCTION public.internal_send_password_recovery_invite(
  p_target_user_id uuid,
  p_reason text,
  p_operation_id uuid,
  p_ttl_hours integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_token text;
  v_token_hash text;
  v_invite_id uuid;
  v_hash text;
  v_prior_result jsonb;
  v_email text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id_required' USING ERRCODE = '22023';
  END IF;
  IF char_length(trim(COALESCE(p_reason,''))) NOT BETWEEN 8 AND 500 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;
  IF p_ttl_hours < 1 OR p_ttl_hours > 168 THEN
    RAISE EXCEPTION 'invalid_ttl' USING ERRCODE = '22023';
  END IF;
  IF NOT private.has_internal_permission('account.recover_invite', v_actor) THEN
    RAISE EXCEPTION 'recover_invite_not_allowed' USING ERRCODE = '42501';
  END IF;
  IF NOT private.has_aal2() THEN
    RAISE EXCEPTION 'aal2_required' USING ERRCODE = '42501';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_target_user_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'target_user_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotência
  v_hash := md5(concat_ws('|', p_target_user_id, trim(p_reason), p_ttl_hours));
  SELECT io.result INTO v_prior_result FROM public.internal_operations io
  WHERE io.actor_id = v_actor AND io.operation_id = p_operation_id AND io.request_hash = v_hash;
  IF v_prior_result IS NOT NULL THEN RETURN v_prior_result; END IF;
  INSERT INTO public.internal_operations(operation_id, actor_id, action, request_hash)
  VALUES (p_operation_id, v_actor, 'account.recover_invite', v_hash);

  -- Invalida invites anteriores pendentes para o mesmo alvo.
  UPDATE public.account_recovery_invites
  SET consumed_at = now()
  WHERE target_user_id = p_target_user_id AND consumed_at IS NULL;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.account_recovery_invites(target_user_id, token_hash, issued_by, expires_at)
  VALUES (p_target_user_id, v_token_hash, v_actor, now() + make_interval(hours => p_ttl_hours))
  RETURNING id INTO v_invite_id;

  INSERT INTO public.internal_access_events(
    actor_id, actor_role, action, target_type, target_id, result, reason, metadata
  ) VALUES (
    v_actor, private.current_internal_role(v_actor), 'account.recover_invite',
    'user', p_target_user_id::text, 'allowed', left(trim(p_reason),500),
    jsonb_build_object('invite_id', v_invite_id,
                       'expires_at', now() + make_interval(hours => p_ttl_hours))
  );

  UPDATE public.internal_operations
  SET status = 'succeeded',
      result = jsonb_build_object('ok', true, 'invite_id', v_invite_id),
      completed_at = now()
  WHERE actor_id = v_actor AND operation_id = p_operation_id;

  -- token em claro retornado uma única vez para a Edge Function enviar o link.
  -- Nenhuma senha do gestor é envolvida.
  RETURN jsonb_build_object(
    'ok', true,
    'invite_id', v_invite_id,
    'recovery_token', v_token,
    'expires_at', now() + make_interval(hours => p_ttl_hours)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.internal_send_password_recovery_invite(uuid, text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.internal_send_password_recovery_invite(uuid, text, uuid, integer) TO authenticated;

-- 5) Neutraliza a antiga internal_reset_password para o navegador ----------
-- A função aceitava a senha em claro do gestor, violando a regra. Revoga
-- execute de authenticated/anon; permanece apenas em service_role (Jobs/Edge
-- administrativos legados podem ser migrados ao invite acima).
REVOKE EXECUTE ON FUNCTION public.internal_reset_password(uuid, text) FROM PUBLIC, anon, authenticated;

-- Grant de leitura (somente próprias operações via RLS já existente) para
-- authenticated poder ler o resultado de idempotência no console/testes.
-- RLS em internal_operations estava habilitada sem policy prévia; adicionamos
-- uma policy self-read para o authenticated ver suas próprias operações.
DROP POLICY IF EXISTS internal_operations_self_read ON public.internal_operations;
CREATE POLICY internal_operations_self_read
  ON public.internal_operations FOR SELECT TO authenticated
  USING (actor_id = auth.uid() OR private.has_internal_permission('audit.read'));
GRANT SELECT ON public.internal_operations TO authenticated;

COMMENT ON FUNCTION public.set_user_approval(uuid, boolean, text, uuid) IS
  'Aprova/ reprova cadastro. Ator interno com account.approve (AAL2) ou gestor municipal (master_admin/admin/supervisor mesmo município sobre agente). Idempotente via operation_id; transição auditada em internal_access_events (before/after isApproved).';
COMMENT ON FUNCTION public.set_account_lock_state(uuid, boolean, text, uuid) IS
  'Bloqueia/desbloqueia conta: isApproved = NOT locked. Exige account.lock + AAL2 + justificativa. Idempotente e auditado com before/after.';
COMMENT ON FUNCTION public.internal_send_password_recovery_invite(uuid, text, uuid, integer) IS
  'Emite invite de recuperação de senha: gera token único (hash sha256 guardado), NUNCA aceita senha do gestor. O link é enviado por Edge Function/mailer fora deste escopo. Exige account.recover_invite + AAL2. Auditado e idempotente.';
