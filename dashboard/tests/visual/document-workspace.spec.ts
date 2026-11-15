import { expect, test } from '@playwright/test';
import { installAuthenticatedFixture } from './authenticated-fixture';

test('document workspace fits viewport and updates preserved status', async ({ page }) => {
  await installAuthenticatedFixture(page, 'owner');
  await page.route('**/rest/v1/rpc/get_internal_staff_profile', async route => {
    await route.fulfill({ json: { id: 'owner', user_id: '00000000-0000-4000-8000-000000000001', display_name: 'QA', role: 'owner', status: 'active', assurance_level: 'aal2', permissions: ['console.read', 'protocol.read'] } });
  });
  let generated = false;
  await page.route('**/rest/v1/rpc/get_internal_protocol_inspection', async route => {
    await route.fulfill({ json: { id: 'qa', protocol: 'TCS-QA-2026-000037', documents: { report: false, laudo: generated, term: false }, agent_name: 'Responsável técnico', risk_level: 'r4', municipality: 'Belo Horizonte', photo_count: 0, photo_urls: [] } });
  });
  await page.route('**/functions/v1/generate-inspection-laudo', async route => {
    generated = true;
    await route.fulfill({ json: { ok: true, document_id: 'qa-document', document_version: 2, issuance_status: 'preliminary', signed_url: 'https://example.test/qa.pdf' } });
  });
  await page.goto('/app/protocolos/qa/relatorio');
  await expect(page.getByRole('heading', {name: 'Relatório de vistoria', exact: true})).toBeVisible();
  const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  await fits();
  await expect(page.getByText('Não gerado', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Gerar e preservar versão PDF'}).click();
  await expect(page.getByRole('link', {name: 'Abrir PDF preservado'})).toBeVisible();
  await expect(page.getByText('Disponível', {exact: true})).toBeVisible();
  await expect(page.getByText('Não gerado', {exact: true})).toHaveCount(0);
  await fits();
  await page.reload();
  await expect(page.getByText('Disponível', {exact: true})).toBeVisible();
  await fits();
});
