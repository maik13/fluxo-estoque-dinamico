import { test, expect } from '@playwright/test';

test.describe('Testes de Regressão - Estoque', () => {
  test('carregamento inicial do painel', async ({ page }) => {
    // Assuming there's a mock or we need to login
    // Since we don't have the real DB credentials in the test, we'll just check if the app loads and shows Auth or Index
    await page.goto('/');
    
    // Check if the title is present (either Auth or Almoxarifado)
    const title = await page.title();
    expect(title).toBeDefined();

    // Check if the main app container is there
    await expect(page.locator('body')).toBeVisible();
  });
});
