import { expect, screenshotEvidence, test, waitForSettledAdminPage } from './fixtures';

const ownerLabel = 'Araç Tahsisi/Şoförlü Araç Kiralama';

test.use({ viewport: { width: 1440, height: 1000 } });

async function openServiceTypesTab(page: import('@playwright/test').Page) {
  const tab = page.getByRole('button', { name: 'Hizmet Türleri' });
  await expect(tab).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')]
      .find((element) => element.textContent?.trim() === 'Hizmet Türleri');
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error('Hizmet Türleri sekmesi bulunamadı.');
    }
    button.click();
  });
  await expect(page.getByRole('button', { name: 'Yeni Hizmet Türü Ekle' }))
    .toBeVisible({ timeout: 60_000 });
}

test('admin service type save is translated and immediately reaches the real booking form', async ({ adminPage: page }) => {
  test.setTimeout(300_000);
  await page.context().setExtraHTTPHeaders({
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  });
  await page.goto('/admin/rezervasyon-ayarlari', { waitUntil: 'domcontentloaded' });
  await waitForSettledAdminPage(page);
  await openServiceTypesTab(page);

  await expect(page.getByText(ownerLabel, { exact: true })).toBeVisible();
  await screenshotEvidence(page, 'service-types-after/desktop-list-with-create-button');

  const allocationCard = page.locator('div').filter({
    has: page.getByText(ownerLabel, { exact: true }),
  }).filter({
    has: page.getByRole('button', { name: 'Düzenle' }),
  }).last();
  await allocationCard.getByRole('button', { name: 'Düzenle' }).click();
  await expect(allocationCard.getByRole('button', { name: 'İptal' })).toHaveCount(1);
  await expect(allocationCard.getByRole('button', { name: 'Kapat' })).toHaveCount(0);
  await expect(allocationCard.getByText(/aktif dillere otomatik çevrilir/i)).toBeVisible();
  await screenshotEvidence(page, 'service-types-after/desktop-edit-single-cancel');

  const updateResponse = page.waitForResponse((response) =>
    response.request().method() === 'PATCH'
    && response.url().includes('/admin/api/service-types/')
    && response.status() === 200
  , { timeout: 180_000 });
  await allocationCard.getByRole('button', { name: 'Kaydet' }).click();
  const response = await updateResponse;
  const payload = await response.json() as {
    item: { label: string; translations: Record<string, { label?: string }> };
  };
  expect(payload.item.label).toBe(ownerLabel);
  const englishLabel = payload.item.translations.en?.label?.trim();
  expect(englishLabel).toBeTruthy();
  expect(englishLabel).not.toBe(ownerLabel);

  await page.goto('/hizmetler', { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Fiyat Al' }).click();
  const trAllocation = page.getByTestId('service-type-ALLOCATION');
  await trAllocation.scrollIntoViewIfNeeded();
  await expect(trAllocation).toContainText(ownerLabel);
  await screenshotEvidence(page, 'service-types-after/public-form-tr-hard-reload');

  await page.goto('/en', { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const enAllocation = page.getByTestId('service-type-ALLOCATION');
  await enAllocation.scrollIntoViewIfNeeded();
  await expect(enAllocation).toContainText(englishLabel!);
  await screenshotEvidence(page, 'service-types-after/public-form-en-translated');

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/admin/rezervasyon-ayarlari', { waitUntil: 'domcontentloaded' });
  await waitForSettledAdminPage(page);
  await openServiceTypesTab(page);
  await screenshotEvidence(page, 'service-types-after/tablet-list');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForSettledAdminPage(page);
  await openServiceTypesTab(page);
  await screenshotEvidence(page, 'service-types-after/mobile-list');
});