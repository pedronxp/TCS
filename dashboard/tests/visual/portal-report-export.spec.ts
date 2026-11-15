import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { installPortalFixture } from './portal-authenticated-fixture';

test('cliente exporta o recorte autorizado em CSV e PDF', async ({ page, context }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-11-15T15:00:00Z'));
  await installPortalFixture(page, 'individual');
  await context.addInitScript(() => {
    window.print = () => { document.documentElement.dataset.printRequested = 'true'; };
  });
  await page.goto('/portal/individual/relatorios');
  await page.getByLabel(/Período/).first().selectOption('this_year');
  const csvButton = page.getByRole('button', { name: 'Exportar CSV', exact: true });
  await expect(csvButton).toBeEnabled();
  const rows = await page.locator('table tbody tr').count();
  expect(rows).toBeGreaterThan(0);
  const downloadPromise = page.waitForEvent('download');
  await csvButton.click();
  const download = await downloadPromise;
  const csvPath = testInfo.outputPath('indicadores.csv');
  await download.saveAs(csvPath);
  expect(await readFile(csvPath, 'utf8')).toContain('TCS-');

  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Exportar PDF', exact: true }).click();
  const popup = await popupPromise;
  await expect(popup.getByRole('heading', { name: 'Relatório de indicadores' })).toBeVisible();
  await expect(popup.locator('tbody tr')).toHaveCount(rows);
  await expect(popup.locator('body')).toContainText('01/01/2026 a 15/11/2026');
  const pdf = await popup.pdf({ format: 'A4', landscape: true, path: testInfo.outputPath('indicadores.pdf') });
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  await popup.close();
});
