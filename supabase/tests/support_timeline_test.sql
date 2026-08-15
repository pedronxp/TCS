-- pgTAP — Contrato de suporte com timeline segura (ENTREGA B4).
-- Cobre: timeline do cliente filtra notas internas; escopo requester/org;
-- resposta do cliente via portal; nota interna nunca visível ao cliente;
-- resposta interna compartilhada aparece na timeline; gates de permissão
-- (support.write) e AAL2; auditoria; idempotência.
--
-- Nota técnica: SET LOCAL e set_config(is_local=true) dentro de funções
-- pg_temp são revertidos ao fim da chamada da função. Por isso a sessão é
-- configurada inline (RESET ROLE; SET LOCAL ROLE; SELECT set_config) em
-- statements de nível superior, que persistem até o COMMIT/ROLLBACK da
-- transação de teste. Erros esperados usam DO blocks (PERFORM interno).

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(24);
CREATE TEMP TABLE tap_output(line text);
CREATE TEMP TABLE direct_checks(name text PRIMARY KEY, passed boolean NOT NULL);
GRANT SELECT, INSERT ON tap_output, direct_checks TO authenticated;

-- Seed de identidades (owner, support, client, stranger).
ALTER TABLE public.users DISABLE TRIGGER block_local_test_all_writes;
ALTER TABLE public.users DISABLE TRIGGER block_local_test_users;
ALTER TABLE public.users DISABLE TRIGGER users_protect_authorization_fields;

INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES
  ('90000000-0000-4000-8000-000000000001', 'b4-owner@example.test',   '{}'::jsonb),
  ('90000000-0000-4000-8000-000000000002', 'b4-support@example.test', '{}'::jsonb),
  ('90000000-0000-4000-8000-000000000003', 'b4-client@example.test',  '{}'::jsonb),
  ('90000000-0000-4000-8000-000000000004', 'b4-stranger@example.test','{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users(uid, email, name, role, municipio, "isApproved") VALUES
  ('90000000-0000-4000-8000-000000000001', 'b4-owner@example.test',   'B4 Owner',   'agent', NULL, true),
  ('90000000-0000-4000-8000-000000000002', 'b4-support@example.test', 'B4 Support', 'agent', NULL, true),
  ('90000000-0000-4000-8000-000000000003', 'b4-client@example.test',  'B4 Client',  'agent', NULL, true),
  ('90000000-0000-4000-8000-000000000004', 'b4-stranger@example.test','B4 Stranger','agent', NULL, true)
ON CONFLICT (uid) DO UPDATE SET
  email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role,
  municipio = EXCLUDED.municipio, "isApproved" = EXCLUDED."isApproved";

INSERT INTO public.internal_staff(user_id, role, status, display_name) VALUES
  ('90000000-0000-4000-8000-000000000001', 'owner',   'active', 'B4 Owner'),
  ('90000000-0000-4000-8000-000000000002', 'support', 'active', 'B4 Support')
ON CONFLICT (user_id) DO UPDATE SET role=EXCLUDED.role, status=EXCLUDED.status;

ALTER TABLE public.users ENABLE TRIGGER block_local_test_all_writes;
ALTER TABLE public.users ENABLE TRIGGER block_local_test_users;
ALTER TABLE public.users ENABLE TRIGGER users_protect_authorization_fields;

INSERT INTO public.organizations(id, slug, display_name, municipality_name, status) VALUES
  ('94000000-0000-4000-8000-000000000001', 'b4-org', 'B4 Org', 'Cataguases', 'pilot')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.support_tickets(id, organization_id, requester_id, user_id, category, subject, description, priority, status)
VALUES ('95000000-0000-4000-8000-000000000001',
  '94000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000003',
  '90000000-0000-4000-8000-000000000003',
  'tecnico', 'Não consigo exportar relatório', 'Falha ao exportar PDF', 'normal', 'open')
ON CONFLICT (id) DO UPDATE SET
  organization_id=EXCLUDED.organization_id, requester_id=EXCLUDED.requester_id, user_id=EXCLUDED.user_id,
  category=EXCLUDED.category, subject=EXCLUDED.subject, description=EXCLUDED.description,
  priority=EXCLUDED.priority, status='open';

-- Sessão support (AAL2).
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);

-- 1) Nota interna do atendente (visibility=internal) é registrada.
CREATE TEMP TABLE note AS
  SELECT public.internal_add_support_note(
    '95000000-0000-4000-8000-000000000001',
    'Cliente pode estar em plano sem exportação',
    'triagem interna do chamado','96000000-0000-4000-8000-000000000001') AS v;
GRANT SELECT ON note TO authenticated;
INSERT INTO tap_output SELECT extensions.is(
  (SELECT (v->>'visibility')::text FROM note), 'internal',
  'internal note stored with visibility=internal');
INSERT INTO tap_output SELECT extensions.is(
  (SELECT count(*)::bigint FROM public.support_ticket_events
   WHERE ticket_id='95000000-0000-4000-8000-000000000001'
     AND event_type='internal_note'
     AND metadata->>'visibility'='internal'),
  1::bigint, 'internal note event persisted');

-- Sessão client (AAL2).
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}', true);

-- 2) Nota interna NÃO aparece na timeline do cliente.
INSERT INTO tap_output SELECT extensions.is(
  (SELECT jsonb_array_length(t->'events') FROM
    (SELECT public.portal_get_support_timeline('95000000-0000-4000-8000-000000000001') AS t) s),
  0, 'client timeline excludes internal notes');

-- Sessão support.
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);

-- 3) Resposta interna compartilhada (visibility=shared) aparece na timeline.
CREATE TEMP TABLE reply AS
  SELECT public.internal_reply_support_ticket(
    '95000000-0000-4000-8000-000000000001',
    'Estamos verificando a exportação do seu plano',
    'resposta inicial ao cliente','96000000-0000-4000-8000-000000000002') AS v;
GRANT SELECT ON reply TO authenticated;
INSERT INTO tap_output SELECT extensions.is(
  (SELECT (v->>'visibility')::text FROM reply), 'shared',
  'staff reply stored with visibility=shared');

-- Sessão client para ler timeline.
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}', true);
INSERT INTO tap_output SELECT extensions.is(
  (SELECT jsonb_array_length(t->'events') FROM
    (SELECT public.portal_get_support_timeline('95000000-0000-4000-8000-000000000001') AS t) s),
  1, 'client timeline shows shared staff reply');
INSERT INTO tap_output SELECT extensions.is(
  (SELECT t->'events'->0->>'message' FROM
    (SELECT public.portal_get_support_timeline('95000000-0000-4000-8000-000000000001') AS t) s),
  'Estamos verificando a exportação do seu plano',
  'shared reply message visible to client');

-- 4) Resposta do cliente via portal move status waiting_customer -> in_progress.
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);
-- Outra resposta interna põe status=waiting_customer.
SELECT public.internal_reply_support_ticket(
  '95000000-0000-4000-8000-000000000001',
  'segue o seu plano atual','atualização para o cliente','96000000-0000-4000-8000-000000000003');
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}', true);
CREATE TEMP TABLE creply AS
  SELECT public.portal_reply_support_ticket(
    '95000000-0000-4000-8000-000000000001',
    'aguardo retorno com o PDF') AS v;
GRANT SELECT ON creply TO authenticated;
INSERT INTO tap_output SELECT extensions.is(
  (SELECT (v->>'visibility')::text FROM creply), 'shared',
  'client reply stored with visibility=shared');
INSERT INTO tap_output SELECT extensions.is(
  (SELECT status FROM public.support_tickets WHERE id='95000000-0000-4000-8000-000000000001'),
  'in_progress', 'client reply reopens ticket from waiting_customer');
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT jsonb_array_length(t->'events') >= 2 FROM
    (SELECT public.portal_get_support_timeline('95000000-0000-4000-8000-000000000001') AS t) s),
  'client reply appears in client timeline');

-- 5) Estranho (sem escopo) não vê a timeline do ticket.
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}', true);
INSERT INTO tap_output SELECT extensions.is(
  (SELECT t->>'ticket' FROM
    (SELECT public.portal_get_support_timeline('95000000-0000-4000-8000-000000000001') AS t) s),
  NULL, 'stranger cannot see ticket (null ticket, empty events)');
INSERT INTO tap_output SELECT extensions.is(
  (SELECT jsonb_array_length(t->'events') FROM
    (SELECT public.portal_get_support_timeline('95000000-0000-4000-8000-000000000001') AS t) s),
  0, 'stranger sees no events');

-- 6) Estranho não pode responder ao ticket (mesmo erro ticket_not_found).
DO $$
DECLARE caught text := 'not_thrown';
BEGIN
  BEGIN
    PERFORM public.portal_reply_support_ticket(
      '95000000-0000-4000-8000-000000000001','tentativa externa');
  EXCEPTION WHEN others THEN caught := SQLSTATE; END;
  INSERT INTO direct_checks VALUES('stranger_reply_denied', caught = 'P0002');
END $$;
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='stranger_reply_denied'),
  'stranger cannot reply (ticket_not_found)');

-- 7) Cliente em ticket fechado não pode responder.
RESET ROLE;
UPDATE public.support_tickets SET status='closed' WHERE id='95000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}', true);
DO $$
DECLARE caught text := 'not_thrown';
BEGIN
  BEGIN
    PERFORM public.portal_reply_support_ticket(
      '95000000-0000-4000-8000-000000000001','resposta em ticket fechado');
  EXCEPTION WHEN others THEN caught := SQLSTATE; END;
  INSERT INTO direct_checks VALUES('closed_reply_denied', caught = '22023');
END $$;
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='closed_reply_denied'),
  'client cannot reply to closed ticket');
RESET ROLE;
UPDATE public.support_tickets SET status='open' WHERE id='95000000-0000-4000-8000-000000000001';

-- 8) Cliente não pode criar nota interna (support.write necessário).
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}', true);
DO $$
DECLARE caught text := 'not_thrown';
BEGIN
  BEGIN
    PERFORM public.internal_add_support_note(
      '95000000-0000-4000-8000-000000000001','nota fingida','razão fingida','96000000-0000-4000-8000-000000000004');
  EXCEPTION WHEN others THEN caught := SQLSTATE; END;
  INSERT INTO direct_checks VALUES('client_no_internal_note', caught = '42501');
END $$;
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='client_no_internal_note'),
  'client cannot create internal note (support.write)');

-- 9) Nota interna exige AAL2.
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', true);
DO $$
DECLARE caught text := 'not_thrown';
BEGIN
  BEGIN
    PERFORM public.internal_add_support_note(
      '95000000-0000-4000-8000-000000000001','sem aal2','razão sem aal2','96000000-0000-4000-8000-000000000005');
  EXCEPTION WHEN others THEN caught := SQLSTATE; END;
  INSERT INTO direct_checks VALUES('note_aal2', caught = '42501');
END $$;
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='note_aal2'),
  'internal note requires AAL2');

-- 10) Nota interna exige justificativa 8-500.
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);
DO $$
DECLARE caught text := 'not_thrown';
BEGIN
  BEGIN
    PERFORM public.internal_add_support_note(
      '95000000-0000-4000-8000-000000000001','conteúdo ok','curta','96000000-0000-4000-8000-000000000006');
  EXCEPTION WHEN others THEN caught := SQLSTATE; END;
  INSERT INTO direct_checks VALUES('note_reason_length', caught = '22023');
END $$;
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='note_reason_length'),
  'internal note requires reason 8-500');

-- 11) Resposta interna é auditada (visibility=shared).
RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT count(*)::bigint FROM public.internal_access_events
   WHERE actor_id='90000000-0000-4000-8000-000000000002'
     AND action='support.internal_reply'
     AND target_id='95000000-0000-4000-8000-000000000001'
     AND result='allowed') >= 1,
  'staff reply audited as support.internal_reply');

-- 12) Nota interna auditada com visibility=internal (sem expor conteúdo).
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT count(*)::bigint FROM public.internal_access_events
   WHERE actor_id='90000000-0000-4000-8000-000000000002'
     AND action='support.internal_note'
     AND target_id='95000000-0000-4000-8000-000000000001'
     AND (metadata->>'visibility')='internal') >= 1,
  'internal note audited with visibility=internal');

-- 13) Idempotência: mesma nota interna gera uma única operação.
CREATE TEMP TABLE idem1 AS
  SELECT public.internal_add_support_note(
    '95000000-0000-4000-8000-000000000001',
    'nota idempotente','razão idempotente','96000000-0000-4000-8000-000000000007') AS v;
CREATE TEMP TABLE idem2 AS
  SELECT public.internal_add_support_note(
    '95000000-0000-4000-8000-000000000001',
    'nota idempotente','razão idempotente','96000000-0000-4000-8000-000000000007') AS v;
GRANT SELECT ON idem1 TO authenticated;
GRANT SELECT ON idem2 TO authenticated;
INSERT INTO tap_output SELECT extensions.is(
  (SELECT count(*)::bigint FROM public.internal_operations WHERE operation_id='96000000-0000-4000-8000-000000000007'),
  1::bigint, 'internal note idempotent (one operation row)');

-- CORREÇÃO P0: Fail-closed para visibility — apenas 'shared' explícito aparece.
-- 14) Evento sem visibility não aparece na timeline do cliente.
RESET ROLE;
INSERT INTO public.support_ticket_events(ticket_id, actor_id, event_type, message, metadata)
VALUES ('95000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002', 'status_change', 'status alterado', '{}'::jsonb);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}', true);

CREATE TEMP TABLE tl_no_visibility AS
  SELECT public.portal_get_support_timeline('95000000-0000-4000-8000-000000000001') AS t;
GRANT SELECT ON tl_no_visibility TO authenticated;

INSERT INTO tap_output SELECT extensions.ok(
  (SELECT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements((SELECT t->'events' FROM tl_no_visibility)) AS ev
    WHERE ev->>'event_type' = 'status_change'
  )),
  'event without visibility metadata does not appear in client timeline (fail-closed)'
);

-- 15) Evento com visibility='internal' não aparece na timeline do cliente.
RESET ROLE;
INSERT INTO public.support_ticket_events(ticket_id, actor_id, event_type, message, metadata)
VALUES ('95000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002', 'internal_flag', 'marcação interna', '{"visibility":"internal"}'::jsonb);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}', true);

CREATE TEMP TABLE tl_internal AS
  SELECT public.portal_get_support_timeline('95000000-0000-4000-8000-000000000001') AS t;
GRANT SELECT ON tl_internal TO authenticated;

INSERT INTO tap_output SELECT extensions.ok(
  (SELECT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements((SELECT t->'events' FROM tl_internal)) AS ev
    WHERE ev->>'event_type' = 'internal_flag'
  )),
  'event with visibility=internal does not appear in client timeline'
);

-- 16) Evento com visibility desconhecida não aparece na timeline do cliente.
RESET ROLE;
INSERT INTO public.support_ticket_events(ticket_id, actor_id, event_type, message, metadata)
VALUES ('95000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002', 'unknown_visibility', 'evento com visibilidade desconhecida', '{"visibility":"unknown_value"}'::jsonb);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}', true);

CREATE TEMP TABLE tl_unknown AS
  SELECT public.portal_get_support_timeline('95000000-0000-4000-8000-000000000001') AS t;
GRANT SELECT ON tl_unknown TO authenticated;

INSERT INTO tap_output SELECT extensions.ok(
  (SELECT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements((SELECT t->'events' FROM tl_unknown)) AS ev
    WHERE ev->>'event_type' = 'unknown_visibility'
  )),
  'event with unknown visibility value does not appear in client timeline (fail-closed)'
);

-- 17) Somente eventos explicitamente shared aparecem.
CREATE TEMP TABLE tl_final AS
  SELECT public.portal_get_support_timeline('95000000-0000-4000-8000-000000000001') AS t;
GRANT SELECT ON tl_final TO authenticated;

INSERT INTO tap_output SELECT extensions.ok(
  (SELECT bool_and(ev->>'visibility' = 'shared')
   FROM jsonb_array_elements((SELECT t->'events' FROM tl_final)) AS ev),
  'all events in client timeline have visibility=shared explicitly'
);

-- CORREÇÃO P0: Checagem de status após carregar o ticket.
-- 18) Criar novo ticket para testar ordem de checagem.
RESET ROLE;
INSERT INTO public.support_tickets(id, organization_id, requester_id, user_id, category, subject, description, priority, status)
VALUES ('95000000-0000-4000-8000-000000000002',
  '94000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000003',
  '90000000-0000-4000-8000-000000000003',
  'comercial', 'Dúvida sobre upgrade', 'Gostaria de fazer upgrade', 'normal', 'closed')
ON CONFLICT (id) DO UPDATE SET
  organization_id=EXCLUDED.organization_id, requester_id=EXCLUDED.requester_id, user_id=EXCLUDED.user_id,
  category=EXCLUDED.category, subject=EXCLUDED.subject, description=EXCLUDED.description,
  priority=EXCLUDED.priority, status='closed';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}', true);

-- Cliente tenta responder a ticket fechado; erro deve ser 'ticket_closed' (22023), não 'not_found'.
DO $$
DECLARE caught text := 'not_thrown';
BEGIN
  BEGIN
    PERFORM public.portal_reply_support_ticket(
      '95000000-0000-4000-8000-000000000002','tentativa responder fechado');
  EXCEPTION WHEN others THEN caught := SQLSTATE; END;
  INSERT INTO direct_checks VALUES('closed_ticket_after_load', caught = '22023');
END $$;
INSERT INTO tap_output SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='closed_ticket_after_load'),
  'status check happens after ticket is loaded (correct error code 22023)'
);

RESET ROLE;
INSERT INTO tap_output SELECT * FROM extensions.finish();
SELECT jsonb_agg(line) AS tap_results FROM tap_output;
ROLLBACK;
