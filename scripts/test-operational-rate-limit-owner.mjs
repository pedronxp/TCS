import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const owner = '11111111-1111-4111-8111-111111111111';
const outsider = '22222222-2222-4222-8222-222222222222';
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth; CREATE SCHEMA private;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT current_setting('test.actor')::uuid $$;
    CREATE FUNCTION private.current_internal_role(uuid) RETURNS text LANGUAGE sql AS $$ SELECT CASE WHEN $1 = '${owner}' THEN 'owner' END $$;
    CREATE TABLE public.users(uid uuid, "isApproved" boolean);
    CREATE TABLE public.rate_limits(uid uuid, action text, window_start timestamptz, count integer, UNIQUE(uid,action,window_start));
  `);
  const filename = process.argv.includes('--baseline')
    ? '20260813230000_backend_authoritative_rate_limit_p1.sql'
    : '20261112131720_operational_rate_limit_active_owner.sql';
  const migration = await readFile(new URL(`../supabase/migrations/${filename}`, import.meta.url), 'utf8');
  await db.exec(migration.split('-- Retire a API legada')[0]);
  await db.query("select set_config('test.actor',$1,false)", [owner]);
  for (let attempt = 1; attempt <= 11; attempt++) {
    const { rows } = await db.query("select public.enforce_my_operational_rate_limit('gerar_pdf') as allowed");
    assert.equal(rows[0].allowed, attempt <= 10);
  }
  await db.query("select set_config('test.actor',$1,false)", [outsider]);
  await assert.rejects(db.query("select public.enforce_my_operational_rate_limit('gerar_pdf')"), /forbidden/);
  console.log('Owner sem cadastro legado usa o limite de PDF; conta sem autorização é recusada.');
} finally {
  await db.close();
}
