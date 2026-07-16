BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(22);
CREATE TEMP TABLE tap_output(line text);
GRANT SELECT, INSERT ON tap_output TO authenticated;

INSERT INTO auth.users(id, email, raw_user_meta_data)
VALUES
  ('11000000-0000-4000-8000-000000000001', 'owner-console@example.test', '{}'::jsonb),
  ('11000000-0000-4000-8000-000000000002', 'developer-console@example.test', '{}'::jsonb),
  ('11000000-0000-4000-8000-000000000003', 'municipal-console@example.test', '{}'::jsonb),
  ('11000000-0000-4000-8000-000000000004', 'inactive-console@example.test', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.internal_staff(user_id, role, status, display_name)
VALUES
  ('11000000-0000-4000-8000-000000000001', 'owner', 'active', 'Owner Teste'),
  ('11000000-0000-4000-8000-000000000002', 'developer', 'active', 'Developer Teste'),
  ('11000000-0000-4000-8000-000000000004', 'developer', 'suspended', 'Inactive Teste')
ON CONFLICT (user_id) DO UPDATE SET role=EXCLUDED.role,status=EXCLUDED.status;

INSERT INTO public.organizations(id, slug, display_name, municipality_name, status)
VALUES ('21000000-0000-4000-8000-000000000001', 'console-org-test', 'Console Org Teste', 'Teste', 'pilot')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.organization_members(organization_id,user_id,role,status,joined_at)
VALUES ('21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000003','agent','active',now())
ON CONFLICT (organization_id,user_id) DO UPDATE SET status='active';

CREATE TEMP TABLE direct_checks(name text PRIMARY KEY, passed boolean NOT NULL);
GRANT SELECT, INSERT ON direct_checks TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}', true);
INSERT INTO tap_output SELECT extensions.is(public.get_internal_staff_profile(), NULL::jsonb, 'municipal user has no internal profile');
DO $$ BEGIN
  PERFORM public.get_internal_dashboard();
  INSERT INTO direct_checks VALUES('municipal_dashboard',false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO direct_checks VALUES('municipal_dashboard',true); END $$;
INSERT INTO tap_output SELECT extensions.ok((SELECT passed FROM direct_checks WHERE name='municipal_dashboard'), 'municipal user cannot call internal dashboard directly');

RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}', true);
INSERT INTO tap_output SELECT extensions.is(public.get_internal_staff_profile(), NULL::jsonb, 'suspended staff has no internal profile');
DO $$ BEGIN
  PERFORM public.list_internal_customers(NULL,NULL,10,0);
  INSERT INTO direct_checks VALUES('inactive_customers',false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO direct_checks VALUES('inactive_customers',true); END $$;
INSERT INTO tap_output SELECT extensions.ok((SELECT passed FROM direct_checks WHERE name='inactive_customers'), 'suspended staff cannot list customers directly');

RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);
INSERT INTO tap_output SELECT extensions.ok(private.has_internal_permission('technical.write'), 'developer has technical write permission');
INSERT INTO tap_output SELECT extensions.ok(NOT private.has_internal_permission('commercial.write'), 'developer has no commercial write permission');
DO $$ DECLARE plan_id uuid; BEGIN
  SELECT id INTO plan_id FROM public.plans WHERE code='individual_basic';
  PERFORM public.mutate_internal_plan(plan_id,'{"name":"Individual Básico","status":"draft"}'::jsonb,
    '{"currency":"BRL","trial_days":0,"grace_days":0,"overage_policy":"block","support_tier":"standard","monthly_price_cents":0,"annual_price_cents":0}'::jsonb,
    '{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'Tentativa sem permissão','31000000-0000-4000-8000-000000000001');
  INSERT INTO direct_checks VALUES('developer_plan',false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO direct_checks VALUES('developer_plan',true); END $$;
INSERT INTO tap_output SELECT extensions.ok((SELECT passed FROM direct_checks WHERE name='developer_plan'), 'developer cannot mutate plans directly');

RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
INSERT INTO tap_output SELECT extensions.ok(private.has_internal_permission('commercial.write'), 'owner has commercial write permission');
DO $$ DECLARE plan_id uuid; BEGIN
  SELECT id INTO plan_id FROM public.plans WHERE code='individual_basic';
  PERFORM public.mutate_internal_plan(plan_id,'{"name":"Individual Básico","status":"draft"}'::jsonb,
    '{"currency":"BRL","trial_days":0,"grace_days":0,"overage_policy":"block","support_tier":"standard","monthly_price_cents":0,"annual_price_cents":0}'::jsonb,
    '{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'Teste sem autenticação forte','31000000-0000-4000-8000-000000000002');
  INSERT INTO direct_checks VALUES('owner_aal1',false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO direct_checks VALUES('owner_aal1',true); END $$;
INSERT INTO tap_output SELECT extensions.ok((SELECT passed FROM direct_checks WHERE name='owner_aal1'), 'owner needs AAL2 for plan mutation');

RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
CREATE TEMP TABLE mutation_result AS
SELECT public.mutate_internal_plan(
  (SELECT id FROM public.plans WHERE code='individual_basic'),
  '{"name":"Individual Básico","description":"Teste transacional","status":"draft"}'::jsonb,
  '{"currency":"BRL","trial_days":0,"grace_days":0,"overage_policy":"block","support_tier":"standard","monthly_price_cents":0,"annual_price_cents":0}'::jsonb,
  '{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'Validação transacional owner','31000000-0000-4000-8000-000000000003'
) payload;
INSERT INTO tap_output SELECT extensions.ok((SELECT (payload->>'ok')::boolean FROM mutation_result), 'owner AAL2 mutates a commercial plan');
INSERT INTO tap_output SELECT extensions.is(
  (SELECT public.mutate_internal_plan((SELECT id FROM public.plans WHERE code='individual_basic'),
    '{"name":"Individual Básico","description":"Teste transacional","status":"draft"}'::jsonb,
    '{"currency":"BRL","trial_days":0,"grace_days":0,"overage_policy":"block","support_tier":"standard","monthly_price_cents":0,"annual_price_cents":0}'::jsonb,
    '{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'Validação transacional owner','31000000-0000-4000-8000-000000000003')),
  (SELECT payload FROM mutation_result), 'repeated operation id returns the same result'
);
RESET ROLE;
INSERT INTO tap_output SELECT extensions.is((SELECT count(*) FROM public.internal_operations WHERE operation_id='31000000-0000-4000-8000-000000000003'),1::bigint,'idempotent mutation persists one operation');
INSERT INTO tap_output SELECT extensions.is(private.sanitize_internal_metadata('{"token":"x","email":"x","operation":"sync"}'::jsonb),'{"operation":"sync"}'::jsonb,'metadata sanitizer removes secrets and personal fields');

INSERT INTO public.active_sessions(id,auth_session_id,user_id,organization_id,device_id,platform,status)
VALUES('41000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000003','21000000-0000-4000-8000-000000000001','flow-device','android','active');
INSERT INTO public.support_tickets(id,user_id,organization_id,requester_id,category,subject,description,priority,status)
VALUES('41000000-0000-4000-8000-000000000003',NULL,'21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000003','technical','Flow ticket','Transação de teste','normal','open');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
INSERT INTO tap_output SELECT extensions.ok((public.mutate_internal_organization('21000000-0000-4000-8000-000000000001','update','{"display_name":"Console Org Validada"}'::jsonb,'Validação do fluxo cliente','41000000-0000-4000-8000-000000000004')->>'ok')::boolean,'owner updates customer flow');
INSERT INTO tap_output SELECT extensions.ok((public.mutate_internal_subscription('organization:21000000-0000-4000-8000-000000000001','','create',jsonb_build_object('plan_id',(SELECT id FROM public.plans WHERE code='municipal_basic'),'status','trial','overrides','{}'::jsonb),'Validação do fluxo assinatura','41000000-0000-4000-8000-000000000005')->>'ok')::boolean,'owner creates subscription flow');
INSERT INTO tap_output SELECT extensions.ok(public.end_active_session('41000000-0000-4000-8000-000000000001','Encerramento remoto validado'),'owner terminates a customer session flow');
INSERT INTO tap_output SELECT extensions.ok((public.mutate_internal_support_ticket('41000000-0000-4000-8000-000000000003','priority','critical','','41000000-0000-4000-8000-000000000006')->>'ok')::boolean,'owner updates support flow');

RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);
INSERT INTO tap_output SELECT extensions.is((public.request_internal_build('41000000-0000-4000-8000-000000000007','eas','preview','1.3.17','preview','Fluxo de teste','Validação do fluxo build')->>'status'),'approved','developer requests approved preview build flow');
INSERT INTO tap_output SELECT extensions.ok((public.mutate_internal_form('','create','{"title":"Formulário de fluxo","questions":[],"phases":[],"classification":{},"calculation_type":"soma_total"}'::jsonb,'Validação do fluxo formulário','41000000-0000-4000-8000-000000000008')->>'ok')::boolean,'developer creates form draft flow');

RESET ROLE; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
SELECT public.ingest_client_technical_event('31000000-0000-4000-8000-000000000004','1.3.16','android','sync','error','test-correlation','Falha de sincronização','{"operation":"inspection_sync","token":"hidden"}'::jsonb);
RESET ROLE;
INSERT INTO tap_output SELECT extensions.is((SELECT organization_id FROM public.technical_events WHERE event_key='31000000-0000-4000-8000-000000000004'),'21000000-0000-4000-8000-000000000001'::uuid,'client telemetry derives organization server-side');
INSERT INTO tap_output SELECT extensions.is((SELECT metadata FROM public.technical_events WHERE event_key='31000000-0000-4000-8000-000000000004'),'{"operation":"inspection_sync"}'::jsonb,'client telemetry metadata is sanitized server-side');

RESET ROLE;
INSERT INTO tap_output SELECT extensions.ok(NOT has_function_privilege('anon','public.ingest_client_technical_event(uuid,text,text,text,text,text,text,jsonb)','EXECUTE'),'anonymous role cannot ingest client telemetry');

INSERT INTO tap_output SELECT * FROM extensions.finish();
SELECT jsonb_agg(line) AS tap_results FROM tap_output;
ROLLBACK;
