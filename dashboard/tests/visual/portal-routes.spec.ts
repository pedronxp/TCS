import { expect, test } from '@playwright/test';
import {
  expectPortalAccessibility,
  expectPortalReducedMotion,
  expectPortalScreenReaderStructure,
  expectPortalTextZoom,
} from './portal-accessibility';
import { installPortalFixture, type PortalFixtureKind } from './portal-authenticated-fixture';

type PortalRoute = {
  id: string;
  path: string;
  heading: string;
  kind: PortalFixtureKind;
  authenticated?: boolean;
  readySelector?: string;
};

const routes: PortalRoute[] = [
  { id: 'public-plans', path: '/planos', heading: 'Escolha o plano ideal para a sua operação.', kind: 'individual', authenticated: false },
  { id: 'portal-login', path: '/entrar', heading: 'Acesse seu portal', kind: 'individual', authenticated: false },
  { id: 'portal-sign-up', path: '/criar-conta', heading: 'Crie seu acesso', kind: 'individual', authenticated: false },
  { id: 'portal-invite-acceptance', path: `/convite/${'a'.repeat(48)}`, heading: 'Confirme o convite antes de entrar', kind: 'organization', authenticated: false },
  { id: 'portal-checkout-return', path: '/checkout/retorno?checkout=65000000-0000-4000-8000-000000000001', heading: 'Pagamento confirmado pelo servidor', kind: 'individual' },

  { id: 'portal-individual-dashboard', path: '/portal/individual', heading: 'Olá, Ana', kind: 'individual' },
  { id: 'portal-individual-vistorias', path: '/portal/individual/vistorias', heading: 'Vistorias', kind: 'individual' },
  { id: 'portal-individual-inspection-detail', path: '/portal/individual/vistorias/63000000-0000-4000-8000-000000000001', heading: 'TCS-2026-041', kind: 'individual' },
  { id: 'portal-individual-mapa', path: '/portal/individual/mapa', heading: 'Mapa de vistorias', kind: 'individual' },
  { id: 'portal-individual-agenda', path: '/portal/individual/agenda', heading: 'Agenda', kind: 'individual' },
  { id: 'portal-individual-documentos', path: '/portal/individual/documentos', heading: 'Documentos', kind: 'individual' },
  { id: 'portal-individual-relatorios', path: '/portal/individual/relatorios', heading: 'Relatórios e estatísticas', kind: 'individual', readySelector: '[aria-label="Indicadores do recorte"]' },
  { id: 'portal-individual-consumo', path: '/portal/individual/consumo', heading: 'Consumo', kind: 'individual' },
  { id: 'portal-individual-assinatura', path: '/portal/individual/assinatura', heading: 'Assinatura', kind: 'individual' },
  { id: 'portal-individual-suporte', path: '/portal/individual/suporte', heading: 'Suporte', kind: 'individual' },
  { id: 'portal-individual-perfil', path: '/portal/individual/perfil', heading: 'Perfil e segurança', kind: 'individual' },

  { id: 'portal-municipal-dashboard', path: '/portal/municipal', heading: 'Operação de Prefeitura de Aurora', kind: 'organization' },
  { id: 'portal-municipal-vistorias', path: '/portal/municipal/vistorias', heading: 'Vistorias', kind: 'organization' },
  { id: 'portal-municipal-inspection-detail', path: '/portal/municipal/vistorias/63000000-0000-4000-8000-000000000001', heading: 'TCS-2026-041', kind: 'organization' },
  { id: 'portal-municipal-mapa', path: '/portal/municipal/mapa', heading: 'Mapa de vistorias', kind: 'organization' },
  { id: 'portal-municipal-agenda', path: '/portal/municipal/agenda', heading: 'Agenda', kind: 'organization' },
  { id: 'portal-municipal-documentos', path: '/portal/municipal/documentos', heading: 'Documentos', kind: 'organization' },
  { id: 'portal-municipal-relatorios', path: '/portal/municipal/relatorios', heading: 'Relatórios e estatísticas', kind: 'organization', readySelector: '[aria-label="Indicadores do recorte"]' },
  { id: 'portal-municipal-equipe', path: '/portal/municipal/equipe', heading: 'Equipe', kind: 'organization' },
  { id: 'portal-municipal-convites', path: '/portal/municipal/convites', heading: 'Convites', kind: 'organization' },
  { id: 'portal-municipal-consumo', path: '/portal/municipal/consumo', heading: 'Consumo', kind: 'organization' },
  { id: 'portal-municipal-assinatura', path: '/portal/municipal/assinatura', heading: 'Assinatura', kind: 'organization' },
  { id: 'portal-municipal-suporte', path: '/portal/municipal/suporte', heading: 'Suporte', kind: 'organization' },
  { id: 'portal-municipal-configuracoes', path: '/portal/municipal/configuracoes', heading: 'Configurações', kind: 'organization' },
  { id: 'portal-municipal-perfil', path: '/portal/municipal/perfil', heading: 'Perfil e segurança', kind: 'organization' },
];

for (const route of routes) {
  test(`${route.id} mantém a composição responsiva do portal`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    await page.emulateMedia({ reducedMotion: 'reduce' });
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await installPortalFixture(page, route.kind, route.authenticated !== false);
    await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: route.heading, exact: true })).toBeVisible();
    if (route.readySelector) {
      await expect(page.locator(route.readySelector)).toBeVisible();
    }
    await page.evaluate(() => document.fonts.ready);

    const geometry = await page.evaluate(() => ({
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflowing: [...document.querySelectorAll<HTMLElement>('body *')]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            className: element.className,
            text: element.textContent?.trim().slice(0, 80) ?? '',
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            scrollWidth: element.scrollWidth,
          };
        })
        .filter((element) => element.left < -1 || element.right > window.innerWidth + 1 || element.scrollWidth > element.width + 1)
        .slice(0, 8),
      touchTargets: [...document.querySelectorAll<HTMLElement>('button, a, input, select, textarea')]
        .filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          const inlineLink = element.tagName === 'A' && style.display === 'inline';
          return !element.classList.contains('sr-only')
            && !inlineLink
            && style.display !== 'none'
            && style.visibility !== 'hidden'
            && rect.width > 0
            && rect.height > 0;
        })
        .map((element) => {
          const measurementTarget = element instanceof HTMLInputElement
            && (element.type === 'checkbox' || element.type === 'radio')
            ? document.querySelector<HTMLElement>(`label[for="${CSS.escape(element.id)}"]`) ?? element.closest<HTMLElement>('label') ?? element
            : element;
          return {
            label: element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName,
            width: measurementTarget.getBoundingClientRect().width,
            height: measurementTarget.getBoundingClientRect().height,
          };
        }),
    }));
    expect(geometry.scrollWidth, `Overflow horizontal em ${route.id}: ${JSON.stringify(geometry.overflowing)}`).toBeLessThanOrEqual(geometry.viewport + 1);
    if (geometry.viewport === 390) {
      const undersized = geometry.touchTargets.filter(
        (target) => target.width < 44 || target.height < 44,
      );
      expect(undersized, `Alvos de toque menores que 44px em ${route.id}`).toEqual([]);
    }
    expect(runtimeErrors).toEqual([]);
    await expectPortalAccessibility(page, route.id);
    await expectPortalScreenReaderStructure(page, route.id);
    await expectPortalReducedMotion(page, route.id);

    const mapCanvases = page.locator('.portal-map canvas');
    if (route.id.endsWith('-mapa')) {
      await expect(page.locator('.maplibregl-marker')).toHaveCount(2);
      await expect(mapCanvases).toHaveCount(1);
    }

    await expect(page).toHaveScreenshot(`${route.id}.png`, {
      fullPage: true,
      mask: route.id.endsWith('-mapa') ? [mapCanvases] : [],
      maskColor: '#f7f5f2',
    });
    if (geometry.viewport === 390) {
      await expectPortalTextZoom(page, route.id);
    }
  });
}
