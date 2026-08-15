-- pgTAP — Contrato de relatórios municipais (ENTREGA B1).
-- Cobre isolamento entre municípios, filtros por data/risco/equipe,
-- agente não consulta dados de outro agente/município e recusa de
-- período inválido ou maior que 366 dias.
-- CORREÇÃO P0/P1: testes adicionados para privacidade de dados individuais,
-- formulário fora de escopo, duplicação de agregados e limite de exportação.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(18);
CREATE TEMP TABLE tap_output(line text);
CREATE TEMP TABLE direct_checks(name text PRIMARY KEY, passed boolean NOT NULL);
GRANT SELECT, INSERT ON direct_checks TO authenticated;

-- Fixture: dois municípios Cataguases e Ubá, cada um com um agente ativo.
-- A RPC de relatório é de leitura; seu scoping server-side é exercitado
-- pelas asserções. As seeds de vistorias/agendamentos disparariam triggers
-- de escrita (atribuição de organização, protocolo oficial, entitlement,
-- bloqueio de test accounts locais) que não pertencem ao contrato sob
-- teste. Desabilitamos nominalmente esses triggers nas duas tabelas, dentro
-- da transação de teste; RLS e scoping da RPC permanecem ativos.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'block_local_test_all_writes' AND tgrelid = 'public.vistorias'::regclass) THEN
    ALTER TABLE public.vistorias DISABLE TRIGGER block_local_test_all_writes;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'block_local_test_vistorias' AND tgrelid = 'public.vistorias'::regclass) THEN
    ALTER TABLE public.vistorias DISABLE TRIGGER block_local_test_vistorias;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'vistorias_assign_organization' AND tgrelid = 'public.vistorias'::regclass) THEN
    ALTER TABLE public.vistorias DISABLE TRIGGER vistorias_assign_organization;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'vistorias_guard_official_protocol_fields' AND tgrelid = 'public.vistorias'::regclass) THEN
    ALTER TABLE public.vistorias DISABLE TRIGGER vistorias_guard_official_protocol_fields;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'zz_vistorias_enforce_entitlement' AND tgrelid = 'public.vistorias'::regclass) THEN
    ALTER TABLE public.vistorias DISABLE TRIGGER zz_vistorias_enforce_entitlement;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'vistorias_complete_customer_onboarding' AND tgrelid = 'public.vistorias'::regclass) THEN
    ALTER TABLE public.vistorias DISABLE TRIGGER vistorias_complete_customer_onboarding;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'vistorias_refresh_public_marketing_snapshot' AND tgrelid = 'public.vistorias'::regclass) THEN
    ALTER TABLE public.vistorias DISABLE TRIGGER vistorias_refresh_public_marketing_snapshot;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'agendamentos_assign_organization' AND tgrelid = 'public.agendamentos'::regclass) THEN
    ALTER TABLE public.agendamentos DISABLE TRIGGER agendamentos_assign_organization;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'block_local_test_agendamentos' AND tgrelid = 'public.agendamentos'::regclass) THEN
    ALTER TABLE public.agendamentos DISABLE TRIGGER block_local_test_agendamentos;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'block_local_test_all_writes' AND tgrelid = 'public.agendamentos'::regclass) THEN
    ALTER TABLE public.agendamentos DISABLE TRIGGER block_local_test_all_writes;
  END IF;
END $$;

INSERT INTO auth.users(id, email, raw_user_meta_data)
VALUES
  ('50000000-0000-4000-8000-000000000001', 'rep-agent-cataguases@example.test', '{}'::jsonb),
  ('50000000-0000-4000-8000-000000000002', 'rep-agent-uba@example.test', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users(uid, email, name, role, "isApproved")
VALUES
  ('50000000-0000-4000-8000-000000000001', 'rep-agent-cataguases@example.test', 'Agente Cataguases', 'agent', true),
  ('50000000-0000-4000-8000-000000000002', 'rep-agent-uba@example.test', 'Agente Ubá', 'agent', true)
ON CONFLICT (uid) DO NOTHING;

INSERT INTO public.organizations(id, slug, display_name, municipality_name, status)
VALUES
  ('51000000-0000-4000-8000-000000000001', 'cataguases-rep', 'Cataguases Rep', 'Cataguases', 'pilot'),
  ('51000000-0000-4000-8000-000000000002', 'uba-rep', 'Ubá Rep', 'Ubá', 'pilot')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organization_members(organization_id, user_id, role, status, joined_at)
VALUES
  ('51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'agent', 'active', now()),
  ('51000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', 'agent', 'active', now())
ON CONFLICT (organization_id, user_id) DO UPDATE SET status='active';

-- Vistorias: 3 em Cataguases (2 alto risco, 1 baixo) e 2 em Ubá (alto).
-- Agente em Cataguases só deve ver as 3 de Cataguases; agente Ubá só as 2 de Ubá.
INSERT INTO public.vistorias(id, organization_id, "agenteUid", "agenteNome", "nivelRisco", "dataVistoria", "criadoEm", status, protocolo, municipio)
VALUES
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001'::text, 'Agente Cataguases', 'alto', now() - interval '2 days', now() - interval '2 days', 'concluida', 'PROT-REP-1', 'Cataguases'),
  ('52000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001'::text, 'Agente Cataguases', 'alto', now() - interval '5 days', now() - interval '5 days', 'concluida', 'PROT-REP-2', 'Cataguases'),
  ('52000000-0000-4000-8000-000000000003', '51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001'::text, 'Agente Cataguases', 'baixo', now() - interval '8 days', now() - interval '8 days', 'pendente', 'PROT-REP-3', 'Cataguases'),
  ('52000000-0000-4000-8000-000000000004', '51000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002'::text, 'Agente Ubá', 'alto', now() - interval '3 days', now() - interval '3 days', 'concluida', 'PROT-UBA-1', 'Ubá'),
  ('52000000-0000-4000-8000-000000000005', '51000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002'::text, 'Agente Ubá', 'baixo', now() - interval '4 days', now() - interval '4 days', 'pendente', 'PROT-UBA-2', 'Ubá');

INSERT INTO public.agendamentos(id, organization_id, titulo, municipio, data_agendada, status, agente_uid)
VALUES
  ('53000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'Visita Cataguases', 'Cataguases', now() - interval '1 day', 'concluido', '50000000-0000-4000-8000-000000000001'),
  ('53000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000002', 'Visita Ubá', 'Ubá', now() - interval '1 day', 'pendente', '50000000-0000-4000-8000-000000000002');

-- 1) Agente Cataguases recebe volume 3 (não enxerga Ubá).
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
SELECT extensions.is(
  (SELECT (public.portal_get_reporting(jsonb_build_object('from', (now() - interval '30 days')::text, 'to', (now() + interval '1 day')::text))->>'volume')::bigint),
  3::bigint,
  'Cataguases agent sees only own 3 inspections'
);

-- 2) Agente Ubá recebe volume 2 (não enxerga Cataguases) — isolamento entre municípios.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"50000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);
SELECT extensions.is(
  (SELECT (public.portal_get_reporting(jsonb_build_object('from', (now() - interval '30 days')::text, 'to', (now() + interval '1 day')::text))->>'volume')::bigint),
  2::bigint,
  'Uba agent sees only own 2 inspections (municipality isolation)'
);

-- 3) Filtro por risco alto em Cataguases retorna 2.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
SELECT extensions.is(
  (SELECT (public.portal_get_reporting(jsonb_build_object('from', (now() - interval '30 days')::text, 'to', (now() + interval '1 day')::text, 'risk', 'alto'))->>'volume')::bigint),
  2::bigint,
  'risk filter restricts to high-risk inspections'
);

-- 4) Filtro por teamMemberId (próprio agente) retorna 3 em Cataguases.
SELECT extensions.is(
  (SELECT (public.portal_get_reporting(jsonb_build_object('from', (now() - interval '30 days')::text, 'to', (now() + interval '1 day')::text, 'teamMemberId', '50000000-0000-4000-8000-000000000001'))->>'volume')::bigint),
  3::bigint,
  'teamMemberId filter scopes to that member'
);

-- 5) Filtro teamMemberId de outro município é recusado (42501).
DO $$
DECLARE
  caught text := 'not_thrown';
  win_from text := (now() - interval '30 days')::text;
  win_to   text := (now() + interval '1 day')::text;
BEGIN
  BEGIN
    PERFORM public.portal_get_reporting(jsonb_build_object('from', win_from, 'to', win_to, 'teamMemberId', '50000000-0000-4000-8000-000000000002'));
  EXCEPTION WHEN others THEN
    caught := SQLSTATE;
  END;
  INSERT INTO direct_checks VALUES('team_cross_muni_rejected', caught = '42501');
END $$;
SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='team_cross_muni_rejected'),
  'teamMemberId from another municipality is rejected (42501)'
);

-- CORREÇÃO P0: Supervisor não pode consultar dados individuais de outro Agent.
-- Criar segundo Agent em Cataguases para testar privacidade dentro do mesmo município.
INSERT INTO auth.users(id, email, raw_user_meta_data)
VALUES ('50000000-0000-4000-8000-000000000003', 'supervisor-cataguases@example.test', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users(uid, email, name, role, "isApproved")
VALUES ('50000000-0000-4000-8000-000000000003', 'supervisor-cataguases@example.test', 'Supervisor Cataguases', 'supervisor', true)
ON CONFLICT (uid) DO NOTHING;

INSERT INTO public.organization_members(organization_id, user_id, role, status, joined_at)
VALUES ('51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', 'supervisor', 'active', now())
ON CONFLICT (organization_id, user_id) DO UPDATE SET status='active';

-- Criar segundo Agent em Cataguases.
INSERT INTO auth.users(id, email, raw_user_meta_data)
VALUES ('50000000-0000-4000-8000-000000000004', 'agent-2-cataguases@example.test', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users(uid, email, name, role, "isApproved")
VALUES ('50000000-0000-4000-8000-000000000004', 'agent-2-cataguases@example.test', 'Agente 2 Cataguases', 'agent', true)
ON CONFLICT (uid) DO NOTHING;

INSERT INTO public.organization_members(organization_id, user_id, role, status, joined_at)
VALUES ('51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000004', 'agent', 'active', now())
ON CONFLICT (organization_id, user_id) DO UPDATE SET status='active';

-- Vistoria do segundo Agent.
INSERT INTO public.vistorias(id, organization_id, "agenteUid", "agenteNome", "nivelRisco", "dataVistoria", "criadoEm", status, protocolo, municipio)
VALUES ('52000000-0000-4000-8000-000000000006', '51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000004'::text, 'Agente 2 Cataguases', 'alto', now() - interval '1 day', now() - interval '1 day', 'concluida', 'PROT-REP-4', 'Cataguases');

-- 5B) Supervisor tentando consultar dados do Agent 1 é recusado (42501).
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"50000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}', true);
DO $$
DECLARE
  caught text := 'not_thrown';
  win_from text := (now() - interval '30 days')::text;
  win_to   text := (now() + interval '1 day')::text;
BEGIN
  BEGIN
    PERFORM public.portal_get_reporting(jsonb_build_object('from', win_from, 'to', win_to, 'teamMemberId', '50000000-0000-4000-8000-000000000001'));
  EXCEPTION WHEN others THEN
    caught := SQLSTATE;
  END;
  INSERT INTO direct_checks VALUES('supervisor_cannot_access_other_agent', caught = '42501');
END $$;
SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='supervisor_cannot_access_other_agent'),
  'Supervisor cannot access another agent individual data (42501)'
);

-- 5C) Agent 1 tentando consultar dados do Agent 2 é recusado (42501).
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
DO $$
DECLARE
  caught text := 'not_thrown';
  win_from text := (now() - interval '30 days')::text;
  win_to   text := (now() + interval '1 day')::text;
BEGIN
  BEGIN
    PERFORM public.portal_get_reporting(jsonb_build_object('from', win_from, 'to', win_to, 'teamMemberId', '50000000-0000-4000-8000-000000000004'));
  EXCEPTION WHEN others THEN
    caught := SQLSTATE;
  END;
  INSERT INTO direct_checks VALUES('agent_cannot_access_other_agent', caught = '42501');
END $$;
SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='agent_cannot_access_other_agent'),
  'Agent cannot access another agent individual data (42501)'
);

-- 6) Período inválido (from > to) é recusado (22023).
DO $$
DECLARE
  caught text := 'not_thrown';
BEGIN
  BEGIN
    PERFORM public.portal_get_reporting(jsonb_build_object('from', (now() + interval '1 day')::text, 'to', (now() - interval '1 day')::text));
  EXCEPTION WHEN others THEN
    caught := SQLSTATE;
  END;
  INSERT INTO direct_checks VALUES('invalid_range_rejected', caught = '22023');
END $$;
SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='invalid_range_rejected'),
  'invalid date range is rejected (22023)'
);

-- 7) Período maior que 366 dias é recusado (22023).
DO $$
DECLARE
  caught text := 'not_thrown';
BEGIN
  BEGIN
    PERFORM public.portal_get_reporting(jsonb_build_object('from', (now() - interval '400 days')::text, 'to', now()::text));
  EXCEPTION WHEN others THEN
    caught := SQLSTATE;
  END;
  INSERT INTO direct_checks VALUES('period_too_long_rejected', caught = '22023');
END $$;
SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='period_too_long_rejected'),
  'period longer than 366 days is rejected (22023)'
);

-- Precisamente 366 dias é aceito.
SELECT extensions.ok(
  (SELECT public.portal_get_reporting(jsonb_build_object('from', (now() - interval '365 days')::text, 'to', now()::text)) IS NOT NULL),
  '366-day window is accepted'
);

-- 8) Data inválida (texto não-parseável) é recusada (22023).
DO $$
DECLARE
  caught text := 'not_thrown';
BEGIN
  BEGIN
    PERFORM public.portal_get_reporting(jsonb_build_object('from', 'not-a-date', 'to', (now() + interval '1 day')::text));
  EXCEPTION WHEN others THEN
    caught := SQLSTATE;
  END;
  INSERT INTO direct_checks VALUES('bad_date_rejected', caught = '22023');
END $$;
SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='bad_date_rejected'),
  'non-parseable date is rejected (22023)'
);

-- 9) Distribuição de risco em Cataguases agrega alto=2, baixo=1.
SELECT extensions.is(
  (SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(public.portal_get_reporting(jsonb_build_object('from', (now() - interval '30 days')::text, 'to', (now() + interval '1 day')::text))->'risk'->'breakdown') AS bucket
    WHERE bucket->>'risk' = 'alto' AND (bucket->>'count')::int = 2
  )),
  true,
  'risk breakdown includes alto bucket with count 2'
);

-- 10) Produtividade lista apenas membros do município (Cataguases: 1).
WITH rep10 AS (SELECT public.portal_get_reporting(jsonb_build_object('from', (now() - interval '30 days')::text, 'to', (now() + interval '1 day')::text)) AS r)
SELECT extensions.is((SELECT jsonb_array_length(r->'productivity') FROM rep10), 1, 'productivity lists only own municipality members');

-- 11) Escopo retornado reflete a organização do chamador (não a do outro município).
WITH rep11 AS (SELECT public.portal_get_reporting(jsonb_build_object('from', (now() - interval '30 days')::text, 'to', (now() + interval '1 day')::text)) AS r)
SELECT extensions.is((SELECT r->'scope'->>'organizationId' FROM rep11), '51000000-0000-4000-8000-000000000001', 'scope organizationId resolved server-side to Cataguases');

-- 12) Linhas de exportação não vazias e dentro do escopo (Cataguases: 3 linhas).
WITH rep12 AS (SELECT public.portal_get_reporting(jsonb_build_object('from', (now() - interval '30 days')::text, 'to', (now() + interval '1 day')::text)) AS r)
SELECT extensions.is((SELECT jsonb_array_length(r->'export'->'rows') FROM rep12), 4, 'export rows limited to own municipality (now 4 with agent 2)');

-- CORREÇÃO P0: Teste de formulário UUID fora do escopo (outro município).
-- Criar formulário em Ubá e tentar consultá-lo como agente Cataguases.
INSERT INTO public.formularios(id, municipio, versao, ativo, "criadoEm")
VALUES ('54000000-0000-4000-8000-000000000001', 'Ubá', 1, true, now())
ON CONFLICT (id) DO NOTHING;

-- 13) UUID de formulário de outro município deve falhar (42501).
DO $$
DECLARE
  caught text := 'not_thrown';
  win_from text := (now() - interval '30 days')::text;
  win_to   text := (now() + interval '1 day')::text;
BEGIN
  BEGIN
    PERFORM public.portal_get_reporting(jsonb_build_object('from', win_from, 'to', win_to, 'formId', '54000000-0000-4000-8000-000000000001'));
  EXCEPTION WHEN others THEN
    caught := SQLSTATE;
  END;
  INSERT INTO direct_checks VALUES('form_cross_muni_rejected', caught = '42501');
END $$;
SELECT extensions.ok(
  (SELECT passed FROM direct_checks WHERE name='form_cross_muni_rejected'),
  'formId UUID from another municipality is rejected (42501)'
);

-- CORREÇÃO P0: Teste de agregados duplicados (documentos + ciência).
-- Criar documentos e eventos de ciência para garantir que não há duplicação.
INSERT INTO public.generated_documents(id, organization_id, vistoria_id, status, created_by, created_at)
VALUES
  ('55000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000001', 'completed', '50000000-0000-4000-8000-000000000001', now() - interval '1 day'),
  ('55000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000002', 'pending', '50000000-0000-4000-8000-000000000001', now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.document_acknowledgement_events(id, organization_id, document_id, outcome, created_by, recorded_at_server)
VALUES
  ('56000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', '55000000-0000-4000-8000-000000000001', 'delivered', '50000000-0000-4000-8000-000000000001', now() - interval '1 day'),
  ('56000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000001', '55000000-0000-4000-8000-000000000002', 'pending', '50000000-0000-4000-8000-000000000001', now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

-- 14) Agregados de documentos não duplicam por causa de ciência.
WITH rep14 AS (SELECT public.portal_get_reporting(jsonb_build_object('from', (now() - interval '30 days')::text, 'to', (now() + interval '1 day')::text)) AS r)
SELECT extensions.is(
  (SELECT sum((bucket->>'count')::int) FROM jsonb_array_elements((SELECT r->'documents'->'documents' FROM rep14)) AS bucket),
  2::bigint,
  'documents aggregate is not duplicated by acknowledgements join'
);

-- 15) Agregados de ciência não duplicam por causa de documentos.
WITH rep15 AS (SELECT public.portal_get_reporting(jsonb_build_object('from', (now() - interval '30 days')::text, 'to', (now() + interval '1 day')::text)) AS r)
SELECT extensions.is(
  (SELECT sum((bucket->>'count')::int) FROM jsonb_array_elements((SELECT r->'documents'->'acknowledgements' FROM rep15)) AS bucket),
  2::bigint,
  'acknowledgements aggregate is not duplicated by documents join'
);

-- CORREÇÃO P0: Teste de limite de exportação aplicado antes de jsonb_agg.
-- Criar 550 vistorias para garantir que o limite de 500 é aplicado.
DO $$
DECLARE
  i integer;
BEGIN
  FOR i IN 1..550 LOOP
    INSERT INTO public.vistorias(id, organization_id, "agenteUid", "agenteNome", "nivelRisco", "dataVistoria", "criadoEm", status, protocolo, municipio)
    VALUES (
      ('57000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
      '51000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001'::text,
      'Agente Cataguases',
      'baixo',
      now() - interval '1 day',
      now() - interval '1 day',
      'pendente',
      'PROT-BULK-' || i::text,
      'Cataguases'
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- 16) Exportação limitada a 500 linhas mesmo com 554 vistorias (4 originais + 550 bulk).
WITH rep16 AS (SELECT public.portal_get_reporting(jsonb_build_object('from', (now() - interval '30 days')::text, 'to', (now() + interval '1 day')::text)) AS r)
SELECT extensions.is(
  (SELECT jsonb_array_length(r->'export'->'rows') FROM rep16),
  500,
  'export rows bounded to 500 even with 554 inspections'
);

-- 17) Volume reflete todas as 554 vistorias (não limitado como exportação).
SELECT extensions.is(
  (SELECT (public.portal_get_reporting(jsonb_build_object('from', (now() - interval '30 days')::text, 'to', (now() + interval '1 day')::text))->>'volume')::bigint),
  554::bigint,
  'volume reflects all inspections, not limited by export bound'
);

RESET ROLE;
INSERT INTO tap_output SELECT * FROM extensions.finish();
SELECT jsonb_agg(line) AS tap_results FROM tap_output;
ROLLBACK;
