BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(10);

-- Fila de disparo do bot.
SELECT extensions.ok(
  position('pendente' in (SELECT pg_get_constraintdef(oid) FROM pg_constraint
   WHERE conrelid = 'public.canal_envios'::regclass AND conname = 'canal_envios_status_valid')) > 0,
  'canal_envios status constraint accepts pendente'
);
SELECT extensions.ok(
  (SELECT attname FROM pg_attribute
   WHERE attrelid = 'public.canais_externos'::regclass AND attname = 'chat_id') = 'chat_id',
  'canais_externos has chat_id column'
);
SELECT extensions.ok(to_regclass('public.bot_chats') IS NOT NULL, 'bot_chats table exists');
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.bot_chats'::regclass),
  'bot_chats has row level security'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'public.bot_chats', 'SELECT'),
  'authenticated cannot read bot_chats directly (RPC only)'
);

-- RPCs do bot existem com privilégio correto.
SELECT extensions.ok(to_regprocedure('public.portal_disparar_envio_bot(uuid, uuid)') IS NOT NULL, 'disparar envio bot RPC exists');
SELECT extensions.ok(to_regprocedure('public.portal_list_bot_chats()') IS NOT NULL, 'list bot chats RPC exists');
SELECT extensions.ok(to_regprocedure('public.portal_vincular_canal_chat(uuid, text)') IS NOT NULL, 'vincular canal chat RPC exists');

SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.portal_disparar_envio_bot(uuid, uuid)', 'EXECUTE'),
  'anon cannot queue bot dispatch'
);
SELECT extensions.ok(
  has_function_privilege('authenticated', 'public.portal_disparar_envio_bot(uuid, uuid)', 'EXECUTE'),
  'authenticated may queue bot dispatch (role enforced inside)'
);

SELECT extensions.ok(
  position('chat_id' in pg_get_functiondef('public.portal_list_canais_externos()'::regprocedure)) > 0,
  'canais contract exposes chat_id'
);

SELECT * FROM extensions.finish();
ROLLBACK;
