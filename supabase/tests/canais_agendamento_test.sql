BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(11);

-- Agendamento de comunicados.
SELECT extensions.ok(
  position('agendado' in (SELECT pg_get_constraintdef(oid) FROM pg_constraint
   WHERE conrelid = 'public.comunicados'::regclass AND conname = 'comunicados_status_valid')) > 0,
  'comunicados status constraint accepts agendado'
);
SELECT extensions.ok(
  (SELECT attname FROM pg_attribute
   WHERE attrelid = 'public.comunicados'::regclass AND attname = 'publicar_em') = 'publicar_em',
  'comunicados has publicar_em column'
);

-- Envios assistidos: tabela fail-closed com RLS.
SELECT extensions.ok(to_regclass('public.canal_envios') IS NOT NULL, 'canal_envios table exists');
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.canal_envios'::regclass),
  'canal_envios has row level security'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'public.canal_envios', 'SELECT'),
  'authenticated cannot read canal_envios directly (RPC only)'
);

-- RPCs novas existem com privilégio correto.
SELECT extensions.ok(to_regprocedure('public.portal_list_canais_externos()') IS NOT NULL, 'list canais RPC exists');
SELECT extensions.ok(to_regprocedure('public.portal_upsert_canal_externo(jsonb)') IS NOT NULL, 'upsert canal RPC exists');
SELECT extensions.ok(to_regprocedure('public.portal_set_canal_ativo(uuid, boolean)') IS NOT NULL, 'set canal ativo RPC exists');
SELECT extensions.ok(to_regprocedure('public.portal_delete_canal_externo(uuid)') IS NOT NULL, 'delete canal RPC exists');
SELECT extensions.ok(to_regprocedure('public.portal_registrar_envio_canal(uuid, uuid)') IS NOT NULL, 'registrar envio RPC exists');

-- Agendamento usa assinatura nova de set status (com publicar_em).
SELECT extensions.ok(
  to_regprocedure('public.portal_set_comunicado_status(uuid, text, timestamptz)') IS NOT NULL
  AND to_regprocedure('public.portal_set_comunicado_status(uuid, text)') IS NULL,
  'set status RPC uses scheduling signature'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.portal_registrar_envio_canal(uuid, uuid)', 'EXECUTE'),
  'anon cannot register canal envio'
);

SELECT * FROM extensions.finish();
ROLLBACK;
