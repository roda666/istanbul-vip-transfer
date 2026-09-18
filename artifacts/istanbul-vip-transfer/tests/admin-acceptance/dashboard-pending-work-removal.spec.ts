import {
  assertNoHorizontalOverflow,
  expect,
  screenshotEvidence,
  test,
  waitForSettledAdminPage,
} from './fixtures';

const viewports = [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
] as const;

test('dashboard keeps its operational content without the pending work list', async ({ adminPage: page }) => {
  test.setTimeout(300_000);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await waitForSettledAdminPage(page);

    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(page.getByText('Bugünkü transferler', { exact: true })).toBeVisible();
    await expect(page.getByText('Atama bekleyen', { exact: true })).toBeVisible();
    await expect(page.getByText('Yanıt bekleyen fiyat talepleri', { exact: true })).toBeVisible();
    await expect(page.getByText('Bugünün Transfer Akışı', { exact: true })).toBeVisible();
    await expect(page.getByText('Bekleyen İşler', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Yanıt bekleyen fiyat talebi', { exact: true })).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
    await screenshotEvidence(page, `dashboard-without-pending-work-${viewport.name}`);
  }
});