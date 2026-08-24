import { expect, test } from '@playwright/test';

const routes = [
  {
    id: 'commercial',
    path: '/',
    heading: 'Registre a vistoria uma vez. Use a evidência até a decisão.',
  },
  {
    id: 'login',
    path: '/login',
    heading: 'Entre no Console',
  },
] as const;

for (const route of routes) {
  test(`${route.id} mantém a composição aprovada`, async ({ page }) => {
    const consoleErrors: string[] = [];
    await page.route('https://visual-regression.invalid/**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    }));
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

test('callback de autenticação mostra uma tela e nunca permanece em branco', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/auth/callback?source=console&returnTo=%2Fapp', {
    waitUntil: 'domcontentloaded',
  });

  await expect(page.locator('main')).toBeVisible();
  await expect(page.getByRole('heading', {
    name: /Autenticando sua conta TCS|Não foi possível concluir o acesso/,
  })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
