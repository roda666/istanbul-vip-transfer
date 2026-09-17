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
  test.describe(`${viewport.name} G7-G13 evidence`, () => {
    test.use({ viewport });

    test('owner dispatch controls and layouts are visible without mutating data', async ({ adminPage: page }) => {
      test.setTimeout(600_000);
      await page.route('**/*', async route => {
        if (route.request().resourceType() === 'font') await route.abort();
        else await route.continue();
      });

      await page.goto('/admin/sayfalar', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await waitForSettledAdminPage(page);
      const pageEditHref = await page.locator('main a[href^="/admin/sayfalar/"]:not([href="/admin/sayfalar/yeni"]):not([href="/admin/sayfalar/ana-sayfa"])').first().getAttribute('href');
      expect(pageEditHref).toMatch(/^\/admin\/sayfalar\/[^/]+$/);
      await page.goto(pageEditHref!, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await waitForSettledAdminPage(page);
      await expect(page.getByRole('button', { name: 'Kaydet', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'İptal', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sil', exact: true })).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await screenshotEvidence(page, `owner-g7-page-edit-${viewport.name}`);

      await page.goto('/admin/sayfalar/yeni', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await waitForSettledAdminPage(page);
      await expect(page.getByRole('button', { name: 'AI ile Oluştur', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'İptal', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /Sil \(önce kaydedin\)/ })).toBeVisible();
      await expect(page.getByRole('button', { name: '✨ AI ile Üret', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '✨ AI ile Üret', exact: true })).toBeEnabled();
      await expect(page.getByText(/Dosya Yükle/i).first()).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await screenshotEvidence(page, `owner-g8-page-create-${viewport.name}`);

      await page.goto('/admin/hizmetler', { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await waitForSettledAdminPage(page);
      await expect(page.locator('.hl-table-wrap, .hl-table-row')).toHaveCount(0);
      const firstService = page.locator('[data-testid="service-row"]').first();
      await expect(firstService).toBeVisible();
      await expect(firstService.locator('[data-admin-record-actions], button[aria-label="Sil"], button:has-text("Sil")').first()).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await screenshotEvidence(page, `owner-g9-service-cards-${viewport.name}`);

      const serviceEditHref = await page.locator('a[href^="/admin/hizmetler/"]:not([href="/admin/hizmetler/yeni"])').first().getAttribute('href');
      expect(serviceEditHref).toMatch(/^\/admin\/hizmetler\/[^/]+$/);
      await page.goto(serviceEditHref!, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await waitForSettledAdminPage(page);
      const schemaHeading = page.getByText('Yapısal Veri (Schema.org)', { exact: true });
      await schemaHeading.scrollIntoViewIfNeeded();
      await schemaHeading.click();
      for (const field of ['schema_service_type', 'schema_opening_hours', 'schema_price_range', 'schema_languages']) {
        const assist = page.locator(`[data-testid="ai-write-assist-service-${field}"]`);
        await expect(assist.getByRole('button', { name: /AI ile Oluştur/ })).toBeVisible();
      }
      await assertNoHorizontalOverflow(page);
      await screenshotEvidence(page, `owner-g10-service-schema-ai-${viewport.name}`);

      await page.goto('/admin/sss', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await waitForSettledAdminPage(page);
      await expect(page.getByText('Yükleniyor...', { exact: true })).toBeHidden({ timeout: 60_000 });
      const faqRow = page.locator('[data-testid^="faq-row-"]').first();
      await expect(faqRow).toBeVisible({ timeout: 60_000 });
      if (viewport.width <= 480) {
        await faqRow.locator('[data-admin-actions-mobile-trigger]').click();
        await page.locator('[data-admin-actions-mobile-sheet]').last().getByLabel('Düzenle', { exact: true }).click();
      } else {
        await faqRow.getByLabel('Düzenle', { exact: true }).click();
      }
      await expect(faqRow.locator('[data-testid^="faq-editor-"]')).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await screenshotEvidence(page, `owner-g11-faq-inline-${viewport.name}`);

      await page.goto('/admin/blog', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await waitForSettledAdminPage(page);
      const blogHref = await page.locator('main a[href^="/admin/blog/"]:not([href="/admin/blog/yeni"])').first().getAttribute('href');
      expect(blogHref).toMatch(/^\/admin\/blog\/[^/]+$/);
      await page.goto(blogHref!, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await waitForSettledAdminPage(page);
      const statusMachine = page.getByText('Durum Makinesi', { exact: true }).locator('..');
      await statusMachine.scrollIntoViewIfNeeded();
      await expect(statusMachine.getByRole('button', { name: 'Arşivle', exact: true })).toBeVisible();
      const translateAndPublish = statusMachine.getByRole('button', { name: '8 Dile Çevir ve Yayınla', exact: true });
      if (await translateAndPublish.count()) await expect(translateAndPublish).toBeVisible();
      await expect(statusMachine.getByText(/Fikre Döndür|Araştırmaya Gönder|İncelemeye Gönder/)).toHaveCount(0);
      await screenshotEvidence(page, `owner-g12-blog-state-machine-${viewport.name}`);

      const bottomActions = page.locator('[data-testid="blog-bottom-actions"]');
      await bottomActions.scrollIntoViewIfNeeded();
      await expect(bottomActions.getByRole('button', { name: 'Taslak Kaydet', exact: true })).toBeVisible();
      await expect(bottomActions.getByRole('button', { name: 'İptal', exact: true })).toBeVisible();
      await expect(bottomActions.getByRole('button', { name: 'Sil', exact: true })).toBeVisible();
      await expect(page.locator('[data-testid="blog-top-status"]').getByRole('button')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Kaydet', exact: true })).toHaveCount(0);
      await assertNoHorizontalOverflow(page);
      await screenshotEvidence(page, `owner-g13-blog-bottom-actions-${viewport.name}`);
    });
  });
}