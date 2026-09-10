import { expect, test, type Page } from '@playwright/test';

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.skip(!adminEmail || !adminPassword, 'E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required');

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('E-Posta').fill(adminEmail!);
  await page.getByLabel('Şifre', { exact: true }).fill(adminPassword!);
  await page.getByRole('button', { name: 'Giriş Yap' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/admin/login'));
  await expect(page).toHaveURL(/\/admin(?:\/|$)/);
}

async function expectDropdownTollAlternatives(
  page: Page,
  origin: string,
  destination: string,
  expectedAlternatives: string[],
) {
  await page.getByTestId('quote-route').selectOption('');
  await page.getByTestId('quote-location-origin').selectOption({ label: origin });
  await page.getByTestId('quote-location-destination').selectOption({ label: destination });

  const panel = page.getByTestId('quote-toll-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Yol & Geçiş Alternatifi');

  const options = page.getByTestId('quote-toll-options');
  if (!await options.isVisible()) {
    await panel.locator('button[aria-expanded]').click();
  }
  await expect(options).toBeVisible();
  for (const alternative of expectedAlternatives) {
    await expect(options).toContainText(alternative);
  }
  await expect(page.getByTestId('quote-route')).toHaveValue('');
}

test.beforeEach(async ({ page }) => {
  await login(page);
  await page.goto('/admin/fiyat-kurallari');
  await expect(page.getByRole('heading', { name: 'Hızlı Teklif Simülatörü' })).toBeVisible();
});

test('dropdown selections reveal registered toll alternatives without a saved-route selection', async ({ page }) => {
  await expect(page.getByText('Haritadan nokta seç', { exact: false })).toHaveCount(0);
  await expect(page.getByText('Kalkış Adresi / Otel', { exact: false })).toHaveCount(0);

  await expectDropdownTollAlternatives(
    page,
    'Sabiha Gökçen Havalimanı (SAW)',
    'Taksim Meydanı',
    ['FSM Köprüsü üzerinden', 'Avrasya Tüneli üzerinden', '15 Temmuz Şehitler Köprüsü üzerinden'],
  );

  await expectDropdownTollAlternatives(
    page,
    'İstanbul Havalimanı (IST)',
    'Kadıköy',
    [
      'FSM Köprüsü üzerinden',
      'Avrasya Tüneli üzerinden',
      '15 Temmuz Şehitler Köprüsü üzerinden',
      'YSS Köprüsü + Kuzey Marmara Otoyolu üzerinden',
    ],
  );
});