import { expect, test } from '@playwright/test';
import { installPortalFixture } from './portal-authenticated-fixture';

function mobileOnly(projectName: string) {
  test.skip(projectName !== '390', 'A ordem de foco móvel é validada no viewport de 390 px.');
}

test('skip link público move o foco para o conteúdo', async ({ page }, testInfo) => {
  mobileOnly(testInfo.project.name);
  await page.goto('/planos', { waitUntil: 'domcontentloaded' });

  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Pular para o conteúdo' });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();

  await page.keyboard.press('Enter');
  await expect(page.locator('#conteudo')).toBeFocused();
});

test('login mantém ordem de foco lógica no mobile', async ({ page }, testInfo) => {
  mobileOnly(testInfo.project.name);
  await installPortalFixture(page, 'individual', false);
  await page.goto('/entrar', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Acesse seu portal' })).toBeVisible();

  const focusOrder = [
    page.getByRole('link', { name: 'Pular para o conteúdo' }),
    page.getByRole('link', { name: 'Voltar ao site' }),
    page.getByRole('textbox', { name: 'E-mail' }),
    page.getByLabel('Senha', { exact: true }),
    page.getByRole('button', { name: 'Mostrar senha' }),
    page.getByRole('button', { name: 'Entrar no portal', exact: true }),
    page.getByRole('link', { name: 'Esqueci minha senha' }),
    page.getByRole('button', { name: 'Continuar com Google' }),
    page.getByRole('link', { name: 'Criar conta' }),
  ];

  for (const target of focusOrder) {
    await page.keyboard.press('Tab');
    await expect(target).toBeFocused();
  }
});

test('skip link da autenticação move o foco para o conteúdo principal', async ({ page }, testInfo) => {
  mobileOnly(testInfo.project.name);
  await installPortalFixture(page, 'individual', false);
  await page.goto('/entrar', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Acesse seu portal', level: 1 })).toBeVisible();

  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Pular para o conteúdo' });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#auth-content')).toBeFocused();
});

test('menu móvel gerencia foco, Escape e retorno ao acionador', async ({ page }, testInfo) => {
  mobileOnly(testInfo.project.name);
  await installPortalFixture(page, 'individual');
  await page.goto('/portal/individual', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Olá, Ana' })).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
  await page.keyboard.press('Tab');

  const openMenu = page.getByRole('button', { name: 'Abrir menu' });
  const closeMenu = page.getByRole('button', { name: 'Fechar menu' });
  await expect(openMenu).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Navegação do portal' })).toBeVisible();
  await expect(closeMenu).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Navegação do portal' })).toBeHidden();
  await expect(openMenu).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(closeMenu).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(openMenu).toBeFocused();
});

test('vínculo municipal inativo oferece saída por teclado', async ({ page }, testInfo) => {
  mobileOnly(testInfo.project.name);
  await installPortalFixture(page, 'organization', true, {
    accessOverrides: { membership_status: 'suspended' },
  });
  await page.goto('/portal/municipal', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Vínculo municipal inativo' })).toBeVisible();

  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Pular para o conteúdo' });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#auth-content')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Voltar ao site' }).first()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Sair e usar outra conta' })).toBeFocused();
});
