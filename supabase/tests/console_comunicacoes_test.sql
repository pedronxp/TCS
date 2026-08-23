BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(8);

-- Permissão interna nova concedida a owner e developer.
SELECT extensions.ok(
  position('communication.manage' in pg_get_functiondef('private.internal_permissions(text)'::regprocedure)) > 0,
  'internal permissions include communication.manage'
);
SELECT extensions.ok(
  position('communication.manage' in pg_get_functiondef('private.is_valid_internal_permission(text)'::regprocedure)) > 0,
  'communication.manage is a valid internal permission'
);

-- RPCs do console existem com privilégio correto.
SELECT extensions.ok(to_regprocedure('public.internal_list_orgs_comunicados()') IS NOT NULL, 'list orgs console RPC exists');
SELECT extensions.ok(to_regprocedure('public.internal_comunicados_org(uuid)') IS NOT NULL, 'org detail console RPC exists');
SELECT extensions.ok(to_regprocedure('public.internal_criar_sessao_bot(uuid)') IS NOT NULL, 'criar sessao console RPC exists');
SELECT extensions.ok(to_regprocedure('public.internal_definir_status_sessao_bot(uuid, text)') IS NOT NULL, 'status sessao console RPC exists');
SELECT extensions.ok(to_regprocedure('public.internal_disparar_envio_bot(uuid, uuid)') IS NOT NULL, 'disparar console RPC exists');

SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.internal_criar_sessao_bot(uuid)', 'EXECUTE'),
  'anon cannot create bot session from console'
);

SELECT * FROM extensions.finish();
ROLLBACK;
