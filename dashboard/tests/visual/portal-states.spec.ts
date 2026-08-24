import { expect, test } from '@playwright/test';
import { expectPortalAccessibility } from './portal-accessibility';
import {
  installPortalFixture,
  type PortalFixtureKind,
  type PortalFixtureOptions,
} from './portal-authenticated-fixture';

type PortalState = {
  id: string;
  path: string;
  expectedText?: string;
  expectedSelector?: string;
  kind?: PortalFixtureKind;
  authenticated?: boolean;
  options?: PortalFixtureOptions;
};

const checkoutId = '65000000-0000-4000-8000-000000000001';
const inviteToken = 'a'.repeat(48);

const states: PortalState[] = [
  {
    id: 'access-loading',
    path: '/portal/individual',
    expectedSelector: '.animate-pulse',
    options: {
      pendingRpcs: ['get_portal_access_context'],
    },
  },
  {
    id: 'dashboard-loading',
    path: '/portal/individual',
    expectedSelector: 'main .animate-pulse',
    options: {
      pendingRpcs: ['portal_get_dashboard'],
    },
  },
  {
    id: 'module-loading',
    path: '/portal/individual/vistorias',
    expectedSelector: 'main .animate-pulse',
    options: {
      pendingRpcs: ['portal_get_workspace'],
    },
  },
  {
    id: 'dashboard-empty',
    path: '/portal/individual',
    expectedText: 'Nenhuma vistoria neste escopo',
    options: { emptyDashboard: true },
  },
  {
    id: 'dashboard-error',
    path: '/portal/individual',
    expectedText: 'Não foi possível carregar o panorama',
    options: { errorRpcs: ['portal_get_dashboard'] },
  },
  {
    id: 'module-empty',
    path: '/portal/individual/vistorias',
    expectedText: 'Nenhum item encontrado',
    options: { emptyWorkspaceSections: ['vistorias'] },
  },
  {
    id: 'module-error-retry',
    path: '/portal/individual/vistorias',
    expectedText: 'Não foi possível carregar este módulo',
    options: { errorRpcs: ['portal_get_workspace'] },
  },
  {
    id: 'report-plan-locked',
    path: '/portal/individual/relatorios',
    expectedText: 'Relatórios não incluídos neste plano',
    options: { accessOverrides: { features: { reports: false } } },
  },
  {
    id: 'portal-access-unavailable',
    path: '/portal/individual',
    expectedText: 'Defina como você usará a TCS',
    options: { accessUnavailable: true },
  },
  {
    id: 'permission-denied',
    path: '/portal/individual/relatorios',
    expectedText: 'Olá, Ana',
    options: {
      accessOverrides: {
        permissions: ['dashboard.read'],
      },
    },
  },
  {
    id: 'membership-inactive',
    path: '/portal/municipal',
    expectedText: 'Vínculo municipal inativo',
    kind: 'organization',
    options: {
      accessOverrides: {
        membership_status: 'suspended',
      },
    },
  },
  {
    id: 'subscription-trial',
    path: '/portal/individual',
    expectedText: 'Período de teste',
    options: { accessOverrides: { subscription_status: 'trial' } },
  },
  {
    id: 'subscription-grace',
    path: '/portal/individual',
    expectedText: 'Em carência',
    options: { accessOverrides: { subscription_status: 'grace' } },
  },
  {
    id: 'subscription-past-due',
    path: '/portal/individual',
    expectedText: 'Há uma pendência de pagamento.',
    options: {
      accessOverrides: {
        subscription_status: 'past_due',
        creation_allowed: false,
        restriction_cause: 'subscription_past_due',
      },
    },
  },
  {
    id: 'subscription-cancel-at-period-end',
    path: '/portal/individual',
    expectedText: 'Cancelamento agendado',
    options: { accessOverrides: { cancel_at_period_end: true } },
  },
  {
    id: 'subscription-canceled',
    path: '/portal/individual',
    expectedText: 'Cancelada',
    options: {
      accessOverrides: {
        subscription_status: 'canceled',
        creation_allowed: false,
        restriction_cause: 'subscription_inactive',
      },
    },
  },
  {
    id: 'subscription-expired',
    path: '/portal/individual',
    expectedText: 'Expirada',
    options: {
      accessOverrides: {
        subscription_status: 'expired',
        creation_allowed: false,
        restriction_cause: 'subscription_inactive',
      },
    },
  },
  {
    id: 'invite-error',
    path: `/convite/${inviteToken}`,
    expectedText: 'Confirme o convite antes de entrar',
    authenticated: false,
    options: { errorRpcs: ['portal_get_invite_preview'] },
  },
  {
    id: 'checkout-pending',
    path: `/checkout/retorno?checkout=${checkoutId}`,
    expectedText: 'Aguardando o provedor de pagamento',
    options: { checkoutStatus: 'pending' },
  },
  {
    id: 'checkout-failed',
    path: `/checkout/retorno?checkout=${checkoutId}`,
    expectedText: 'Não foi possível confirmar o checkout',
    options: { checkoutStatus: 'failed' },
  },
  {
    id: 'checkout-expired',
    path: `/checkout/retorno?checkout=${checkoutId}`,
    expectedText: 'O prazo deste checkout expirou',
    options: { checkoutStatus: 'expired' },
  },
];

type AsyncRouteState = {
  id: string;
  path: string;
  rpc: string;
  kind?: PortalFixtureKind;
  loadingText?: string;
  loadingSelector?: string;
  errorText: string;
  emptyText?: string;
  emptyOptions?: PortalFixtureOptions;
};

const asyncRoutes: AsyncRouteState[] = [
  {
    id: 'individual-dashboard',
    path: '/portal/individual',
    rpc: 'portal_get_dashboard',
    loadingSelector: 'main .animate-pulse',
    errorText: 'Não foi possível carregar o panorama',
    emptyText: 'Nenhuma vistoria neste escopo',
    emptyOptions: { emptyDashboard: true },
  },
  {
    id: 'municipal-dashboard',
    path: '/portal/municipal',
    rpc: 'portal_get_dashboard',
    kind: 'organization',
    loadingSelector: 'main .animate-pulse',
    errorText: 'Não foi possível carregar o panorama',
    emptyText: 'Nenhuma vistoria neste escopo',
    emptyOptions: { emptyDashboard: true },
  },
  ...[
    ['individual-vistorias', '/portal/individual/vistorias', 'vistorias'],
    ['individual-documentos', '/portal/individual/documentos', 'documentos'],
    ['individual-consumo', '/portal/individual/consumo', 'consumo'],
    ['municipal-vistorias', '/portal/municipal/vistorias', 'vistorias'],
    ['municipal-documentos', '/portal/municipal/documentos', 'documentos'],
    ['municipal-consumo', '/portal/municipal/consumo', 'consumo'],
  ].map(([id, path, section]) => ({
    id,
    path,
    rpc: 'portal_get_workspace',
    kind: id.startsWith('municipal-') ? 'organization' as const : 'individual' as const,
    loadingSelector: 'main .animate-pulse',
    errorText: 'Não foi possível carregar este módulo',
    emptyText: 'Nenhum item encontrado',
    emptyOptions: { emptyWorkspaceSections: [section] },
  })),
  ...[
    ['individual-relatorios', '/portal/individual/relatorios'],
    ['municipal-relatorios', '/portal/municipal/relatorios'],
  ].map(([id, path]) => ({
    id,
    path,
    rpc: 'portal_get_reporting',
    kind: id.startsWith('municipal-') ? 'organization' as const : 'individual' as const,
    loadingSelector: '[role="status"]',
    errorText: 'Relatórios em integração',
  })),
  ...[
    ['individual-mapa', '/portal/individual/mapa'],
    ['municipal-mapa', '/portal/municipal/mapa'],
  ].map(([id, path]) => ({
    id,
    path,
    rpc: 'portal_get_workspace',
    kind: id.startsWith('municipal-') ? 'organization' as const : 'individual' as const,
    loadingSelector: 'main .animate-pulse',
    errorText: 'Não foi possível carregar as vistorias do mapa',
    emptyText: 'Nenhuma vistoria no mapa',
    emptyOptions: { emptyWorkspaceSections: ['mapa'] },
  })),
  ...[
    ['individual-agenda', '/portal/individual/agenda'],
    ['municipal-agenda', '/portal/municipal/agenda'],
  ].map(([id, path]) => ({
    id,
    path,
    rpc: 'portal_get_workspace',
    kind: id.startsWith('municipal-') ? 'organization' as const : 'individual' as const,
    loadingText: 'Carregando agenda',
    errorText: 'Não foi possível carregar a agenda',
    emptyText: 'Nenhum compromisso agendado',
    emptyOptions: { emptyWorkspaceSections: ['agenda'] },
  })),
  {
    id: 'municipal-equipe',
    path: '/portal/municipal/equipe',
    rpc: 'portal_get_workspace',
    kind: 'organization',
    loadingText: 'Carregando equipe',
    errorText: 'Não foi possível carregar a equipe.',
    emptyText: 'Nenhuma pessoa corresponde aos filtros.',
    emptyOptions: { emptyWorkspaceSections: ['equipe'] },
  },
  {
    id: 'municipal-convites',
    path: '/portal/municipal/convites',
    rpc: 'portal_get_workspace',
    kind: 'organization',
    loadingSelector: 'main p:text-is("Carregando…")',
    errorText: 'Não foi possível carregar os convites.',
    emptyText: 'Nenhum convite emitido.',
    emptyOptions: { emptyWorkspaceSections: ['convites'] },
  },
  ...[
    ['individual-suporte', '/portal/individual/suporte'],
    ['municipal-suporte', '/portal/municipal/suporte'],
  ].map(([id, path]) => ({
    id,
    path,
    rpc: 'portal_get_workspace',
    kind: id.startsWith('municipal-') ? 'organization' as const : 'individual' as const,
    loadingText: 'Carregando chamados',
    errorText: 'Não foi possível carregar os chamados.',
    emptyText: 'Nenhum chamado aberto.',
    emptyOptions: { emptyWorkspaceSections: ['suporte'] },
  })),
  {
    id: 'municipal-configuracoes',
    path: '/portal/municipal/configuracoes',
    rpc: 'portal_get_workspace',
    kind: 'organization',
    loadingText: 'Carregando configurações',
    errorText: 'Não foi possível carregar as configurações.',
    emptyOptions: { emptyWorkspaceSections: ['configuracoes'] },
  },
  ...[
    ['individual-perfil', '/portal/individual/perfil'],
    ['municipal-perfil', '/portal/municipal/perfil'],
  ].map(([id, path]) => ({
    id,
    path,
    rpc: 'portal_list_own_sessions',
    kind: id.startsWith('municipal-') ? 'organization' as const : 'individual' as const,
    loadingText: 'Carregando registros',
    errorText: 'Não foi possível carregar os registros.',
    emptyText: 'Nenhum dispositivo registrado como ativo.',
    emptyOptions: { emptySessions: true },
  })),
  ...[
    ['individual-vistoria-detalhe', `/portal/individual/vistorias/${'63000000-0000-4000-8000-000000000001'}`],
    ['municipal-vistoria-detalhe', `/portal/municipal/vistorias/${'63000000-0000-4000-8000-000000000001'}`],
  ].map(([id, path]) => ({
    id,
    path,
    rpc: 'portal_get_inspection',
    kind: id.startsWith('municipal-') ? 'organization' as const : 'individual' as const,
    loadingSelector: 'main .animate-pulse',
    errorText: 'Vistoria indisponível',
  })),
];

for (const route of asyncRoutes) {
  states.push({
    id: `${route.id}--loading`,
    path: route.path,
    kind: route.kind,
    expectedText: route.loadingText,
    expectedSelector: route.loadingSelector,
    options: { pendingRpcs: [route.rpc] },
  });
  states.push({
    id: `${route.id}--error`,
    path: route.path,
    kind: route.kind,
    expectedText: route.errorText,
    options: { errorRpcs: [route.rpc] },
  });
  if (route.emptyText && route.emptyOptions) {
    states.push({
      id: `${route.id}--empty`,
      path: route.path,
      kind: route.kind,
      expectedText: route.emptyText,
      options: route.emptyOptions,
    });
  }
}

states.push(
  {
    id: 'municipal-access-loading',
    path: '/portal/municipal',
    kind: 'organization',
    expectedSelector: '.animate-pulse',
    options: { pendingRpcs: ['get_portal_access_context'] },
  },
  {
    id: 'municipal-permission-denied',
    path: '/portal/municipal/equipe',
    kind: 'organization',
    expectedText: 'Vistorias fora do seu acesso',
    options: { accessOverrides: { permissions: ['dashboard.read'] } },
  },
  {
    id: 'municipal-report-plan-locked',
    path: '/portal/municipal/relatorios',
    kind: 'organization',
    expectedText: 'Relatórios não incluídos neste plano',
    options: { accessOverrides: { features: { reports: false, municipal_portal: true } } },
  },
  {
    id: 'invite-loading',
    path: `/convite/${inviteToken}`,
    authenticated: false,
    expectedText: 'Validando convite',
    options: { pendingRpcs: ['portal_get_invite_preview'] },
  },
);

for (const state of [
  { id: 'trial', expectedText: 'Período de teste', overrides: { subscription_status: 'trial' } },
  { id: 'grace', expectedText: 'Em carência', overrides: { subscription_status: 'grace' } },
  {
    id: 'past-due',
    expectedText: 'Há uma pendência de pagamento.',
    overrides: { subscription_status: 'past_due', creation_allowed: false, restriction_cause: 'subscription_past_due' },
  },
  { id: 'cancel-at-period-end', expectedText: 'Cancelamento agendado', overrides: { cancel_at_period_end: true } },
  {
    id: 'canceled',
    expectedText: 'Cancelada',
    overrides: { subscription_status: 'canceled', creation_allowed: false, restriction_cause: 'subscription_inactive' },
  },
  {
    id: 'expired',
    expectedText: 'Expirada',
    overrides: { subscription_status: 'expired', creation_allowed: false, restriction_cause: 'subscription_inactive' },
  },
] as const) {
  states.push({
    id: `municipal-subscription-${state.id}`,
    path: '/portal/municipal',
    kind: 'organization',
    expectedText: state.expectedText,
    options: { accessOverrides: state.overrides },
  });
}

for (const state of states) {
  test(`${state.id} mantém o estado alternativo aprovado`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installPortalFixture(
      page,
      state.kind ?? 'individual',
      state.authenticated !== false,
      state.options,
    );
    await page.goto(state.path, { waitUntil: 'domcontentloaded' });
    if (state.expectedText) {
      await expect(page.getByText(state.expectedText, { exact: false }).first()).toBeVisible();
    }
    if (state.expectedSelector) {
      await expect(page.locator(state.expectedSelector).first()).toBeVisible();
    }
    await page.evaluate(() => document.fonts.ready);

    const geometry = await page.evaluate(() => ({
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewport + 1);
    await expectPortalAccessibility(page, state.id);
    await expect(page).toHaveScreenshot(`${state.id}.png`, { fullPage: true });
  });
}
