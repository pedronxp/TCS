-- pgTAP — Ciclo de vida de planos e assinaturas (ENTREGA B3).
-- Cobre: activate/deactivate/retire do plano (sem apagar histórico), upgrade
-- imediato, downgrade/cancel ao fim do período, reactivate, idempotência,
-- auditoria before/after em subscription_audit_events, gate service_role do
-- job de aplicação diferida e preservação do plan_version_id histórico.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(35);
CREATE TEMP TABLE tap_output(line text);
CREATE TEMP TABLE direct_checks(name text PRIMARY KEY, passed boolean NOT NULL);
GRANT SELECT, INSERT ON tap_output, direct_checks TO authenticated;

-- Seed de identidades. A trigger on_auth_user_created cria public.users com
-- defaults; usamos ON CONFLICT DO UPDATE para impor os papéis e desabilitamos
-- users_protect_authorization_fields durante o seed (superuser), reabilitando
-- antes das asserções. As RPCs sob teste operam com a proteção ativa.
ALTER TABLE public.users DISABLE TRIGGER block_local_test_all_writes;
ALTER TABLE public.users DISABLE TRIGGER block_local_test_users;
ALTER TABLE public.users DISABLE TRIGGER users_protect_authorization_fields;

INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES
  ('70000000-0000-4000-8000-000000000001', 'b3-owner@example.test', '{}'::jsonb),
  ('70000000-0000-4000-8000-000000000002', 'b3-support@example.test', '{}'::jsonb),
  ('70000000-0000-4000-8000-000000000003', 'b3-cust@example.test', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users(uid, email, name, role, municipio, "isApproved") VALUES
  ('70000000-0000-4000-8000-000000000001', 'b3-owner@example.test', 'B3 Owner', 'agent', NULL, true),
  ('70000000-0000-4000-8000-000000000002', 'b3-support@example.test', 'B3 Support', 'agent', NULL, true),
  ('70000000-0000-4000-8000-000000000003', 'b3-cust@example.test', 'B3 Cust', 'agent', NULL, true)
ON CONFLICT (uid) DO UPDATE SET
  email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role,
  municipio = EXCLUDED.municipio, "isApproved" = EXCLUDED."isApproved";

INSERT INTO public.internal_staff(user_id, role, status, display_name) VALUES
  ('70000000-0000-4000-8000-000000000001', 'owner', 'active', 'B3 Owner'),
  ('70000000-0000-4000-8000-000000000002', 'support', 'active', 'B3 Support')
ON CONFLICT (user_id) DO UPDATE SET role=EXCLUDED.role, status=EXCLUDED.status;

ALTER TABLE public.users ENABLE TRIGGER block_local_test_all_writes;
ALTER TABLE public.users ENABLE TRIGGER block_local_test_users;
ALTER TABLE public.users ENABLE TRIGGER users_protect_authorization_fields;

-- Planos + versões. Inseridos como superuser (JWT NULL => block_local_test
-- nao bloqueia). current_version referencia a versao publicada.
INSERT INTO public.plans(id, code, name, audience, status, current_version) VALUES
  ('71000000-0000-4000-8000-000000000001', 'b3_basic',  'B3 Basic',  'organization', 'draft',  1),
  ('71000000-0000-4000-8000-000000000002', 'b3_pro',    'B3 Pro',    'organization', 'active', 2),
  ('71000000-0000-4000-8000-000000000003', 'b3_legacy', 'B3 Legacy', 'organization', 'active', 1)
ON CONFLICT (id) DO UPDATE SET
  code=EXCLUDED.code, name=EXCLUDED.name, audience=EXCLUDED.audience,
  status=EXCLUDED.status, current_version=EXCLUDED.current_version;

INSERT INTO public.plan_versions(id, plan_id, version, configuration, published_at, created_by) VALUES
  ('72000000-0000-4000-8000-000000000011', '71000000-0000-4000-8000-000000000001', 1, '{"price":10}'::jsonb, now(), '70000000-0000-4000-8000-000000000001'),
  ('72000000-0000-4000-8000-000000000021', '71000000-0000-4000-8000-000000000002', 1, '{"price":30}'::jsonb, now(), '70000000-0000-4000-8000-000000000001'),
  ('72000000-0000-4000-8000-000000000022', '71000000-0000-4000-8000-000000000002', 2, '{"price":50}'::jsonb, now(), '70000000-0000-4000-8000-000000000001'),
  ('72000000-0000-4000-8000-000000000031', '71000000-0000-4000-8000-000000000003', 1, '{"price":20}'::jsonb, now(), '70000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO UPDATE SET
  plan_id=EXCLUDED.plan_id, version=EXCLUDED.version,
  configuration=EXCLUDED.configuration, published_at=EXCLUDED.published_at;

INSERT INTO public.organizations(id, slug, display_name, municipality_name, status) VALUES
  ('74000000-0000-4000-8000-000000000001', 'b3-org1', 'B3 Org1', 'Cataguases', 'pilot'),
  ('74000000-0000-4000-8000-000000000002', 'b3-org2', 'B3 Org2', 'Cataguases', 'pilot'),
  ('74000000-0000-4000-8000-000000000003', 'b3-org3', 'B3 Org3', 'Cataguases', 'pilot')
ON CONFLICT (id) DO NOTHING;

-- Assinaturas: uma ativa no plano Pro (v2), período futuro; outra ativa no
-- Legacy para o teste de preservação histórica; uma terceira com período já
-- encerrado para o job de aplicação diferida (cancel). Inseridas como superuser.
INSERT INTO public.subscriptions(id, plan_id, user_id, organization_id, status, plan_version_id, current_period_start, current_period_end) VALUES
  ('73000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000002', NULL, '74000000-0000-4000-8000-000000000001', 'active', '72000000-0000-4000-8000-000000000022', now(), now() + interval '20 days'),
  ('73000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000003', NULL, '74000000-0000-4000-8000-000000000002', 'active', '72000000-0000-4000-8000-000000000031', now(), now() + interval '20 days'),
  ('73000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000002', NULL, '74000000-0000-4000-8000-000000000003', 'active', '72000000-0000-4000-8000-000000000022', now() - interval '10 days', now() - interval '1 day')
ON CONFLICT (id) DO UPDATE SET
  plan_id=EXCLUDED.plan_id, organization_id=EXCLUDED.organization_id, status=EXCLUDED.status,
  plan_version_id=EXCLUDED.plan_version_id,
  current_period_start=EXCLUDED.current_period_start,
  current_period_end=EXCLUDED.current_period_end,
  cancel_at_period_end=false, pending_action=NULL, pending_plan_id=NULL, canceled_at=NULL;

-- Helpers de sessão.
CREATE OR REPLACE FUNCTION pg_temp.as_owner()
RETURNS void LANGUAGE sql AS $$
  RESET ROLE; SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims',
    '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
$$;
CREATE OR REPLACE FUNCTION pg_temp.as_support()
RETURNS void LANGUAGE sql AS $$
  RESET ROLE; SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims',
    '{"sub":"70000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);
$$;
CREATE OR REPLACE FUNCTION pg_temp.as_service()
RETURNS void LANGUAGE sql AS $$
  RESET ROLE; SET LOCAL ROLE service_role;
  SELECT set_config('request.jwt.claims',
    '{"sub":"70000000-0000-4000-8000-000000000001","role":"service_role","aal":"aal2"}', true);
$$;

-- 1) Owner ativa plano draft -> status=active + audit.
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
WITH r AS (
  SELECT public.manage_plan_lifecycle('71000000-0000-4000-8000-000000000001','activate','ativação comercial do plano basic','80000000-0000-4000-8000-000000000001') AS v
)
INSERT INTO tap_output SELECT extensions.is(
  (SELECT (v->>'status')::text FROM r), 'active', 'activate moves plan to active');
INSERT INTO tap_output SELECT extensions.is(
  (SELECT status FROM public.plans WHERE id='71000000-0000-4000-8000-000000000001'),
  'active', 'plan activation persisted');

-- 2) Owner arquiva (retire) plano Legacy -> status=retired sem apagar a linha.
WITH r AS (
  SELECT public.manage_plan_lifecycle('71000000-0000-4000-8000-000000000003','retire','arquivamento do plano legacy','80000000-0000-4000-8000-000000000002') AS v
)
INSERT INTO tap_output SELECT extensions.is(
  (SELECT (v->>'status')::text FROM r), 'retired', 'retire archives plan without deletion');
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT count(*) > 0 FROM public.plans WHERE id='71000000-0000-4000-8000-000000000003' AND status='retired'),
  'retired plan row still exists (history preserved)');

-- 3) Plano retired não pode ser reativado.
DO $$
DECLARE caught text := 'not_thrown';
BEGIN
  BEGIN
    PERFORM pg_temp.as_owner();
    PERFORM public.manage_plan_lifecycle('71000000-0000-4000-8000-000000000003','activate','tentativa reativar retired','80000000-0000-4000-8000-000000000003');
  EXCEPTION WHEN others THEN caught := SQLSTATE; END;
  INSERT INTO direct_checks VALUES('retired_no_reactivate', caught = '22023');
END $$;
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='retired_no_reactivate'),
  'retired plan cannot be reactivated');

-- 4) Usuário sem commercial.write (support) não gerencia ciclo do plano.
DO $$
DECLARE caught text := 'not_thrown';
BEGIN
  BEGIN
    PERFORM pg_temp.as_support();
    PERFORM public.manage_plan_lifecycle('71000000-0000-4000-8000-000000000002','deactivate','tentativa support','80000000-0000-4000-8000-000000000004');
  EXCEPTION WHEN others THEN caught := SQLSTATE; END;
  INSERT INTO direct_checks VALUES('support_cannot_plan', caught = '42501');
END $$;
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='support_cannot_plan'),
  'support role lacks commercial.write for plan lifecycle');

-- 5) AAL2 obrigatório para ciclo do plano.
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
DO $$
DECLARE caught text := 'not_thrown';
BEGIN
  BEGIN
    PERFORM public.manage_plan_lifecycle('71000000-0000-4000-8000-000000000002','deactivate','sem aal2','80000000-0000-4000-8000-000000000005');
  EXCEPTION WHEN others THEN caught := SQLSTATE; END;
  INSERT INTO direct_checks VALUES('plan_aal2', caught = '42501');
END $$;
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='plan_aal2'),
  'plan lifecycle requires AAL2');

-- 6) Upgrade imediato: troca plan_id/plan_version_id agora, status active.
SELECT pg_temp.as_owner();
CREATE TEMP TABLE upg AS
  SELECT public.manage_subscription_lifecycle(
    '73000000-0000-4000-8000-000000000001','upgrade',
    '71000000-0000-4000-8000-000000000001',
    'upgrade imediato para o basic','80000000-0000-4000-8000-000000000006') AS v;
GRANT SELECT ON upg TO authenticated;
INSERT INTO tap_output SELECT extensions.is(
  (SELECT (v->>'plan_id')::text FROM upg), '71000000-0000-4000-8000-000000000001',
  'upgrade swaps plan_id immediately');
INSERT INTO tap_output SELECT extensions.is(
  (SELECT (v->>'status')::text FROM upg), 'active', 'upgrade keeps status active');
INSERT INTO tap_output SELECT extensions.is(
  (SELECT cancel_at_period_end FROM public.subscriptions WHERE id='73000000-0000-4000-8000-000000000001'),
  false, 'upgrade clears cancel_at_period_end');

-- 7) Downgrade diferido: pending_action=downgrade, plano vigente inalterado.
--    Aplica-se só no fim do período (current_period_end futuro). Cancela
--    qualquer intenção de upgrade/cancel prévia via idempotência de reason.
SELECT pg_temp.as_owner();
CREATE TEMP TABLE dwn AS
  SELECT public.manage_subscription_lifecycle(
    '73000000-0000-4000-8000-000000000001','downgrade',
    '71000000-0000-4000-8000-000000000002',
    'downgrade programado para fim do período','80000000-0000-4000-8000-000000000007') AS v;
GRANT SELECT ON dwn TO authenticated;
INSERT INTO tap_output SELECT extensions.is(
  (SELECT (v->>'pending_action')::text FROM dwn), 'downgrade',
  'downgrade records pending_action');
INSERT INTO tap_output SELECT extensions.is(
  (SELECT plan_id FROM public.subscriptions WHERE id='73000000-0000-4000-8000-000000000001'),
  '71000000-0000-4000-8000-000000000001',
  'downgrade does not change current plan_id until period end');
INSERT INTO tap_output SELECT extensions.is(
  (SELECT (v->>'pending_plan_id')::text FROM dwn), '71000000-0000-4000-8000-000000000002',
  'downgrade records pending_plan_id target');

-- 8) Cancel diferido: cancel_at_period_end=true, status ainda ativo.
SELECT pg_temp.as_owner();
CREATE TEMP TABLE canc AS
  SELECT public.manage_subscription_lifecycle(
    '73000000-0000-4000-8000-000000000002','cancel', NULL,
    'cancelamento solicitado pelo cliente','80000000-0000-4000-8000-000000000008') AS v;
GRANT SELECT ON canc TO authenticated;
INSERT INTO tap_output SELECT extensions.is(
  (SELECT cancel_at_period_end FROM public.subscriptions WHERE id='73000000-0000-4000-8000-000000000002'),
  true, 'cancel sets cancel_at_period_end');
INSERT INTO tap_output SELECT extensions.is(
  (SELECT status FROM public.subscriptions WHERE id='73000000-0000-4000-8000-000000000002'),
  'active', 'cancel keeps status active until period end');
INSERT INTO tap_output SELECT extensions.is(
  (SELECT canceled_at FROM public.subscriptions WHERE id='73000000-0000-4000-8000-000000000002'),
  NULL, 'cancel does not set canceled_at until period end');

-- 9) Reactivate reverte o cancelamento agendado.
SELECT pg_temp.as_owner();
CREATE TEMP TABLE rea AS
  SELECT public.manage_subscription_lifecycle(
    '73000000-0000-4000-8000-000000000002','reactivate', NULL,
    'cliente decidiu continuar','80000000-0000-4000-8000-000000000009') AS v;
GRANT SELECT ON rea TO authenticated;
INSERT INTO tap_output SELECT extensions.is(
  (SELECT cancel_at_period_end FROM public.subscriptions WHERE id='73000000-0000-4000-8000-000000000002'),
  false, 'reactivate clears cancel_at_period_end');
INSERT INTO tap_output SELECT extensions.is(
  (SELECT pending_action FROM public.subscriptions WHERE id='73000000-0000-4000-8000-000000000002'),
  NULL, 'reactivate clears pending_action');

-- 10) Plano retired não pode ser alvo de upgrade.
DO $$
DECLARE caught text := 'not_thrown';
BEGIN
  BEGIN
    PERFORM pg_temp.as_owner();
    PERFORM public.manage_subscription_lifecycle(
      '73000000-0000-4000-8000-000000000002','upgrade',
      '71000000-0000-4000-8000-000000000003',
      'upgrade para plano arquivado','80000000-0000-4000-8000-000000000010');
  EXCEPTION WHEN others THEN caught := SQLSTATE; END;
  INSERT INTO direct_checks VALUES('retired_upgrade_target', caught = '42501');
END $$;
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='retired_upgrade_target'),
  'cannot upgrade to a retired plan');

-- 11) Toda transição audita before/after em subscription_audit_events.
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT count(*) > 0 FROM public.subscription_audit_events
   WHERE entity_id='73000000-0000-4000-8000-000000000001'
     AND event_type='subscription_upgrade'
     AND metadata ? 'before' AND metadata ? 'after' AND metadata ? 'reason'),
  'upgrade transition audited with before/after/reason');
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT count(*) > 0 FROM public.subscription_audit_events
   WHERE entity_id='73000000-0000-4000-8000-000000000002'
     AND event_type='subscription_cancel'),
  'cancel transition audited');

-- 12) Idempotência: mesmo operation_id+reason retorna resultado cacheado e
--     gera uma única linha em internal_operations.
SELECT pg_temp.as_owner();
CREATE TEMP TABLE idem1 AS
  SELECT public.manage_subscription_lifecycle(
    '73000000-0000-4000-8000-000000000002','cancel', NULL,
    'cancelamento solicitado pelo cliente','80000000-0000-4000-8000-000000000011') AS v;
CREATE TEMP TABLE idem2 AS
  SELECT public.manage_subscription_lifecycle(
    '73000000-0000-4000-8000-000000000002','cancel', NULL,
    'cancelamento solicitado pelo cliente','80000000-0000-4000-8000-000000000011') AS v;
GRANT SELECT ON idem1 TO authenticated;
GRANT SELECT ON idem2 TO authenticated;
INSERT INTO tap_output SELECT extensions.is(
  (SELECT i1.v->>'action' FROM idem1 i1, idem2 i2 WHERE i1.v->>'action' = i2.v->>'action'),
  'cancel', 'idempotent cancel returns same result');
INSERT INTO tap_output SELECT extensions.is(
  (SELECT count(*)::bigint FROM public.internal_operations WHERE operation_id='80000000-0000-4000-8000-000000000011'),
  1::bigint, 'cancel is idempotent (one operation row)');

-- 13) Job de aplicação diferida exige service_role; authenticated é negado.
DO $$
DECLARE caught text := 'not_thrown';
BEGIN
  BEGIN
    PERFORM pg_temp.as_owner();
    PERFORM public.apply_pending_subscription_transitions(100);
  EXCEPTION WHEN others THEN caught := SQLSTATE; END;
  INSERT INTO direct_checks VALUES('apply_not_authenticated', caught = '42501');
END $$;
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='apply_not_authenticated'),
  'apply_pending rejects authenticated (service_role only)');

-- 14) Job service_role aplica cancel cujo período já encerrou (sub ...0003),
--     e a assinatura Legacy arquivada preserva plan_version_id histórico.
--     Agenda o cancelamento de sub_3 (período já encerrado) como owner antes
--     de rodar o job; o job então efetiva o cancel ponto a ponto.
SELECT pg_temp.as_owner();
CREATE TEMP TABLE sched_cancel AS
  SELECT public.manage_subscription_lifecycle(
    '73000000-0000-4000-8000-000000000003','cancel', NULL,
    'cancelamento com período vencido','80000000-0000-4000-8000-000000000012') AS v;
RESET ROLE;
CREATE TEMP TABLE applied(v jsonb);
GRANT SELECT ON applied TO authenticated;
GRANT INSERT ON applied TO service_role;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000001","role":"service_role","aal":"aal2"}', true);
INSERT INTO applied SELECT public.apply_pending_subscription_transitions(100);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
INSERT INTO tap_output SELECT extensions.is(
  (SELECT (v->>'canceled')::int FROM applied), 1, 'service_role job applies 1 pending cancel');
INSERT INTO tap_output SELECT extensions.is(
  (SELECT status FROM public.subscriptions WHERE id='73000000-0000-4000-8000-000000000003'),
  'canceled', 'deferred cancel becomes effective at period end');
INSERT INTO tap_output SELECT extensions.is(
  (SELECT plan_version_id::text FROM public.subscriptions WHERE id='73000000-0000-4000-8000-000000000002'),
  '72000000-0000-4000-8000-000000000031',
  'archived plan subscription keeps historical plan_version_id');

-- CORREÇÃO P0: Plano retired é terminal; não pode voltar a draft/active.
-- 15) Tentar ativar plano retired é recusado.
-- O plano 003 já foi aposentado no teste da linha 118 (status='retired'); a
-- chamada de aposentaria novamente seria não-idempotente e violaria o próprio
-- contrato de estado terminal, então apenas posicionamos o owner e tentamos
-- a transição proibida.
SELECT pg_temp.as_owner();

DO $$
DECLARE caught text := 'not_thrown';
BEGIN
  BEGIN
    PERFORM pg_temp.as_owner();
    PERFORM public.manage_plan_lifecycle('71000000-0000-4000-8000-000000000003', 'activate', 'tentativa de reativar retired', '80000000-0000-4000-8000-000000000014');
  EXCEPTION WHEN others THEN caught := SQLSTATE; END;
  INSERT INTO direct_checks VALUES('retired_cannot_activate', caught = '22023');
END $$;
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='retired_cannot_activate'),
  'retired plan cannot be activated (terminal state)');

-- 16) Tentar desativar (draft) plano retired é recusado.
DO $$
DECLARE caught text := 'not_thrown';
BEGIN
  BEGIN
    PERFORM pg_temp.as_owner();
    PERFORM public.manage_plan_lifecycle('71000000-0000-4000-8000-000000000003', 'deactivate', 'tentativa de desativar retired', '80000000-0000-4000-8000-000000000015');
  EXCEPTION WHEN others THEN caught := SQLSTATE; END;
  INSERT INTO direct_checks VALUES('retired_cannot_deactivate', caught = '22023');
END $$;
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='retired_cannot_deactivate'),
  'retired plan cannot be deactivated (terminal state)');

-- CORREÇÃO P0: Upgrade/downgrade só aceita plano com status='active'.
-- 17) Tentar upgrade para plano draft é recusado.
-- Nota: o plano 001 e ativado no teste 1 e nao permanece draft; criamos um
-- plano exclusivamente draft para validar a rejeicao sem depender do estado
-- mutavel das fixtures anteriores.
INSERT INTO public.plans(id, code, name, audience, status, current_version) VALUES
  ('71000000-0000-4000-8000-000000000009', 'b3_draft_fixture', 'B3 Draft Fixture', 'organization', 'draft', 1)
ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, current_version=EXCLUDED.current_version,
  code=EXCLUDED.code, name=EXCLUDED.name, audience=EXCLUDED.audience;
INSERT INTO public.plan_versions(id, plan_id, version, configuration, published_at, created_by) VALUES
  ('72000000-0000-4000-8000-000000000091', '71000000-0000-4000-8000-000000000009', 1, '{"price":5}'::jsonb, now(), '70000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO UPDATE SET plan_id=EXCLUDED.plan_id, version=EXCLUDED.version,
  configuration=EXCLUDED.configuration, published_at=EXCLUDED.published_at;
DO $$
DECLARE caught text := 'not_thrown';
BEGIN
  BEGIN
    PERFORM pg_temp.as_owner();
    PERFORM public.manage_subscription_lifecycle('73000000-0000-4000-8000-000000000001', 'upgrade', '71000000-0000-4000-8000-000000000009', 'tentativa upgrade para draft', '80000000-0000-4000-8000-000000000016');
  EXCEPTION WHEN others THEN caught := SQLSTATE; END;
  INSERT INTO direct_checks VALUES('draft_plan_rejected', caught = '42501');
END $$;
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='draft_plan_rejected'),
  'upgrade to draft plan is rejected (must be active)');

-- 18) Tentar downgrade para plano draft é recusado.
DO $$
DECLARE caught text := 'not_thrown';
BEGIN
  BEGIN
    PERFORM pg_temp.as_owner();
    PERFORM public.manage_subscription_lifecycle('73000000-0000-4000-8000-000000000001', 'downgrade', '71000000-0000-4000-8000-000000000009', 'tentativa downgrade para draft', '80000000-0000-4000-8000-000000000017');
  EXCEPTION WHEN others THEN caught := SQLSTATE; END;
  INSERT INTO direct_checks VALUES('draft_plan_downgrade_rejected', caught = '42501');
END $$;
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='draft_plan_downgrade_rejected'),
  'downgrade to draft plan is rejected (must be active)');

-- CORREÇÃO P0: Persistir pending_plan_version_id no agendamento.
-- 19) Downgrade persiste pending_plan_version_id (versão exata aceita).
SELECT pg_temp.as_owner();
-- Criar plano Pro com duas versões ativas: v2 (current) e v3 (futura simulada).
INSERT INTO public.plan_versions(id, plan_id, version, configuration, published_at, created_by)
VALUES ('72000000-0000-4000-8000-000000000023', '71000000-0000-4000-8000-000000000002', 3, '{"price":60}'::jsonb, now(), '70000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO UPDATE SET
  plan_id=EXCLUDED.plan_id, version=EXCLUDED.version,
  configuration=EXCLUDED.configuration, published_at=EXCLUDED.published_at;

-- Criar nova assinatura para testar downgrade com versão persistida.
INSERT INTO public.organizations(id, slug, display_name, status) VALUES
  ('74000000-0000-4000-8000-000000000004', 'b3-org4', 'B3 Org4', 'pilot')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.subscriptions(id, plan_id, user_id, organization_id, status, plan_version_id, current_period_start, current_period_end)
VALUES ('73000000-0000-4000-8000-000000000004', '71000000-0000-4000-8000-000000000002', NULL, '74000000-0000-4000-8000-000000000004', 'active', '72000000-0000-4000-8000-000000000023', now(), now() + interval '20 days')
ON CONFLICT (id) DO UPDATE SET
  plan_id=EXCLUDED.plan_id, organization_id=EXCLUDED.organization_id, status=EXCLUDED.status,
  plan_version_id=EXCLUDED.plan_version_id,
  current_period_start=EXCLUDED.current_period_start,
  current_period_end=EXCLUDED.current_period_end,
  cancel_at_period_end=false, pending_action=NULL, pending_plan_id=NULL,
  pending_plan_version_id=NULL, canceled_at=NULL;

-- Agendar downgrade para Basic (v1).
CREATE TEMP TABLE down_result AS
  SELECT public.manage_subscription_lifecycle(
    '73000000-0000-4000-8000-000000000004', 'downgrade', '71000000-0000-4000-8000-000000000001',
    'downgrade com versão persistida', '80000000-0000-4000-8000-000000000018') AS v;
GRANT SELECT ON down_result TO authenticated;

INSERT INTO tap_output SELECT extensions.is(
  (SELECT v->>'pending_action' FROM down_result), 'downgrade',
  'downgrade sets pending_action');

INSERT INTO tap_output SELECT extensions.is(
  (SELECT pending_plan_version_id::text FROM public.subscriptions WHERE id='73000000-0000-4000-8000-000000000004'),
  '72000000-0000-4000-8000-000000000011',
  'downgrade persists pending_plan_version_id (exact version accepted)');

-- 20) Alterar current_version do plano Basic para v2 (simular edição posterior).
UPDATE public.plans SET current_version = 2 WHERE id = '71000000-0000-4000-8000-000000000001';

-- Inserir plan_version v2 do Basic (simulação de edição).
INSERT INTO public.plan_versions(id, plan_id, version, configuration, published_at, created_by)
VALUES ('72000000-0000-4000-8000-000000000012', '71000000-0000-4000-8000-000000000001', 2, '{"price":15}'::jsonb, now(), '70000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO UPDATE SET
  plan_id=EXCLUDED.plan_id, version=EXCLUDED.version,
  configuration=EXCLUDED.configuration, published_at=EXCLUDED.published_at;

-- 21) Job aplica a versão persistida (v1), não a nova current_version (v2).
-- Forçar período encerrado para aplicação imediata.
UPDATE public.subscriptions
SET current_period_end = now() - interval '1 hour'
WHERE id = '73000000-0000-4000-8000-000000000004';

RESET ROLE;
CREATE TEMP TABLE apply_down(v jsonb);
GRANT SELECT ON apply_down TO authenticated;
GRANT INSERT ON apply_down TO service_role;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000001","role":"service_role","aal":"aal2"}', true);
INSERT INTO apply_down SELECT public.apply_pending_subscription_transitions(100);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);

INSERT INTO tap_output SELECT extensions.is(
  (SELECT (v->>'downgraded')::int FROM apply_down), 1,
  'service_role job applies 1 pending downgrade');

INSERT INTO tap_output SELECT extensions.is(
  (SELECT plan_version_id::text FROM public.subscriptions WHERE id='73000000-0000-4000-8000-000000000004'),
  '72000000-0000-4000-8000-000000000011',
  'job applies persisted pending_plan_version_id (v1), not new current_version (v2)');

RESET ROLE;
INSERT INTO tap_output SELECT * FROM extensions.finish();
SELECT line FROM tap_output;
ROLLBACK;
