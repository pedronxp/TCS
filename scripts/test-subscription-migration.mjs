import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migrationUrl = new URL(
  '../supabase/migrations/20260716141609_subscription_platform.sql',
  import.meta.url,
);
const validationFixUrl = new URL(
  '../supabase/migrations/20260716142121_fix_subscription_platform_remote_validation.sql',
  import.meta.url,
);
const commercialDefaultsUrl = new URL(
  '../supabase/migrations/20260716154744_approve_commercial_plan_defaults.sql',
  import.meta.url,
);

const migration = (await readFile(migrationUrl, 'utf8')).replace(
  'CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;',
  '-- pgcrypto is represented by deterministic test doubles in this ephemeral database.',
);
const validationFix = await readFile(validationFixUrl, 'utf8');
const commercialDefaults = await readFile(commercialDefaultsUrl, 'utf8');

const db = new PGlite();

await db.exec(`
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE SCHEMA auth;
  CREATE SCHEMA storage;
  CREATE SCHEMA extensions;

  CREATE TABLE auth.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
  );

  CREATE FUNCTION auth.uid()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  AS $$
    SELECT (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
  $$;

  CREATE FUNCTION auth.jwt()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  AS $$
    SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  $$;

  CREATE FUNCTION extensions.digest(value text, algorithm text)
  RETURNS bytea
  LANGUAGE sql
  IMMUTABLE
  AS $$ SELECT decode(md5(value || ':' || algorithm), 'hex'); $$;

  CREATE FUNCTION extensions.gen_random_bytes(byte_count integer)
  RETURNS bytea
  LANGUAGE sql
  VOLATILE
  AS $$ SELECT decode(repeat('ab', byte_count), 'hex'); $$;

  CREATE TABLE public.users (
    uid uuid PRIMARY KEY REFERENCES auth.users(id),
    name text,
    username text,
    email text,
    phone text,
    role text,
    municipio text,
    "isApproved" boolean NOT NULL DEFAULT false,
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    "nameChanged" boolean NOT NULL DEFAULT false
  );

  CREATE TABLE public.vistorias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "agenteUid" uuid REFERENCES public.users(uid),
    municipio text
  );

  CREATE TABLE public.agendamentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    municipio text NOT NULL,
    criado_por_uid uuid REFERENCES public.users(uid),
    agente_uid uuid REFERENCES public.users(uid)
  );

  CREATE TABLE public.invite_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo text UNIQUE
  );

  CREATE TABLE storage.objects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id text NOT NULL,
    name text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
  );
`);

try {
  await db.exec(migration);
  await db.exec(validationFix);
  await db.exec(commercialDefaults);

  const planResult = await db.query(`
    SELECT count(*)::integer AS total,
           count(*) FILTER (WHERE status = 'draft')::integer AS drafts
    FROM public.plans;
  `);
  assert.deepEqual(planResult.rows[0], { total: 6, drafts: 5 });

  const catalogResult = await db.query(`
    SELECT name, description FROM public.features WHERE code = 'inspection_arv';
  `);
  assert.deepEqual(catalogResult.rows[0], {
    name: 'Vistoria de Árvores (ARV)',
    description: 'Formulário técnico para vistoria de árvores',
  });

  const commercialSeedResult = await db.query(`
    SELECT
      (SELECT count(*)::integer FROM public.plan_versions) AS versions,
      (SELECT count(*)::integer FROM public.support_sla_policies) AS sla_policies;
  `);
  assert.deepEqual(commercialSeedResult.rows[0], { versions: 10, sla_policies: 20 });

  const pricingResult = await db.query(`
    SELECT p.code,
           (pv.configuration->'commercial'->>'monthly_price_cents')::integer AS monthly_price_cents,
           (pv.configuration->'commercial'->>'annual_price_cents')::integer AS annual_price_cents,
           (pv.configuration->'commercial'->>'trial_days')::integer AS trial_days
    FROM public.plans p
    JOIN public.plan_versions pv ON pv.plan_id = p.id AND pv.version = p.current_version
    WHERE p.code IN ('individual_basic', 'municipal_basic', 'municipal_complete')
    ORDER BY p.code;
  `);
  assert.deepEqual(pricingResult.rows, [
    { code: 'individual_basic', monthly_price_cents: 7990, annual_price_cents: 79900, trial_days: 14 },
    { code: 'municipal_basic', monthly_price_cents: 149000, annual_price_cents: 1490000, trial_days: 30 },
    { code: 'municipal_complete', monthly_price_cents: 699000, annual_price_cents: 6990000, trial_days: 30 },
  ]);

  const limitsResult = await db.query(`
    SELECT p.code, pl.resource_code, pl.hard_limit::text AS hard_limit
    FROM public.plan_limits pl
    JOIN public.plans p ON p.id = pl.plan_id
    WHERE (p.code, pl.resource_code) IN (
      ('individual_basic', 'inspections'),
      ('municipal_basic', 'users'),
      ('municipal_professional', 'inspections')
    )
    ORDER BY p.code, pl.resource_code;
  `);
  assert.deepEqual(limitsResult.rows, [
    { code: 'individual_basic', resource_code: 'inspections', hard_limit: '30' },
    { code: 'municipal_basic', resource_code: 'users', hard_limit: '10' },
    { code: 'municipal_professional', resource_code: 'inspections', hard_limit: '1000' },
  ]);

  const readFlags = async () => {
    const result = await db.query(`
      SELECT entitlement_enforcement_enabled, session_enforcement_enabled
      FROM public.subscription_settings
      WHERE singleton;
    `);
    return result.rows[0];
  };

  assert.deepEqual(await readFlags(), {
    entitlement_enforcement_enabled: false,
    session_enforcement_enabled: false,
  });

  await db.exec('BEGIN');
  await db.exec(`
    UPDATE public.subscription_settings
    SET entitlement_enforcement_enabled = true,
        session_enforcement_enabled = true;
  `);
  assert.deepEqual(await readFlags(), {
    entitlement_enforcement_enabled: true,
    session_enforcement_enabled: true,
  });
  await db.exec('ROLLBACK');

  assert.deepEqual(await readFlags(), {
    entitlement_enforcement_enabled: false,
    session_enforcement_enabled: false,
  });

  const ownerId = '11111111-1111-4111-8111-111111111111';
  await db.query('INSERT INTO auth.users(id, email) VALUES ($1, $2)', [ownerId, 'owner@test.local']);
  await db.query('INSERT INTO public.owner_admins(user_id) VALUES ($1)', [ownerId]);
  await db.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: ownerId })]);

  const editablePlan = await db.query(`SELECT id FROM public.plans WHERE code = 'individual_basic'`);
  const planId = editablePlan.rows[0].id;
  const saveResult = await db.query(`
    SELECT public.update_plan_commercial_configuration(
      $1,
      $2::jsonb,
      $3::jsonb,
      $4::jsonb,
      $5::jsonb,
      $6::jsonb
    ) AS result;
  `, [
    planId,
    JSON.stringify({ name: 'Individual Básico Atualizado', description: 'Teste do editor', status: 'draft' }),
    JSON.stringify({ monthly_price_cents: 4990, annual_price_cents: 49900, currency: 'BRL', trial_days: 14, grace_days: 7, overage_policy: 'block', support_tier: 'standard', support_channels: ['E-mail'], support_hours: 'Segunda a sexta' }),
    JSON.stringify({ inspection_standard: true, inspection_arv: false, reports_basic: true }),
    JSON.stringify({ users: { hard_limit: 1, warning_percent: 80 }, inspections: { hard_limit: 30, warning_percent: 80 }, sessions: { hard_limit: 1, warning_percent: 100 } }),
    JSON.stringify({ normal: { response_minutes: 2880, resolution_minutes: null, escalation_minutes: null } }),
  ]);
  assert.equal(saveResult.rows[0].result.saved, true);
  assert.equal(saveResult.rows[0].result.version, 3);

  const savedPlan = await db.query(`
    SELECT p.name, p.current_version,
           (pv.configuration->'commercial'->>'monthly_price_cents')::integer AS monthly_price_cents
    FROM public.plans p
    JOIN public.plan_versions pv ON pv.plan_id = p.id AND pv.version = p.current_version
    WHERE p.id = $1;
  `, [planId]);
  assert.deepEqual(savedPlan.rows[0], {
    name: 'Individual Básico Atualizado',
    current_version: 3,
    monthly_price_cents: 4990,
  });

  console.log('Migration aplicada: catálogo ARV, editor versionado e rollback das flags validados.');
} finally {
  await db.close();
}
