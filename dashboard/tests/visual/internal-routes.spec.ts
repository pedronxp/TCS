import { expect, test } from '@playwright/test';
import { installAuthenticatedFixture, type InternalRole } from './authenticated-fixture';

type InternalRoute = {
  id: string;
  path: string;
  heading: string;
  role: InternalRole;
};

const routes: InternalRoute[] = [
  { id: 'dashboard-owner', path: '/app', heading: 'O que exige decisão agora', role: 'owner' },
  { id: 'customers', path: '/app/clientes', heading: 'Clientes', role: 'owner' },
  { id: 'customer-detail', path: '/app/clientes/organizacoes/aurora/resumo', heading: 'Prefeitura de Aurora', role: 'owner' },
  { id: 'customer-appointments', path: '/app/clientes/organizacoes/aurora/agendamentos', heading: 'Prefeitura de Aurora', role: 'owner' },
  { id: 'customer-map', path: '/app/clientes/organizacoes/aurora/mapa', heading: 'Prefeitura de Aurora', role: 'owner' },
  { id: 'customer-documents', path: '/app/clientes/organizacoes/aurora/laudos', heading: 'Prefeitura de Aurora', role: 'owner' },
  { id: 'agent-detail', path: '/app/clientes/organization%3Aaurora/usuarios/agent-7/resumo', heading: 'Prefeitura de Aurora', role: 'owner' },
  { id: 'plans', path: '/app/planos', heading: 'Planos', role: 'owner' },
  { id: 'subscriptions', path: '/app/assinaturas', heading: 'Assinaturas', role: 'owner' },
  { id: 'sessions', path: '/app/sessoes', heading: 'Sessões', role: 'owner' },
  { id: 'support', path: '/app/suporte', heading: 'Suporte', role: 'owner' },
  { id: 'staff', path: '/app/staff', heading: 'Pessoas e acessos', role: 'owner' },
  { id: 'audit', path: '/app/auditoria', heading: 'Auditoria', role: 'owner' },
  { id: 'configuration', path: '/app/governanca/configuracoes', heading: 'Auditoria', role: 'owner' },
  { id: 'archive', path: '/app/governanca/arquivamento', heading: 'Arquivamento', role: 'owner' },
  { id: 'ui-reference', path: '/app/referencia-ui', heading: 'Referência da interface TCS', role: 'owner' },
  { id: 'dashboard-developer', path: '/app', heading: 'O que exige investigação agora', role: 'developer' },
  { id: 'versions', path: '/app/desenvolvimento/versoes', heading: 'Versões', role: 'developer' },
  { id: 'builds', path: '/app/desenvolvimento/builds', heading: 'Builds', role: 'developer' },
  { id: 'forms', path: '/app/desenvolvimento/formularios', heading: 'Formulários', role: 'developer' },
  { id: 'risk-rules', path: '/app/desenvolvimento/regras-risco', heading: 'Regras de risco', role: 'developer' },
  { id: 'sync', path: '/app/desenvolvimento/sincronizacao', heading: 'Sincronização', role: 'developer' },
  { id: 'storage', path: '/app/desenvolvimento/armazenamento', heading: 'Armazenamento', role: 'developer' },
  { id: 'logs', path: '/app/desenvolvimento/logs', heading: 'Logs e erros', role: 'developer' },
];

for (const route of routes) {
  test(`${route.id} mantém a composição autenticada`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await installAuthenticatedFixture(page, route.role);
    await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
    if (route.id === 'customer-map') {
      await expect(page.getByTestId('customer-map')).toHaveAttribute('data-map-ready', 'true');
    }
    await page.evaluate(() => document.fonts.ready);

    const geometry = await page.evaluate(() => ({
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewport + 1);
    expect(runtimeErrors).toEqual([]);
    await expect(page).toHaveScreenshot(`${route.id}.png`, { fullPage: true });
  });
}
