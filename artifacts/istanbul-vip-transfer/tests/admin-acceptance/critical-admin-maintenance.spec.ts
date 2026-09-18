import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { serviceTypes } from '../../db/schema';
import {
  assertNoHorizontalOverflow,
  expect,
  screenshotEvidence,
  test,
  waitForSettledAdminPage,
} from './fixtures';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

test('custom service deletion, audit history and GSC status stay usable responsively', async ({
  adminIdentity,
  adminPage: page,
}) => {
  test.setTimeout(180_000);
  const key = `PLAYWRIGHT_DELETE_${adminIdentity.id.slice(0, 8).toUpperCase()}`;
  await db.insert(serviceTypes).values({
    key,
    label: 'Playwright Silinebilir Hizmet',
    translations: {},
    displayOrder: 999,
    updatedBy: adminIdentity.id,
  });

  try {
    for (const [index, viewport] of VIEWPORTS.entries()) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/admin/rezervasyon-ayarlari', { waitUntil: 'domcontentloaded' });
      await waitForSettledAdminPage(page);
      await page.getByRole('button', { name: 'Hizmet Türleri' }).click();
      await expect(page.getByRole('button', { name: 'Yeni Hizmet Türü Ekle' })).toBeVisible();

      if (index === 0) {
        const keyBadge = page.getByText(key, { exact: true });
        await expect(keyBadge).toBeVisible({ timeout: 60_000 });
        const row = keyBadge.locator('xpath=../../..');
        page.once('dialog', (dialog) => dialog.accept());
        const deletion = page.waitForResponse((response) =>
          response.url().includes('/admin/api/service-types/')
          && response.request().method() === 'DELETE',
          { timeout: 60_000 },
        );
        await row.getByRole('button', { name: 'Sil', exact: true }).click();
        expect((await deletion).status()).toBe(200);
        await expect(page.getByText(key, { exact: true })).toHaveCount(0);
      } else {
        await expect(page.getByText(key, { exact: true })).toHaveCount(0);
      }

      const coreRow = page.getByText('AIRPORT_TRANSFER', { exact: true }).locator('xpath=../../..');
      await expect(coreRow.getByRole('button', { name: 'Sil', exact: true })).toBeDisabled();
      await assertNoHorizontalOverflow(page);
      await screenshotEvidence(page, `critical-admin/service-types-${viewport.name}`);

      await page.goto('/admin/gecmis', { waitUntil: 'domcontentloaded' });
      await waitForSettledAdminPage(page);
      await expect(page.getByRole('heading', { name: 'İşlem Geçmişi' })).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await screenshotEvidence(page, `critical-admin/audit-history-${viewport.name}`);

      await page.goto('/admin/ayarlar/icerik-entegrasyonlari', { waitUntil: 'domcontentloaded' });
      await waitForSettledAdminPage(page);
      await expect(page.getByRole('heading', { name: 'Google Search Console' })).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await screenshotEvidence(page, `critical-admin/gsc-integrations-${viewport.name}`);
    }
  } finally {
    await db.delete(serviceTypes).where(eq(serviceTypes.key, key));
  }
});