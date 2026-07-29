import { expect, test } from '@playwright/test';

const routes = [
  {
    id: 'commercial',
    path: '/',
    heading: 'Da vistoria em campo à decisão de gestão.',
  },
  {
    id: 'login',
    path: '/login',
    heading: 'Decisões melhores começam com dados confiáveis.',
  },
] as const;

for (const route of routes) {
  test(`${route.id} mantém a composição aprovada`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const geometry = await page.evaluate(() => ({
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewport + 1);
    expect(consoleErrors).toEqual([]);
    await expect(page).toHaveScreenshot(`${route.id}.png`, { fullPage: true });
  });
}
