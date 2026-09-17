import { expect, test, type Page } from '@playwright/test';

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.skip(!adminEmail || !adminPassword, 'E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required');

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('E-Posta').fill(adminEmail!);
  await page.getByLabel('Şifre', { exact: true }).fill(adminPassword!);
  await page.getByRole('button', { name: 'Giriş Yap' }).click();
  await page.waitForURL(url => !url.pathname.startsWith('/admin/login'));
}

test('homepage hero AI image uses the real provider, persists, and reloads', async ({ page }) => {
  await login(page);
  await page.goto('/admin/sayfalar/ana-sayfa');
  await expect(page.getByText('A · Hero', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '✨ AI ile Üret' }).click();
  await page.getByPlaceholder('Görselde ne olacağını açıklayın…').fill(
    'A quiet Istanbul airport arrival lane with an unbranded black luxury transfer vehicle at dawn, no people',
  );
  await page.getByLabel('AI görsel alt metni').fill('İstanbul havalimanında lüks transfer aracı');
  await page.getByRole('button', { name: 'Üret ve ekle' }).click();
  await expect(page.getByRole('button', { name: 'Üret ve ekle' })).toBeHidden({ timeout: 90_000 });
  await expect(page.locator('img[alt="Önizleme"]')).toBeVisible();

  await page.getByRole('button', { name: 'Kaydet ve Tüm Dillerde Yayımla' }).click();
  await expect(page.getByText(/Türkçe kaydediliyor|Yayımlandı|Tamamlandı/i)).toBeVisible({ timeout: 120_000 });
  await page.reload();
  await expect(page.locator('img[alt="Önizleme"]')).toBeVisible();
});
