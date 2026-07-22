import { expect, test } from '@playwright/test';

const email = process.env.E2E_ESTOQUE_EMAIL;
const password = process.env.E2E_ESTOQUE_PASSWORD;
const credentialsAvailable = Boolean(email && password);

test.describe('Regressão do Almoxarifado', () => {
  test.skip(!credentialsAvailable, 'Credenciais E2E do almoxarifado não configuradas.');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    if (await emailInput.isVisible()) {
      await emailInput.fill(email!);
      await passwordInput.fill(password!);
      await page.getByRole('button', { name: /entrar|login|acessar/i }).click();
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('mantém o painel do almoxarifado acessível', async ({ page }) => {
    await expect(
      page.getByText(/almoxarifado|estoque|painel gerencial/i).first(),
    ).toBeVisible();
  });

  test('mantém os fluxos principais visíveis', async ({ page }) => {
    const labels = [/entrada/i, /saída/i, /retirada/i, /devolução/i];

    let encontrados = 0;
    for (const label of labels) {
      if (await page.getByText(label).first().isVisible().catch(() => false)) {
        encontrados += 1;
      }
    }

    expect(encontrados).toBeGreaterThanOrEqual(2);
  });
});
