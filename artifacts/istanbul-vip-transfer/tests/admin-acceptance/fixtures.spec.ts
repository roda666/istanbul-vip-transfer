import { assertNoHorizontalOverflow, assertTouchTargets, expect, test, waitForSettledAdminPage } from './fixtures';

test('authenticated disposable admin fixture can open the drivers page', async ({ adminPage }) => {
  await adminPage.setViewportSize({ width: 390, height: 844 });
  const response = await adminPage.goto('/admin/soforler');
  expect(response?.status()).toBe(200);
  await waitForSettledAdminPage(adminPage);
  await expect(adminPage).not.toHaveURL(/\/admin\/login/);
  await expect(adminPage.getByRole('heading', { name: 'Sürücüler', exact: true })).toBeVisible();
  await assertNoHorizontalOverflow(adminPage);
  await assertTouchTargets(adminPage);
});