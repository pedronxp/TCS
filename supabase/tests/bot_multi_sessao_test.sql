BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(9);

-- Sessões de bot por organização.
SELECT extensions.ok(to_regclass('public.bot_sessoes') IS NOT NULL, 'bot_sessoes table exists');
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.bot_sessoes'::regclass),
  'bot_sessoes has row level security'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'public.bot_sessoes', 'SELECT'),
  'authenticated cannot read bot_sessoes directly (RPC only)'
);
SELECT extensions.ok(
  (SELECT attname FROM pg_attribute
   WHERE attrelid = 'public.canal_envios'::regclass AND attname = 'sessao_id') = 'sessao_id',
  'canal_envios registers which session sent'
);
SELECT extensions.ok(
  (SELECT count(*) FROM information_schema.table_constraints tc
   JOIN information_schema.key_column_usage k ON k.constraint_name = tc.constraint_name
   WHERE tc.table_name = 'bot_chats' AND tc.constraint_type = 'PRIMARY KEY') = 2,
  'bot_chats is scoped per session (composite PK)'
);

-- RPCs multi-sessão.
SELECT extensions.ok(to_regprocedure('public.portal_criar_sessao_bot()') IS NOT NULL, 'criar sessao RPC exists');
SELECT extensions.ok(to_regprocedure('public.portal_listar_sessoes_bot()') IS NOT NULL, 'listar sessoes RPC exists');
SELECT extensions.ok(to_regprocedure('public.portal_definir_status_sessao_bot(uuid, text)') IS NOT NULL, 'definir status sessao RPC exists');

SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.portal_criar_sessao_bot()', 'EXECUTE'),
  'anon cannot create bot session'
);

SELECT * FROM extensions.finish();
ROLLBACK;
