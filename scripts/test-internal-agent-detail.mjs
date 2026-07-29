import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL(
  '../supabase/migrations/20260718234037_internal_agent_operational_detail.sql',
  import.meta.url,
), 'utf8');
const reconciliationMigration = await readFile(new URL(
  '../supabase/migrations/20260719033155_reconcile_legacy_agent_identities.sql',
  import.meta.url,
), 'utf8');
const agentNamesMigration = await readFile(new URL(
  '../supabase/migrations/20260721203142_expose_internal_inspection_agent_names.sql',
  import.meta.url,
), 'utf8');
const lastAccessMigration = await readFile(new URL(
  '../supabase/migrations/20260721204431_enrich_internal_customer_last_access.sql',
  import.meta.url,
), 'utf8');
const db = new PGlite();

const ownerId = '11111111-1111-4111-8111-111111111111';
const developerId = '22222222-2222-4222-8222-222222222222';
const agentId = '33333333-3333-4333-8333-333333333333';
const outsiderId = '44444444-4444-4444-8444-444444444444';
const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

await db.exec(`
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE SCHEMA auth;
  CREATE SCHEMA private;
  CREATE SCHEMA extensions;
  CREATE TABLE auth.users (id uuid PRIMARY KEY, encrypted_password text, updated_at timestamptz DEFAULT now(), last_sign_in_at timestamptz);
  CREATE TABLE auth.sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
  $$;
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
    SELECT coalesce(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  $$;
  CREATE FUNCTION extensions.gen_salt(text) RETURNS text LANGUAGE sql AS $$ SELECT 'salt'; $$;
  CREATE FUNCTION extensions.crypt(text, text) RETURNS text LANGUAGE sql AS $$ SELECT 'hashed:' || $1; $$;

  CREATE TABLE public.internal_staff (user_id uuid PRIMARY KEY, role text, status text);
  CREATE TABLE public.organizations (
    id uuid PRIMARY KEY, display_name text NOT NULL, legal_name text,
    municipality_name text, state_code text, status text, contact_name text,
    contact_email text, contract_reference text, session_policy text,
    session_timeout_minutes integer, offline_tolerance_minutes integer,
    created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
  );
  CREATE TABLE public.users (
    uid uuid PRIMARY KEY, name text, email text, phone text, role text, "isApproved" boolean,
    "createdAt" timestamptz, "lastLogin" timestamptz, organization_id uuid, municipio text
  );
  CREATE TABLE public.organization_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
    user_id uuid NOT NULL, role text, status text, joined_at timestamptz, updated_at timestamptz DEFAULT now()
  );
  CREATE TABLE public.plans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text);
  CREATE TABLE public.subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, user_id uuid,
    plan_id uuid, status text, starts_at timestamptz, trial_ends_at timestamptz,
    current_period_start timestamptz, current_period_end timestamptz,
    grace_ends_at timestamptz, canceled_at timestamptz, overrides jsonb,
    created_at timestamptz DEFAULT now()
  );
  CREATE TABLE public.usage_counters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, user_id uuid,
    resource_code text, consumed bigint, period_start timestamptz, period_end timestamptz
  );
  CREATE TABLE public.plan_limits (
    plan_id uuid, resource_code text, hard_limit bigint, warning_percent integer
  );
  CREATE TABLE public.vistorias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "agenteUid" uuid, organization_id uuid,
    "agenteNome" text,
    "dataVistoria" timestamptz, "criadoEm" timestamptz, "nivelRisco" text, status text,
    "formularioId" text, "formularioVersao" integer, "pontuacaoTotal" numeric,
    sincronizado boolean, protocolo text, endereco text, "enderecoRua" text,
    "enderecoNumero" text, "enderecoBairro" text, latitude double precision,
    longitude double precision, laudo_gerado_em timestamptz, relatorio_gerado_em timestamptz,
    termo_gerado_em timestamptz, storage_location text DEFAULT 'supabase', laudo_url text,
    municipio text
  );
  CREATE TABLE public.agendamentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, agente_uid uuid,
    data_agendada timestamptz, titulo text, status text, endereco text, agente_nome text,
    lat double precision, lng double precision
  );
  CREATE TABLE public.active_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, organization_id uuid,
    device_name text, platform text, status text, started_at timestamptz,
    last_heartbeat_at timestamptz, ended_at timestamptz, ended_by uuid, end_reason text
  );
  CREATE TABLE public.technical_events (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, user_id uuid, app_version text,
    platform text, category text, severity text, summary text, correlation_id text,
    occurred_at timestamptz
  );
  CREATE TABLE public.internal_access_events (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, actor_id uuid, actor_role text,
    action text, target_type text, target_id text, result text, reason text,
    metadata jsonb DEFAULT '{}'::jsonb, created_at timestamptz DEFAULT now()
  );
  CREATE TABLE public.internal_operations (
    operation_id uuid, actor_id uuid, action text, request_hash text, status text DEFAULT 'processing',
    result jsonb, completed_at timestamptz, UNIQUE(actor_id, operation_id)
  );
  CREATE TABLE public.support_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), public_code text, subject text,
    priority text, status text, assigned_to uuid, response_due_at timestamptz,
    resolution_due_at timestamptz, escalate_at timestamptz, created_at timestamptz DEFAULT now(),
    organization_id uuid, user_id uuid
  );
  CREATE TABLE public.organization_onboarding (
    organization_id uuid PRIMARY KEY, status text
  );
  CREATE TABLE public.subscription_audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid,
    event_type text, entity_type text, entity_id text, metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
  );
  CREATE FUNCTION public.get_internal_customer_detail(text) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb; $$;
  CREATE FUNCTION public.get_internal_customer_operations(text) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb; $$;

  CREATE FUNCTION private.current_internal_role(p_user_id uuid DEFAULT auth.uid()) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT role FROM public.internal_staff WHERE user_id = p_user_id AND status = 'active';
  $$;
  CREATE FUNCTION private.has_internal_permission(permission text, p_user_id uuid DEFAULT auth.uid()) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT CASE private.current_internal_role(p_user_id)
      WHEN 'owner' THEN permission = ANY(ARRAY['customer.read','customer.write','technical.read'])
      WHEN 'developer' THEN permission = ANY(ARRAY['customer.read','technical.read'])
      ELSE false END;
  $$;
  CREATE FUNCTION private.can_access_sensitive_customer(text, p_user_id uuid DEFAULT auth.uid()) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT private.current_internal_role(p_user_id) = 'owner'
      OR current_setting('request.sensitive', true) = 'on';
  $$;
  CREATE FUNCTION private.has_aal2() RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2';
  $$;
  CREATE FUNCTION private.sanitize_internal_metadata(metadata jsonb) RETURNS jsonb
  LANGUAGE sql STABLE AS $$ SELECT metadata; $$;

  INSERT INTO auth.users(id) VALUES
    ('${ownerId}'), ('${developerId}'), ('${agentId}'), ('${outsiderId}');
  INSERT INTO public.internal_staff VALUES ('${ownerId}', 'owner', 'active'), ('${developerId}', 'developer', 'active');
  INSERT INTO public.organizations(id, display_name) VALUES ('${organizationId}', 'Defesa Civil Teste');
  INSERT INTO public.users(uid,name,email,phone,role,"isApproved","createdAt","lastLogin",organization_id,municipio) VALUES
    ('${agentId}', 'Agente Teste', 'agente@test.local', '32999990000', 'agent', true, now() - interval '1 year', now(), '${organizationId}', 'Teste'),
    ('${outsiderId}', 'Fora do cliente', 'fora@test.local', null, 'agent', true, now(), now(), null, 'Teste'),
    ('adc381cc-bbda-472b-9669-17150102b0a6', 'Carlos Alexandre Rodrigues Faria', 'tcscursos199@gmail.com', null, 'supervisor', true, now(), now(), null, 'Cataguases'),
    ('d259fdb1-51db-417d-aec7-912ad358a28d', 'Carlos Alexandre Rodrigues Faria', 'carlimkta@gmail.com', null, 'master_admin', true, now() - interval '1 year', now(), null, 'Cataguases');
  INSERT INTO public.organization_members(organization_id, user_id, role, status, joined_at)
  VALUES ('${organizationId}', '${agentId}', 'agent', 'active', now() - interval '1 year');
  INSERT INTO public.vistorias("agenteUid", organization_id, "dataVistoria", "criadoEm", "nivelRisco", status, "formularioId", protocolo, latitude, longitude, laudo_gerado_em, relatorio_gerado_em, laudo_url, municipio)
  VALUES
    ('${agentId}', null, now() - interval '1 day', now() - interval '1 day', 'r2', 'completed', 'default', 'LEGACY', -21.76, -43.35, now(), now(), 'laudos:Teste/legacy.pdf', 'Teste'),
    ('d259fdb1-51db-417d-aec7-912ad358a28d', null, now() - interval '2 days', now() - interval '2 days', 'r1', 'completed', 'default', 'CARLOS-1', -21.3, -42.9, now(), now(), 'laudos:Teste/carlos-1.pdf', 'Cataguases'),
    ('d259fdb1-51db-417d-aec7-912ad358a28d', null, now() - interval '3 days', now() - interval '3 days', 'r2', 'completed', 'default', 'CARLOS-2', -21.4, -42.8, now(), now(), 'laudos:Teste/carlos-2.pdf', 'Cataguases');
`);

try {
  await db.exec(migration);
  await db.exec(reconciliationMigration);
  await db.exec(agentNamesMigration);
  await db.exec(lastAccessMigration);
  const backfill = await db.query(`SELECT id, organization_id FROM public.vistorias WHERE protocolo = 'LEGACY'`);
  assert.equal(backfill.rows[0].organization_id, organizationId);

  await db.query(`
    INSERT INTO public.vistorias("agenteUid", organization_id, "dataVistoria", "criadoEm", "nivelRisco", status, "formularioId", protocolo, latitude, longitude)
    SELECT $1, $2, now() - (n || ' hours')::interval, now() - (n || ' hours')::interval,
      'r' || ((n % 4) + 1), 'completed', 'default', 'T-' || lpad(n::text, 3, '0'),
      CASE WHEN n % 10 = 0 THEN null ELSE -21.76 + n / 10000.0 END,
      CASE WHEN n % 10 = 0 THEN null ELSE -43.35 + n / 10000.0 END
    FROM generate_series(1, 61) n;
  `, [agentId, organizationId]);
  await db.query(`INSERT INTO public.active_sessions(user_id, organization_id, device_name, platform, status, started_at, last_heartbeat_at) VALUES ($1,$2,'Android teste','android','active',now(),now())`, [agentId, organizationId]);
  await db.query(`INSERT INTO public.technical_events(user_id,app_version,platform,category,severity,summary,occurred_at) VALUES ($1,'1.3.18','android','sync','warning','Falha sanitizada',now())`, [agentId]);

  await db.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: ownerId, aal: 'aal2' })]);
  const customerId = `organization:${organizationId}`;
  const summary = await db.query(`SELECT public.get_internal_agent_summary($1,$2) result`, [customerId, agentId]);
  assert.equal(summary.rows[0].result.metrics.inspections, 62);
  assert.equal(summary.rows[0].result.agent.email, 'agente@test.local');

  const first = await db.query(`SELECT public.list_internal_agent_inspections($1,$2,p_page_size => 25) result`, [customerId, agentId]);
  assert.equal(first.rows[0].result.total, 62);
  assert.equal(first.rows[0].result.items.length, 25);
  const cursor = first.rows[0].result.next_cursor;
  const second = await db.query(`SELECT public.list_internal_agent_inspections($1,$2,p_cursor_at => $3,p_cursor_id => $4,p_page_size => 25) result`, [customerId, agentId, cursor.occurred_at, cursor.id]);
  assert.equal(second.rows[0].result.items.length, 25);
  assert.equal(new Set([...first.rows[0].result.items, ...second.rows[0].result.items].map((item) => item.id)).size, 50);

  await db.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: developerId, aal: 'aal2' })]);
  const developerMap = await db.query(`SELECT public.get_internal_agent_map($1,$2) result`, [customerId, agentId]);
  assert.equal(developerMap.rows[0].result.can_view_sensitive, false);
  assert.equal(developerMap.rows[0].result.points.length, 0);
  await assert.rejects(() => db.query(`SELECT public.get_internal_agent_summary($1,$2)`, [customerId, outsiderId]));
  await assert.rejects(() => db.query(`SELECT public.mutate_internal_agent_access($1,$2,'block',null,null,'Motivo de teste',$3)`, [customerId, agentId, crypto.randomUUID()]));

  await db.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: ownerId, aal: 'aal2' })]);
  const ownerMap = await db.query(`SELECT public.get_internal_agent_map($1,$2) result`, [customerId, agentId]);
  assert.ok(ownerMap.rows[0].result.points.length > 0);
  const authorizedDocument = await db.query(`SELECT public.authorize_internal_agent_document($1,$2,$3,'laudo') result`, [customerId, agentId, backfill.rows[0].id]);
  assert.equal(authorizedDocument.rows[0].result.bucket, 'laudos');
  assert.equal(authorizedDocument.rows[0].result.expires_in, 60);
  const mutation = await db.query(`SELECT public.mutate_internal_agent_access($1,$2,'block',null,null,'Bloqueio validado em teste',$3) result`, [customerId, agentId, crypto.randomUUID()]);
  assert.equal(mutation.rows[0].result.ok, true);
  const access = await db.query(`SELECT "isApproved" approved, (SELECT count(*)::integer FROM public.active_sessions WHERE user_id=$1 AND status='active') active_sessions FROM public.users WHERE uid=$1`, [agentId]);
  assert.deepEqual(access.rows[0], { approved: false, active_sessions: 0 });

  const carlosCurrentId = 'adc381cc-bbda-472b-9669-17150102b0a6';
  const carlosLegacyId = 'd259fdb1-51db-417d-aec7-912ad358a28d';
  await db.query(`
    INSERT INTO auth.users(id, last_sign_in_at) VALUES
      ($1, now() - interval '30 days'),
      ($2, now() - interval '1 day')
    ON CONFLICT (id) DO UPDATE SET last_sign_in_at = excluded.last_sign_in_at
  `, [carlosCurrentId, carlosLegacyId]);
  await db.query(`
    INSERT INTO public.active_sessions(user_id, device_name, platform, status, started_at, last_heartbeat_at, ended_at)
    VALUES
      ($1, 'Legado encerrado', 'android', 'replaced', now() - interval '5 days', now() - interval '4 days', now() - interval '4 days'),
      ($1, 'Legado ativo', 'android', 'active', now() - interval '1 day', now(), null)
  `, [carlosLegacyId]);
  const carlosCustomerId = `user:${carlosCurrentId}`;
  const carlosSummary = await db.query(`SELECT public.get_internal_agent_summary($1,$2) result`, [carlosCustomerId, carlosCurrentId]);
  assert.equal(carlosSummary.rows[0].result.metrics.inspections, 2);
  assert.equal(carlosSummary.rows[0].result.agent.linked_legacy_identities, 1);
  const carlosDetail = await db.query(`SELECT public.get_internal_customer_detail($1) result`, [carlosCustomerId]);
  assert.equal(carlosDetail.rows[0].result.inspections.length, 2);
  assert.equal(carlosDetail.rows[0].result.inspections[0].agent_name, 'Carlos Alexandre Rodrigues Faria');
  assert.equal(carlosDetail.rows[0].result.sessions.length, 1);
  assert.equal(carlosDetail.rows[0].result.sessions[0].status, 'replaced');
  assert.ok(carlosDetail.rows[0].result.customer.last_access_at);
  assert.equal(carlosDetail.rows[0].result.users[0].last_login, carlosDetail.rows[0].result.customer.last_access_at);
  const carlosOperations = await db.query(`SELECT public.get_internal_customer_operations($1) result`, [carlosCustomerId]);
  assert.equal(carlosOperations.rows[0].result.map_points.length, 2);

  console.log('Detalhe do agente: escopo, backfill, paginação, mapa sensível e mutações negativas validados.');
} finally {
  await db.close();
}
