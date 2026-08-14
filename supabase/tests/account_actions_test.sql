-- pgTAP — Ações de conta internas auditadas (ENTREGA B2).
-- Cobre: aprovação (interna + municipal), negação de usuário municipal,
-- AAL2 obrigatório, lock/unblock idempotente + audit, invite de recuperação
-- (token gerado, nunca senha do gestor) e revogação da antiga
-- internal_reset_password no navegador.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(14);
CREATE TEMP TABLE tap_output(line text);
CREATE TEMP TABLE direct_checks(name text PRIMARY KEY, passed boolean NOT NULL);
GRANT SELECT, INSERT ON tap_output, direct_checks TO authenticated;

-- A trigger on_auth_user_created (após INSERT em auth.users) cria a linha em
-- public.users com role='agent'/isApproved=false (defaults). Para impor os
-- papéis reais do fixture (master_admin, supervisor, etc.) usamos ON CONFLICT
-- DO UPDATE. Esse UPDATE tocaria role/municipio/isApproved e dispararia
-- users_protect_authorization_fields — por isso desabilitamos também esse
-- guardião durante o seed (executado como superuser, fora de sessão), e o
-- reabilitamos antes das asserções. A RPC sob teste opera com a proteção ativa.
ALTER TABLE public.users DISABLE TRIGGER block_local_test_all_writes;
ALTER TABLE public.users DISABLE TRIGGER block_local_test_users;
ALTER TABLE public.users DISABLE TRIGGER users_protect_authorization_fields;

INSERT INTO auth.users(id, email, raw_user_meta_data)
VALUES
  ('60000000-0000-4000-8000-000000000001', 'acc-owner@example.test', '{}'::jsonb),
  ('60000000-0000-4000-8000-000000000002', 'acc-support@example.test', '{}'::jsonb),
  ('60000000-0000-4000-8000-000000000003', 'acc-municipal-agent@example.test', '{}'::jsonb),
  ('60000000-0000-4000-8000-000000000004', 'acc-master-admin@example.test', '{}'::jsonb),
  ('60000000-0000-4000-8000-000000000005', 'acc-target-agent@example.test', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users(uid, email, name, role, municipio, "isApproved")
VALUES
  ('60000000-0000-4000-8000-000000000001', 'acc-owner@example.test', 'Owner', 'agent', NULL, true),
  ('60000000-0000-4000-8000-000000000002', 'acc-support@example.test', 'Support', 'agent', NULL, true),
  ('60000000-0000-4000-8000-000000000003', 'acc-municipal-agent@example.test', 'Cataguases Agent', 'agent', 'Cataguases', true),
  ('60000000-0000-4000-8000-000000000004', 'acc-master-admin@example.test', 'Master Admin', 'master_admin', 'Cataguases', true),
  ('60000000-0000-4000-8000-000000000005', 'acc-target-agent@example.test', 'Target Agent', 'agent', 'Cataguases', false)
ON CONFLICT (uid) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  municipio = EXCLUDED.municipio,
  "isApproved" = EXCLUDED."isApproved";

INSERT INTO public.internal_staff(user_id, role, status, display_name)
VALUES
  ('60000000-0000-4000-8000-000000000001', 'owner', 'active', 'Owner Acc'),
  ('60000000-0000-4000-8000-000000000002', 'support', 'active', 'Support Acc')
ON CONFLICT (user_id) DO UPDATE SET role=EXCLUDED.role, status=EXCLUDED.status;

INSERT INTO public.organizations(id, slug, display_name, municipality_name, status)
VALUES ('61000000-0000-4000-8000-000000000001', 'acc-cataguases', 'Cataguases Acc', 'Cataguases', 'pilot')
ON CONFLICT (id) DO NOTHING;

-- Reabilita os triggers após o seed: o guardião de autorização volta a_ativo
-- para que as RPCs sob teste operem sob proteção real.
ALTER TABLE public.users ENABLE TRIGGER block_local_test_all_writes;
ALTER TABLE public.users ENABLE TRIGGER block_local_test_users;
ALTER TABLE public.users ENABLE TRIGGER users_protect_authorization_fields;

-- 1) Owner interno (AAL2) aprova cadastro pendente e gera audit + idempotência.
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
WITH appr AS (
  SELECT public.set_user_approval('60000000-0000-4000-8000-000000000005', true, 'aprovação pendente console', '62000000-0000-4000-8000-000000000001') AS r
)
INSERT INTO tap_output SELECT extensions.is(
  (SELECT (r->>'isApproved')::boolean FROM appr),
  true,
  'internal owner approves pending agent account'
);
INSERT INTO tap_output SELECT extensions.is(
  (SELECT count(*)::bigint FROM public.internal_access_events
   WHERE actor_id='60000000-0000-4000-8000-000000000001'
     AND action='account.approve' AND target_id='60000000-0000-4000-8000-000000000005'
     AND result='allowed' AND reason='aprovação pendente console'),
  1::bigint,
  'approval transition audited with reason'
);
WITH retry AS (
  SELECT public.set_user_approval('60000000-0000-4000-8000-000000000005', true, 'aprovação pendente console', '62000000-0000-4000-8000-000000000001') AS r
)
INSERT INTO tap_output SELECT extensions.is(
  (SELECT count(*)::bigint FROM public.internal_operations WHERE operation_id='62000000-0000-4000-8000-000000000001'),
  1::bigint,
  'approval is idempotent (one operation row)'
);

-- 2) Master_admin do município aprova um agente do mesmo município (fluxo municipal original).
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"60000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}', true);
INSERT INTO tap_output SELECT extensions.is(
  (SELECT (public.set_user_approval('60000000-0000-4000-8000-000000000005', true, 'master municipal aprova agente local', '62000000-0000-4000-8000-000000000002')->>'isApproved')::boolean),
  true,
  'municipal master_admin approves same-municipio agent'
);

-- 3) Usuário municipal (não staff) não pode aprovar via console interno.
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"60000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}', true);
DO $$
DECLARE caught text := 'not_thrown';
BEGIN
  BEGIN
    PERFORM public.set_user_approval('60000000-0000-4000-8000-000000000005', true, 'tentativa municipal sem staff', '62000000-0000-4000-8000-000000000003');
  EXCEPTION WHEN others THEN caught := SQLSTATE; END;
  INSERT INTO direct_checks VALUES('municipal_user_denied', caught = '42501');
END $$;
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='municipal_user_denied'),
  'municipal non-staff user cannot approve via internal console'
);

-- 4) Owner sem AAL2 não pode aprovar (AAL2 obrigatório).
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
DO $$
DECLARE caught text := 'not_thrown';
BEGIN
  BEGIN
    PERFORM public.set_user_approval('60000000-0000-4000-8000-000000000005', false, 'tentativa sem aal2', '62000000-0000-4000-8000-000000000004');
  EXCEPTION WHEN others THEN caught := SQLSTATE; END;
  INSERT INTO direct_checks VALUES('aal2_required', caught = '42501');
END $$;
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='aal2_required'),
  'account actions require AAL2'
);

-- 5) Support (account.recover_invite, NÃO account.lock) NÃO pode bloquear conta.
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);
DO $$
DECLARE caught text := 'not_thrown';
BEGIN
  BEGIN
    PERFORM public.set_account_lock_state('60000000-0000-4000-8000-000000000005', true, 'tentativa support bloquear', '62000000-0000-4000-8000-000000000005');
  EXCEPTION WHEN others THEN caught := SQLSTATE; END;
  INSERT INTO direct_checks VALUES('support_cannot_lock', caught = '42501');
END $$;
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='support_cannot_lock'),
  'support role lacks account.lock permission'
);

-- 6) Owner bloqueia conta (isApproved=false) com audit before/after e idempotência.
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
WITH lck AS (
  SELECT public.set_account_lock_state('60000000-0000-4000-8000-000000000005', true, 'bloqueio por comportamento', '62000000-0000-4000-8000-000000000006') AS r
)
INSERT INTO tap_output SELECT extensions.is(
  (SELECT (r->>'locked')::boolean FROM lck),
  true,
  'owner locks account (isApproved=false)'
);
INSERT INTO tap_output SELECT extensions.is(
  (SELECT count(*)::bigint FROM public.internal_access_events
   WHERE actor_id='60000000-0000-4000-8000-000000000001' AND action='account.lock'
     AND target_id='60000000-0000-4000-8000-000000000005' AND result='allowed'),
  1::bigint,
  'lock transition audited'
);
INSERT INTO tap_output SELECT extensions.is(
  (SELECT ("isApproved") FROM public.users WHERE uid='60000000-0000-4000-8000-000000000005'),
  false,
  'locked account persisted as isApproved=false'
);

-- 7) Invite de recuperação gera token, NUNCA aceita senha do gestor.
-- account_recovery_invites é RLS-only; liberamos leitura só dentro desta
-- transação de teste (ROLLBACK reverte) para verificar a persistência do
-- invite. O token opaco é validado pelo retorno da RPC materializado em
-- temp table; a auditoria é confirmada no teste 12.
RESET ROLE;
ALTER TABLE public.account_recovery_invites DISABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.account_recovery_invites TO authenticated;
CREATE TEMP TABLE inv_result AS
  SELECT public.internal_send_password_recovery_invite(
    '60000000-0000-4000-8000-000000000005',
    'recuperação solicitada pelo cliente',
    '62000000-0000-4000-8000-000000000007'
  ) AS r;
GRANT SELECT ON inv_result TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT (r->>'ok')::boolean FROM inv_result)
  AND char_length(COALESCE((SELECT r->>'recovery_token' FROM inv_result),'')) >= 64,
  'recovery invite returns opaque token, never a manager password'
);
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT count(*) > 0 FROM public.account_recovery_invites
   WHERE target_user_id='60000000-0000-4000-8000-000000000005'
     AND consumed_at IS NULL AND expires_at > now()),
  'recovery invite persists a pending, unexpired row'
);
INSERT INTO tap_output SELECT extensions.is(
  (SELECT count(*)::bigint FROM public.internal_access_events
   WHERE actor_id='60000000-0000-4000-8000-000000000001' AND action='account.recover_invite'
     AND target_id='60000000-0000-4000-8000-000000000005' AND result='allowed'),
  1::bigint,
  'recovery invite audited as staff action'
);

-- 8) A antiga internal_reset_password não é chamável pelo navegador.
INSERT INTO tap_output SELECT extensions.ok(
  NOT has_function_privilege('authenticated','public.internal_reset_password(uuid,text)','EXECUTE'),
  'browser can no longer execute password reset that takes a manager-typed password'
);

RESET ROLE;
INSERT INTO tap_output SELECT * FROM extensions.finish();
SELECT jsonb_agg(line) AS tap_results FROM tap_output;
ROLLBACK;
