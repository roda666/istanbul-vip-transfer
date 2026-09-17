import {
  assertNoHorizontalOverflow,
  expect,
  screenshotEvidence,
  test,
  waitForSettledAdminPage,
} from './fixtures';

const SERVICE_EDIT = '/admin/hizmetler/7b7ed1b8-90ee-44f3-8a73-81d97bceded8';
const BLOG_EDIT = '/admin/blog/4d6096cc-7d74-49dd-9c88-ca70340f9c98';
const viewports = [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test.describe(`${viewport.name} direct G10-G13 evidence`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ adminPage: page }) => {
      test.setTimeout(240_000);
      await page.route('**/*', async route => {
        if (route.request().resourceType() === 'font') await route.abort();
        else await route.continue();
      });
    });

    test('G10 service schema AI controls', async ({ adminPage: page }) => {
      await page.goto(SERVICE_EDIT, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await waitForSettledAdminPage(page);
      const heading = page.getByText('Yapısal Veri (Schema.org)', { exact: true });
      await expect(heading).toBeVisible({ timeout: 60_000 });
      await heading.click();
      for (const field of ['schema_service_type', 'schema_opening_hours', 'schema_price_range', 'schema_languages']) {
        await expect(page.locator(`[data-testid="ai-write-assist-service-${field}"]`).getByRole('button', { name: /AI ile Oluştur/ }))
          .toBeVisible({ timeout: 60_000 });
      }
      await assertNoHorizontalOverflow(page);
      await screenshotEvidence(page, `owner-g10-service-schema-ai-${viewport.name}`);
    });

    test('G11 FAQ editor opens inside its selected row', async ({ adminPage: page }) => {
      await page.goto('/admin/sss', { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await waitForSettledAdminPage(page);
      await expect(page.getByText('Yükleniyor...', { exact: true })).toBeHidden({ timeout: 90_000 });
      const row = page.locator('[data-testid^="faq-row-"]').first();
      await expect(row).toBeVisible({ timeout: 60_000 });
      if (viewport.width <= 480) {
        await row.locator('[data-admin-actions-mobile-trigger]').click();
        await page.locator('[data-admin-actions-mobile-sheet]').last().getByLabel('Düzenle', { exact: true }).click();
      } else {
        await row.getByLabel('Düzenle', { exact: true }).click();
      }
      await expect(row.locator('[data-testid^="faq-editor-"]')).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await screenshotEvidence(page, `owner-g11-faq-inline-${viewport.name}`);
    });

    test('G12 blog source state machine has no legacy transitions', async ({ adminPage: page }) => {
      await page.goto(BLOG_EDIT, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await waitForSettledAdminPage(page);
      const machine = page.getByText('Durum Makinesi', { exact: true }).locator('..');
      await expect(machine).toBeVisible({ timeout: 60_000 });
      await machine.scrollIntoViewIfNeeded();
      await expect(machine.getByRole('button', { name: 'Arşivle', exact: true })).toBeVisible();
      await expect(machine.getByText(/Fikre Döndür|Araştırmaya Gönder|İncelemeye Gönder|Taslağa Döndür/)).toHaveCount(0);
      await assertNoHorizontalOverflow(page);
      await screenshotEvidence(page, `owner-g12-blog-state-machine-${viewport.name}`);
    });

    test('G13 blog share and draft actions are at the form bottom', async ({ adminPage: page }) => {
      await page.goto(BLOG_EDIT, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await waitForSettledAdminPage(page);
      const actions = page.locator('[data-testid="blog-bottom-actions"]');
      await expect(actions).toBeVisible({ timeout: 60_000 });
      await actions.scrollIntoViewIfNeeded();
      await expect(actions.getByRole('button', { name: 'Taslak Kaydet', exact: true })).toBeVisible();
      await expect(actions.getByRole('button', { name: 'İptal', exact: true })).toBeVisible();
      await expect(actions.getByRole('button', { name: 'Sil', exact: true })).toBeVisible();
      await expect(page.locator('[data-testid="blog-top-status"]').getByRole('button')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Kaydet', exact: true })).toHaveCount(0);
      await assertNoHorizontalOverflow(page);
      await screenshotEvidence(page, `owner-g13-blog-bottom-actions-${viewport.name}`);
    });
  });
}