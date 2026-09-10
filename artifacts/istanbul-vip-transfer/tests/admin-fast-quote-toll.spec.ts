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
  await page.getByTestId('quote-vehicle').selectOption({ label: 'Mercedes Vito' });

  await expectDropdownTollAlternatives(
    page,
    'Beyoğlu',
    'Beykoz',
    [
      'Fatih Sultan Mehmet Köprüsü (FSM) üzerinden',
      '15 Temmuz Şehitler Köprüsü üzerinden',
      'Avrasya Tüneli üzerinden',
      'Yavuz Sultan Selim Köprüsü (YSS) üzerinden',
    ],
  );
  await page.getByRole('button', { name: 'Hesapla', exact: true }).click();
  const eur = page.getByTestId('customer-price-eur');
  const usd = page.getByTestId('customer-price-usd');
  const tryAmount = page.getByTestId('customer-price-try');
  await expect(eur).toBeVisible();
  await expect(usd).toBeVisible();
  await expect(tryAmount).toBeVisible();
  const [eurSize, usdSize, trySize] = await Promise.all([
    eur.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
    usd.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
    tryAmount.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
  ]);
  expect(eurSize).toBe(usdSize);
  expect(eurSize).toBeGreaterThan(trySize);

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

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
]) {
  test(`${viewport.name} layout has no page overflow and keeps primary controls touch-sized`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Hızlı Teklif Simülatörü' })).toBeVisible();

    const hasNoPageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(hasNoPageOverflow).toBe(true);

    for (const locator of [
      page.getByRole('button', { name: 'Formül ve Kur Motoru' }),
      page.getByTestId('quote-vehicle'),
      page.getByTestId('quote-route'),
      page.getByTestId('quote-location-origin'),
      page.getByTestId('quote-location-destination'),
      page.getByRole('button', { name: 'Hesapla', exact: true }),
    ]) {
      const box = await locator.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
}