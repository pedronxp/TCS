import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';

const portalFiles = [];
for await (const path of glob([
  'src/PortalApp.tsx',
  'src/contexts/PortalAuthContext.tsx',
  'src/components/portal/**/*.{ts,tsx}',
  'src/pages/portal/**/*.{ts,tsx}',
  'src/config/portalNavigation.ts',
  'src/lib/portal.ts',
])) {
  portalFiles.push(path);
}

const forbidden = [
  '@/contexts/AuthContext',
  '@/config/navigation',
  'get_internal_staff_profile',
  'record_internal_access_denied',
  '/app/',
];

for (const path of portalFiles) {
  const source = await readFile(path, 'utf8');
  for (const token of forbidden) {
    assert(!source.includes(token), `Fronteira do portal violada em ${path}: ${token}`);
  }
}

const migration = await readFile('../supabase/migrations/20260729150000_customer_portals_foundation.sql', 'utf8');
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.get_portal_access_context\(\)/);
assert.match(migration, /REVOKE ALL ON FUNCTION public\.get_portal_access_context\(\) FROM PUBLIC, anon/);
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.get_portal_access_context\(\) TO authenticated/);
assert.match(migration, /auth\.role\(\) <> 'service_role'/);
assert(!/GRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE)[\s\S]{0,80}portal_payment_events[\s\S]{0,40}authenticated/i.test(migration));

const portalTables = [
  'plan_version_features',
  'plan_version_limits',
  'portal_rollout_settings',
  'portal_checkout_sessions',
  'portal_payment_events',
];
for (const table of portalTables) {
  assert.match(
    migration,
    new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`),
    `RLS ausente em public.${table}`,
  );
}

const securityDefinerFunctions = [
  'private.portal_agent_allowed',
  'public.portal_ensure_individual_profile',
  'public.get_portal_access_context',
  'public.portal_get_dashboard',
  'public.portal_get_workspace',
  'public.portal_create_appointment',
  'public.portal_get_inspection',
  'public.portal_list_own_sessions',
  'public.portal_end_own_session',
  'public.portal_authorize_inspection_document',
  'public.portal_get_invite_preview',
  'public.portal_create_organization_invite',
  'public.portal_accept_organization_invite',
  'public.portal_revoke_organization_invite',
  'public.portal_create_checkout',
  'public.portal_get_checkout_status',
  'public.portal_process_payment_event',
  'public.portal_update_organization_member',
  'public.portal_update_organization_settings',
];
for (const functionName of securityDefinerFunctions) {
  const escapedName = functionName.replace('.', '\\.');
  assert.match(
    migration,
    new RegExp(
      `CREATE OR REPLACE FUNCTION ${escapedName}\\([\\s\\S]{0,1800}?SECURITY DEFINER[\\s\\S]{0,120}?SET search_path = ''[\\s\\S]{0,120}?AS \\$\\$`,
    ),
    `SECURITY DEFINER sem search_path fixo em ${functionName}`,
  );
}

assert.match(
  migration,
  /FROM public\.organization_members AS target[\s\S]{0,240}target\.organization_id = p_organization_id[\s\S]{0,160}target\.user_id::text = p_agent_id[\s\S]{0,120}target\.status = 'active'/,
  'Escopo de agente não exige membership ativo na organização',
);

const hardeningMigration = await readFile(
  '../supabase/migrations/20260729160641_harden_legacy_portal_security.sql',
  'utf8',
);
assert.match(hardeningMigration, /DROP POLICY IF EXISTS allow_self_insert_on_signup ON public\.users/);
assert.match(hardeningMigration, /DROP POLICY IF EXISTS allow_mark_token_used ON public\.invite_tokens/);
assert.match(hardeningMigration, /DROP POLICY IF EXISTS leitura_publica_fotos ON storage\.objects/);
assert.match(hardeningMigration, /DROP POLICY IF EXISTS "Vistorias Public Read" ON storage\.objects/);
assert.match(
  hardeningMigration,
  /REVOKE ALL ON FUNCTION public\.admin_reset_password\(uuid, text\)[\s\S]*FROM PUBLIC, anon/,
);
assert.match(hardeningMigration, /procedure\.prorettype = 'trigger'::regtype/);

const portalTests = await readFile('../supabase/tests/customer_portals_test.sql', 'utf8');
const declaredPlan = Number(portalTests.match(/extensions\.plan\((\d+)\)/)?.[1]);
const assertions = [...portalTests.matchAll(
  /SELECT extensions\.(?:is|isnt|ok|cmp_ok|throws_ok|lives_ok|results_eq|set_eq|bag_eq)\(/g,
)].length;
assert.equal(declaredPlan, assertions, `Plano pgTAP declara ${declaredPlan}, mas contém ${assertions} asserções`);

console.log(
  `Fronteira do portal validada em ${portalFiles.length} arquivos, ${portalTables.length} tabelas RLS, `
  + `${securityDefinerFunctions.length} funções e ${assertions} asserções pgTAP.`,
);
