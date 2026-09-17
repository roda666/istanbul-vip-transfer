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

for (const viewport of viewports) {
  test.describe(`${viewport.name} G4-G6 evidence`, () => {
    test.use({ viewport });

    test('route AI control, blog author visibility and page delete are visible', async ({ adminPage: page }) => {
      test.setTimeout(240_000);
      await page.route('**/*', async (route) => {
        if (route.request().resourceType() === 'font') await route.abort();
        else await route.continue();
      });
      await page.addStyleTag({ content: '* { font-family: Arial, sans-serif !important; }' }).catch(() => {});
      await page.context().setExtraHTTPHeaders({
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      });

      await page.goto('/admin/transfer-rotalari', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await waitForSettledAdminPage(page);
      const createRoute = page.getByRole('button', { name: 'Yeni Güzergah Ekle' });
      await expect(createRoute).toBeVisible();
      await expect(createRoute).toBeEnabled();
      await createRoute.click({ force: true });
      const routeModal = page.getByRole('heading', { name: 'Yeni Güzergah Ekle' }).locator('..').locator('..');
      await expect(routeModal.getByText('Sayfa Açıklaması *')).toBeVisible();
      await expect(routeModal.getByRole('button', { name: 'AI ile Doldur' })).toBeVisible();
      await expect(routeModal.getByRole('tab', { name: 'Türkçe kaynak' })).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await screenshotEvidence(page, `owner-g4-route-ai-${viewport.name}`);

      await page.goto('/admin/blog', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await waitForSettledAdminPage(page);
      const blogEdit = page.locator('main a[href^="/admin/blog/"]:not([href="/admin/blog/yeni"])').first();
      const blogHref = await blogEdit.getAttribute('href', { timeout: 45_000 });
      expect(blogHref).toMatch(/^\/admin\/blog\/[^/]+$/);
      await page.goto(blogHref!, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await waitForSettledAdminPage(page);
      const showAuthor = page.getByText('Yazarı göster', { exact: true }).locator('..');
      await showAuthor.scrollIntoViewIfNeeded();
      await expect(showAuthor.locator('input[type="checkbox"]')).toBeChecked();
      await assertNoHorizontalOverflow(page);
      await screenshotEvidence(page, `owner-g5-blog-author-${viewport.name}`);

      await page.goto('/admin/sayfalar', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await waitForSettledAdminPage(page);
      const firstActions = page.locator('[data-admin-record-actions]').first();
      await expect(firstActions).toBeVisible({ timeout: 45_000 });
      if (viewport.width <= 480) {
        await expect(firstActions).toHaveAttribute('data-admin-action-order', /(?:^|,)delete(?:,|$)/);
        await expect(firstActions.locator('[data-admin-actions-mobile-trigger]')).toBeVisible();
      } else {
        await expect(firstActions.getByLabel('Sil', { exact: true })).toBeVisible();
      }
      await assertNoHorizontalOverflow(page);
      await screenshotEvidence(page, `owner-g6-pages-delete-${viewport.name}`);
    });
  });
}