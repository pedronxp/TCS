import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migrationUrl = new URL(
  '../supabase/migrations/20260811120000_official_protocol_allocation.sql',
  import.meta.url,
);

const migration = await readFile(migrationUrl, 'utf8');
const db = new PGlite();

const userA1 = '10000000-0000-4000-8000-000000000001';
const userA2 = '10000000-0000-4000-8000-000000000002';
const userB = '10000000-0000-4000-8000-000000000003';
const organizationA = '20000000-0000-4000-8000-000000000001';
const organizationB = '20000000-0000-4000-8000-000000000002';

async function authenticate(userId) {
  await db.query(
    "SELECT set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ sub: userId, role: 'authenticated' })],
  );
}

async function allocate(id, municipality = 'Cataguases') {
  const result = await db.query(
    `SELECT public.sync_finalized_inspection(
      jsonb_build_object(
        'id', $1::uuid,
        'agenteUid', auth.uid(),
        'municipio', $2::text,
        'status', 'concluida',
        'dataVistoria', '2026-08-11T12:00:00.000Z'
      )
    ) AS payload`,
    [id, municipality],
  );
  return result.rows[0].payload;
}

try {
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth;
    CREATE SCHEMA private;

    CREATE TABLE auth.users (
      id uuid PRIMARY KEY,
      email text
    );

    CREATE FUNCTION auth.uid()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$
      SELECT (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
    $$;

    GRANT USAGE ON SCHEMA auth, private TO authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

    CREATE TABLE public.organizations (
      id uuid PRIMARY KEY,
      slug text NOT NULL UNIQUE,
      display_name text NOT NULL,
      municipality_name text
    );

    CREATE TABLE public.organization_members (
      organization_id uuid NOT NULL REFERENCES public.organizations(id),
      user_id uuid NOT NULL REFERENCES auth.users(id),
      role text NOT NULL,
      status text NOT NULL,
      PRIMARY KEY (organization_id, user_id)
    );

    CREATE FUNCTION private.current_organization_id(p_user_id uuid DEFAULT auth.uid())
    RETURNS uuid
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = p_user_id AND status = 'active'
      LIMIT 1;
    $$;

    CREATE TABLE public.vistorias (
      id uuid PRIMARY KEY,
      "agenteUid" uuid REFERENCES auth.users(id),
      "agenteNome" text,
      municipio text,
      "enderecoRua" text,
      "enderecoNumero" text,
      "enderecoBairro" text,
      "enderecoCep" text,
      "responsavelNome" text,
      latitude double precision,
      longitude double precision,
      "dataVistoria" timestamptz,
      "formularioId" text,
      "formularioVersao" integer,
      "respostasJson" text,
      "calculoRisco" jsonb,
      "nivelRisco" text,
      "pontuacaoTotal" numeric,
      "fotoUrl" text,
      "fotosUrls" jsonb,
      laudo_url text,
      laudo_gerado_em timestamptz,
      endereco text,
      status text,
      protocolo text,
      organization_id uuid REFERENCES public.organizations(id)
    );

    INSERT INTO auth.users(id, email) VALUES
      ('${userA1}', 'member-a1@example.test'),
      ('${userA2}', 'member-a2@example.test'),
      ('${userB}', 'member-b@example.test');

    INSERT INTO public.organizations(id, slug, display_name, municipality_name) VALUES
      ('${organizationA}', 'prefeitura-cataguases', 'Prefeitura de Cataguases', 'Cataguases'),
      ('${organizationB}', 'individual-cataguases', 'Profissional de Cataguases', 'Cataguases');

    INSERT INTO public.organization_members(organization_id, user_id, role, status) VALUES
      ('${organizationA}', '${userA1}', 'coordinator', 'active'),
      ('${organizationA}', '${userA2}', 'agent', 'active'),
      ('${organizationB}', '${userB}', 'owner', 'active');
  `);

  await db.exec(migration);

  await db.exec('SET ROLE authenticated');
  await authenticate(userA1);

  await assert.rejects(
    db.query(
      `SELECT public.sync_finalized_inspection(
        jsonb_build_object(
          'id', '30000000-0000-4000-8000-000000000001'::uuid,
          'agenteUid', auth.uid(),
          'municipio', 'Cataguases',
          'status', 'concluida',
          'protocolo', 'CLIENTE-ESCOLHEU-0001'
        )
      )`,
    ),
    /protocol_client_value_forbidden/,
    'the client cannot choose an official protocol',
  );

  await db.exec('RESET ROLE');
  await db.exec(`
    UPDATE public.protocol_series SET active = false WHERE organization_id = '${organizationA}';
    UPDATE public.protocol_series SET active = false WHERE organization_id = '${organizationB}';
    INSERT INTO public.protocol_series(organization_id, code, active) VALUES
      ('${organizationA}', 'PREF-CAT', true),
      ('${organizationB}', 'IND-CAT', true);
  `);

  await db.exec('SET ROLE authenticated');
  await authenticate(userA1);
  const firstA = await allocate('30000000-0000-4000-8000-000000000010');
  assert.equal(firstA.protocol, 'TCS-PREF-CAT-2026-000001');
  assert.equal(firstA.organization_id, organizationA);

  await authenticate(userA2);
  const secondA = await allocate('30000000-0000-4000-8000-000000000011');
  assert.equal(secondA.protocol, 'TCS-PREF-CAT-2026-000002');

  await authenticate(userA1);
  const concurrentA = await Promise.all([
    allocate('30000000-0000-4000-8000-000000000014'),
    allocate('30000000-0000-4000-8000-000000000015'),
  ]);
  assert.deepEqual(
    new Set(concurrentA.map(result => result.protocol)),
    new Set(['TCS-PREF-CAT-2026-000003', 'TCS-PREF-CAT-2026-000004']),
    'concurrent finalizations in one organization receive distinct adjacent sequence values',
  );

  await authenticate(userB);
  const firstB = await allocate('30000000-0000-4000-8000-000000000012');
  assert.equal(firstB.protocol, 'TCS-IND-CAT-2026-000001');
  assert.equal(firstB.organization_id, organizationB);

  const repeatedB = await allocate('30000000-0000-4000-8000-000000000012');
  assert.equal(repeatedB.protocol, firstB.protocol, 'retry is idempotent for an inspection id');

  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('app.official_protocol_allocation', 'on', false)");
  await db.exec(`
    INSERT INTO public.vistorias(id, "agenteUid", municipio, status, protocolo, organization_id)
    VALUES (
      '30000000-0000-4000-8000-000000000020',
      '${userA1}',
      'Cataguases',
      'concluida',
      'LEGACY-CAT-2024-00042',
      '${organizationA}'
    );
  `);
  await db.query("SELECT set_config('app.official_protocol_allocation', 'off', false)");

  await db.exec('SET ROLE authenticated');
  await authenticate(userA1);
  const legacy = await allocate('30000000-0000-4000-8000-000000000020');
  assert.equal(legacy.protocol, 'LEGACY-CAT-2024-00042', 'historical protocol remains immutable');

  await db.exec('RESET ROLE');
  await db.query(
    'DELETE FROM public.vistorias WHERE id = $1::uuid',
    ['30000000-0000-4000-8000-000000000011'],
  );
  await db.exec('SET ROLE authenticated');
  await authenticate(userA1);
  const afterDeletion = await allocate('30000000-0000-4000-8000-000000000013');
  assert.equal(afterDeletion.protocol, 'TCS-PREF-CAT-2026-000005', 'voided/deleted numbers are never reused');

  await db.exec('RESET ROLE');
  const allocationAudit = await db.query(`
    SELECT count(*)::integer AS total
    FROM public.protocol_allocation_events
    WHERE organization_id = '${organizationA}'::uuid
  `);
  assert.equal(allocationAudit.rows[0].total, 5, 'every new official number is audited once');

  console.log('Official protocol allocation: server-only, idempotent, organization-scoped, immutable and non-reusable.');
} finally {
  await db.close();
}
