BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(18);

-- Tabelas do modelo de comunicados municipais.
SELECT extensions.ok(to_regclass('public.bairros') IS NOT NULL, 'bairros table exists');
SELECT extensions.ok(to_regclass('public.comunicados') IS NOT NULL, 'comunicados table exists');
SELECT extensions.ok(to_regclass('public.comunicado_destinos') IS NOT NULL, 'comunicado_destinos table exists');
SELECT extensions.ok(to_regclass('public.comunicado_leituras') IS NOT NULL, 'comunicado_leituras table exists');
SELECT extensions.ok(to_regclass('public.canais_externos') IS NOT NULL, 'canais_externos table exists');

-- RLS habilitada em todas as tabelas expostas.
SELECT extensions.ok(
  (SELECT bool_and(relrowsecurity) FROM pg_class
   WHERE oid IN ('public.bairros'::regclass, 'public.comunicados'::regclass,
                 'public.comunicado_destinos'::regclass, 'public.comunicado_leituras'::regclass,
                 'public.canais_externos'::regclass)),
  'row level security is enabled on every comunicados table'
);

-- Fail-closed: cliente autenticado não acessa as tabelas diretamente.
SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'public.comunicados', 'SELECT'),
  'authenticated cannot read comunicados directly (RPC only)'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.comunicados', 'SELECT'),
  'anon cannot read comunicados directly'
);

-- Policies SELECT de defesa em profundidade existem e são municipais.
SELECT extensions.ok(
  (SELECT count(*) FROM pg_policies
   WHERE tablename = 'comunicados' AND cmd = 'SELECT' AND roles = '{authenticated}') = 1,
  'comunicados has exactly one SELECT policy for authenticated'
);
SELECT extensions.ok(
  position('current_organization_id' in (SELECT qual FROM pg_policies
   WHERE tablename = 'comunicados' AND cmd = 'SELECT')) > 0,
  'comunicados SELECT policy scopes by organization'
);

-- RPCs existem e têm privilégio correto.
SELECT extensions.ok(to_regprocedure('public.portal_list_comunicados()') IS NOT NULL, 'list comunicados RPC exists');
SELECT extensions.ok(to_regprocedure('public.portal_upsert_comunicado(jsonb)') IS NOT NULL, 'upsert comunicado RPC exists');
SELECT extensions.ok(to_regprocedure('public.portal_set_comunicado_status(uuid, text)') IS NOT NULL, 'set status RPC exists');
SELECT extensions.ok(to_regprocedure('public.portal_delete_comunicado(uuid)') IS NOT NULL, 'delete comunicado RPC exists');
SELECT extensions.ok(to_regprocedure('public.portal_register_comunicado_leitura(uuid)') IS NOT NULL, 'register leitura RPC exists');
SELECT extensions.ok(to_regprocedure('public.portal_upsert_bairro(text, uuid)') IS NOT NULL, 'upsert bairro RPC exists');
SELECT extensions.ok(to_regprocedure('public.portal_delete_bairro(uuid)') IS NOT NULL, 'delete bairro RPC exists');

SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.portal_upsert_comunicado(jsonb)', 'EXECUTE'),
  'anon cannot execute upsert comunicado'
);
SELECT extensions.ok(
  has_function_privilege('authenticated', 'public.portal_upsert_comunicado(jsonb)', 'EXECUTE'),
  'authenticated may execute upsert comunicado (role enforced inside)'
);

-- Permissões do portal incluem communication.* na cópia vigente do contexto.
SELECT extensions.ok(
  position('communication.read' in pg_get_functiondef('public.get_portal_access_context()'::regprocedure)) > 0,
  'portal access context grants communication.read'
);
SELECT extensions.ok(
  position('communication.write' in pg_get_functiondef('public.get_portal_access_context()'::regprocedure)) > 0,
  'portal access context grants communication.write'
);

SELECT * FROM extensions.finish();
ROLLBACK;
