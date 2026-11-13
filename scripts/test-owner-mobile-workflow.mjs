import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const owner = '11111111-1111-4111-8111-111111111111';
const agent = '22222222-2222-4222-8222-222222222222';
const suspended = '33333333-3333-4333-8333-333333333333';
const inspection = '44444444-4444-4444-8444-444444444444';
const review = '55555555-5555-4555-8555-555555555555';
await db.exec(`
CREATE ROLE authenticated NOLOGIN; CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.actor',true),'')::uuid $$;
`);
await db.exec(`
CREATE TABLE public.internal_staff(user_id uuid PRIMARY KEY,role text,status text,display_name text);
CREATE FUNCTION private.current_internal_role(p_user_id uuid DEFAULT auth.uid()) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT role FROM public.internal_staff WHERE user_id=p_user_id AND status='active' $$;
CREATE FUNCTION private.has_aal2() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('test.aal',true)='aal2' $$;
CREATE FUNCTION private.is_active_internal_staff() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT private.current_internal_role(auth.uid()) IS NOT NULL $$;
CREATE FUNCTION private.can_manage_own_mobile_field_inspections() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE TABLE public.users(uid uuid,role text,name text,municipio text,"isApproved" boolean,email text,"createdAt" timestamptz,token_limit integer);
CREATE TABLE public.agendamentos(id uuid PRIMARY KEY,titulo text,endereco text,municipio text,data_agendada timestamptz,criado_por_uid uuid,criado_por_nome text,agente_uid uuid,agente_nome text,lat double precision,lng double precision,observacoes text,status text,origem text,criado_em timestamptz,inspection_id uuid);
CREATE TABLE public.vistorias(id uuid PRIMARY KEY,"agenteNome" text,endereco text,"nivelRisco" text,"dataVistoria" timestamptz,"agenteUid" text,organization_id uuid,municipio text,municipio_agente text);
CREATE TABLE public.revisoes_qe(id uuid PRIMARY KEY,vistoria_id uuid,ciclo integer,status text,organization_id uuid,municipio text,criado_em timestamptz,nota integer,checklist jsonb,parecer text,revisor_uid uuid,revisor_nome text,respondida_em timestamptz);
CREATE TABLE public.internal_operations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid,operation_id uuid,action text,request_hash text,status text,result jsonb,completed_at timestamptz,UNIQUE(actor_id,operation_id));
CREATE TABLE public.internal_access_events(actor_id uuid,actor_role text,action text,target_type text,target_id text,result text,reason text,metadata jsonb);
CREATE FUNCTION public.my_organization_ids() RETURNS SETOF uuid LANGUAGE sql AS $$ SELECT NULL::uuid WHERE false $$;
ALTER TABLE public.vistorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revisoes_qe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_legacy_inspection_read ON public.vistorias FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.vistorias TO authenticated;
INSERT INTO auth.users VALUES('${owner}'),('${agent}'),('${suspended}');
INSERT INTO public.internal_staff VALUES('${owner}','owner','active','Dono'),('${suspended}','owner','suspended','Suspenso');
INSERT INTO public.users(uid,role,name,municipio,"isApproved") VALUES('${agent}','agent','Pedro','Outra cidade',true);
INSERT INTO public.vistorias(id,"agenteNome",endereco,"nivelRisco","dataVistoria","agenteUid") VALUES('${inspection}','Pedro','Rua A','r4',now(),NULL);
INSERT INTO public.revisoes_qe(id,vistoria_id,ciclo,status,municipio,criado_em) VALUES('${review}','${inspection}',1,'pendente','Outra cidade',now());
SELECT set_config('test.actor','${owner}',false);
SELECT set_config('test.aal','aal2',false);
`);

if (!process.argv.includes('--baseline')) {
  const migration = await readFile(new URL('../supabase/migrations/20261112011732_owner_mobile_experience_and_quality_access.sql', import.meta.url), 'utf8');
  await db.exec(migration);
}
assert.equal((await db.query('SELECT * FROM public.qe_fila()')).rows.length, 1, 'active internal owner without legacy users row sees global QE');
assert.equal((await db.query(`SELECT public.authorize_inspection_upload('${inspection}') AS allowed`)).rows[0].allowed, true, 'internal owner without legacy profile may upload to existing inspection');
assert.equal((await db.query("SELECT public.authorize_inspection_upload('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') AS allowed")).rows[0].allowed, false, 'unknown inspection cannot accept upload');
assert.equal((await db.query('SELECT * FROM public.list_operational_users()')).rows.length, 1, 'internal owner can read operational directory');
await db.exec(`SELECT public.upsert_operational_appointment('{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","titulo":"Vistoria de retorno","data_agendada":"2026-11-20T12:00:00Z","municipio":"Outra cidade","agente_uid":"${agent}"}')`);
assert.equal((await db.query('SELECT criado_por_nome FROM public.agendamentos')).rows[0].criado_por_nome, 'Dono');
await db.exec("SELECT public.transition_operational_appointment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','concluido')");
assert.equal((await db.query('SELECT status FROM public.agendamentos')).rows[0].status, 'concluido');
assert.equal((await db.query('SELECT public.get_owner_mobile_experience() AS mode')).rows[0].mode, null);
await db.exec("SELECT public.set_owner_mobile_experience('operate')");
assert.equal((await db.query('SELECT public.get_owner_mobile_experience() AS mode')).rows[0].mode, 'operate');
await assert.rejects(db.exec("SELECT public.set_owner_mobile_experience('admin')"), /invalid_owner_mode/);
await db.exec(`UPDATE public.users SET role='supervisor',municipio=NULL WHERE uid='${agent}'; SELECT set_config('test.actor','${agent}',false);`);
await assert.rejects(db.exec(`SELECT public.qe_revisar('${review}',8,'[]','Tentativa fora do escopo',true)`), /forbidden/, 'NULL municipality must not authorize a supervisor for an unrelated review');
await db.exec(`UPDATE public.users SET role='agent',municipio='Outra cidade' WHERE uid='${agent}'; SELECT set_config('test.actor','${owner}',false);`);
await db.exec(`SELECT public.qe_revisar('${review}',8,'[]','Conferido',true)`);
assert.equal((await db.query(`SELECT status,revisor_nome FROM public.revisoes_qe WHERE id='${review}'`)).rows[0].status, 'aprovada');
await assert.rejects(db.exec(`SELECT public.qe_revisar('${review}',8,'[]','Conferido',true)`), /review_already_closed/);

const operation = '66666666-6666-4666-8666-666666666666';
await db.exec(`SELECT public.set_owner_inspection_archived('${inspection}',true,'Registro duplicado','${operation}')`);
assert.equal((await db.query(`SELECT public.authorize_inspection_upload('${inspection}') AS allowed`)).rows[0].allowed, false, 'archived inspection cannot accept late uploads');
await assert.rejects(db.exec(`UPDATE public.vistorias SET endereco='owner stale update' WHERE id='${inspection}'`), /inspection_archived_read_only/);
await db.exec(`SELECT public.set_owner_inspection_archived('${inspection}',true,'Registro duplicado','${operation}')`);
assert.equal((await db.query('SELECT count(*)::int AS count FROM public.internal_access_events')).rows[0].count, 1, 'retry must not duplicate archive audit');
await db.exec(`SELECT set_config('test.actor','${agent}',false)`);
await db.exec('SET ROLE authenticated');
assert.equal((await db.query('SELECT id FROM public.vistorias')).rows.length, 0, 'restrictive archive policy wins over permissive legacy read');
await assert.rejects(db.exec('SELECT * FROM public.owner_mobile_experiences'), /permission denied/);
await db.exec('RESET ROLE');
await assert.rejects(db.exec(`UPDATE public.vistorias SET endereco='stale offline update' WHERE id='${inspection}'`), /inspection_archived_read_only/);
await assert.rejects(db.exec(`UPDATE public.vistorias SET owner_archived_at=NULL WHERE id='${inspection}'`), /inspection_archived_read_only/);
await db.exec(`SELECT set_config('test.actor','${owner}',false)`);
await assert.rejects(db.exec(`SELECT public.set_owner_inspection_archived('${inspection}',false,'Registro duplicado','${operation}')`), /operation_id_conflict/);
await db.exec(`SELECT public.set_owner_inspection_archived('${inspection}',false,'Restaurar registro','77777777-7777-4777-8777-777777777777')`);
assert.equal((await db.query(`SELECT owner_archived_at FROM public.vistorias WHERE id='${inspection}'`)).rows[0].owner_archived_at, null);

for (const actor of [agent, suspended, '']) {
  await db.exec(`SELECT set_config('test.actor','${actor}',false)`);
  await assert.rejects(db.exec('SELECT public.get_owner_mobile_experience()'), /owner_required/);
  await assert.rejects(db.exec("SELECT public.set_owner_mobile_experience('operate')"), /owner_required/);
  await assert.rejects(db.exec('SELECT * FROM public.qe_fila()'), /forbidden/);
  await assert.rejects(db.exec('SELECT * FROM public.list_operational_users()'), /forbidden|authentication_required/);
  await assert.rejects(db.exec(`SELECT public.set_owner_inspection_archived('${inspection}',true,'Registro duplicado','88888888-8888-4888-8888-888888888888')`), /owner_required/);
}
await db.exec(`SELECT set_config('test.actor','${owner}',false); SELECT set_config('test.aal','aal1',false);`);
await assert.rejects(db.exec(`SELECT public.set_owner_inspection_archived('${inspection}',true,'Registro duplicado','99999999-9999-4999-8999-999999999999')`), /aal2_required/);
console.log('Owner mobile SQL: active owner, first-use preference, global QE, rejected spoof/suspended/anonymous, archive/restore idempotency and AAL2 passed.');
await db.close();
