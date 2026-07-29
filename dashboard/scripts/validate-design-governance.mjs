import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const governedPages = [
  'DashboardHome.tsx', 'AgentDetailPage.tsx', 'CustomersPage.tsx', 'CustomerDetailPage.tsx',
  'PlansPage.tsx', 'SubscriptionsPage.tsx', 'SessionsPage.tsx', 'SupportPage.tsx',
  'StaffPage.tsx', 'AuditPage.tsx', 'VersionsPage.tsx', 'BuildsPage.tsx', 'FormsPage.tsx',
  'RiskRulesPage.tsx', 'TechnicalEventsPage.tsx', 'ConfiguracoesPage.tsx',
  'ArquivamentoPage.tsx', 'LoginPage.tsx', 'StyleGuidePage.tsx',
];

const nativePrimitiveBudget = {
  'AgentDetailPage.tsx': 8,
  'CustomersPage.tsx': 1,
  'CustomerDetailPage.tsx': 1,
  'PlansPage.tsx': 26,
  'SubscriptionsPage.tsx': 1,
  'SessionsPage.tsx': 1,
  'SupportPage.tsx': 3,
  'StaffPage.tsx': 2,
  'AuditPage.tsx': 2,
  'VersionsPage.tsx': 2,
  'BuildsPage.tsx': 1,
  'FormsPage.tsx': 5,
  'RiskRulesPage.tsx': 3,
  'LoginPage.tsx': 1,
};

const literalColorBudget = {};

const literalColor = /(?:bg|text|border|ring|accent)-(?:red|blue|slate|amber|emerald|gray|zinc|stone)-\d+/g;
const nativePrimitive = /<(?:button|input|select|textarea|table)(?:\s|>)/g;

for (const file of governedPages) {
  const source = await readFile(new URL(`../src/pages/${file}`, import.meta.url), 'utf8');
  const literalCount = source.match(literalColor)?.length ?? 0;
  const primitiveCount = source.match(nativePrimitive)?.length ?? 0;
  assert(
    literalCount <= (literalColorBudget[file] ?? 0),
    `${file} adicionou cores literais (${literalCount}); use tokens semânticos.`,
  );
  assert(
    primitiveCount <= (nativePrimitiveBudget[file] ?? 0),
    `${file} adicionou primitivas HTML paralelas (${primitiveCount}); use componentes compartilhados.`,
  );
}

for (const file of ['CommercialPage.tsx']) {
  const source = await readFile(new URL(`../src/pages/public/${file}`, import.meta.url), 'utf8');
  assert.equal(source.match(literalColor)?.length ?? 0, 0, `${file} deve usar apenas tokens semânticos.`);
  assert.equal(source.match(nativePrimitive)?.length ?? 0, 0, `${file} deve usar componentes compartilhados.`);
}

for (const path of [
  '../src/components/layout/AppHeader.tsx',
  '../src/components/layout/AppSidebar.tsx',
  '../src/components/layout/ConsoleShell.tsx',
  '../src/components/data/DataTablePrimitives.tsx',
  '../src/components/domain/Badges.tsx',
]) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  assert.equal(source.match(literalColor)?.length ?? 0, 0, `${path} deve usar apenas tokens semânticos.`);
}

const highRiskDialog = await readFile(new URL('../src/components/ui/HighRiskDialog.tsx', import.meta.url), 'utf8');
assert.equal(
  highRiskDialog.match(literalColor)?.length ?? 0,
  0,
  'HighRiskDialog deve usar apenas tokens semânticos.',
);
assert.equal(
  highRiskDialog.match(nativePrimitive)?.length ?? 0,
  0,
  'HighRiskDialog deve usar apenas primitivas compartilhadas.',
);

console.log('Governança visual validada: cores e primitivas novas estão bloqueadas nas rotas migradas.');
