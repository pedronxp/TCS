import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const migrationsDirectory = new URL('../supabase/migrations/', import.meta.url);
const migrationSql = readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(join(migrationsDirectory.pathname, name), 'utf8'))
  .join('\n');
const actionMigrationSql = readFileSync(
  join(migrationsDirectory.pathname, '20260826090000_portal_document_acknowledgement_actions.sql'),
  'utf8',
);

function latestFunctionDefinition(name, nextName) {
  const pattern = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${name}[\\s\\S]*?(?=CREATE OR REPLACE FUNCTION (?:public|private)\\.${nextName})`,
    'gi',
  );
  return Array.from(actionMigrationSql.matchAll(pattern)).at(-1)?.[0] || '';
}

const mobileCreateDefinition = latestFunctionDefinition(
  'create_document_acknowledgement_link',
  'portal_create_document_acknowledgement_link',
);
const portalCreateDefinition = latestFunctionDefinition(
  'portal_create_document_acknowledgement_link',
  'portal_revoke_document_acknowledgement_link',
);

const checks = [
  ['cria link pelo contrato do portal', /CREATE OR REPLACE FUNCTION public\.portal_create_document_acknowledgement_link\s*\(/i],
  ['revoga link pelo contrato do portal', /CREATE OR REPLACE FUNCTION public\.portal_revoke_document_acknowledgement_link\s*\(/i],
  ['deriva o contexto do portal no servidor', /portal_create_document_acknowledgement_link[\s\S]*get_portal_access_context\(\)/i],
  ['bloqueia emissão quando creation_allowed é falso', /portal_create_document_acknowledgement_link[\s\S]*creation_allowed/i],
  ['exige permissão document.read', /portal_create_document_acknowledgement_link[\s\S]*document\.read/i],
  ['impede link para versão com resultado final', /portal_create_document_acknowledgement_link[\s\S]*document_acknowledgement_events[\s\S]*event_kind\s*=\s*'outcome'/i],
  ['revoga somente solicitação aberta', /portal_revoke_document_acknowledgement_link[\s\S]*status\s*=\s*'open'/i],
  ['não libera as ações para anon', /REVOKE ALL ON FUNCTION public\.portal_create_document_acknowledgement_link\(uuid, integer\)[\s\S]*FROM PUBLIC, anon/i],
  ['libera as ações somente para authenticated', /GRANT EXECUTE ON FUNCTION public\.portal_create_document_acknowledgement_link\(uuid, integer\)[\s\S]*TO authenticated/i],
  ['lista expiração e capacidades sem token puro', /portal_list_acknowledgements[\s\S]*'expires_at'[\s\S]*'can_generate'[\s\S]*'can_revoke'/i],
  ['portal restringe o documento ao agente permitido', /portal_create_document_acknowledgement_link[\s\S]*portal_agent_allowed/i],
  ['um documento aceita somente um resultado final', /CREATE UNIQUE INDEX[\s\S]*document_acknowledgement_events\s*\(document_id\)[\s\S]*event_kind\s*=\s*'outcome'/i],
  ['revogação registra autor e horário', /SET status\s*=\s*'revoked'[\s\S]*revoked_by\s*=\s*v_user[\s\S]*revoked_at\s*=\s*clock_timestamp\(\)/i],
  ['autoria da revogação é retida', /revoked_by uuid REFERENCES auth\.users\(id\) ON DELETE RESTRICT/i],
  ['finalização local sinaliza conflito autoritativo', /finalize_document_acknowledgement\(p_payload jsonb\)[\s\S]*document_already_acknowledged/i],
];

const failed = checks.filter(([, pattern]) => !pattern.test(migrationSql));
if (failed.length) {
  for (const [label] of failed) console.error(`FAIL: ${label}`);
  process.exit(1);
}

if (/get_portal_access_context|creation_allowed|document\.read/i.test(mobileCreateDefinition)) {
  console.error('FAIL: RPC móvel não pode depender do contexto comercial do portal');
  process.exit(1);
}
if (!/portal_agent_allowed/i.test(portalCreateDefinition)) {
  console.error('FAIL: wrapper do portal precisa respeitar o escopo do agente');
  process.exit(1);
}

console.log(`PASS: ${checks.length} contratos de ciência web validados`);
