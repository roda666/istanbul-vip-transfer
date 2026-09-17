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

async function generateAndAttach(
  page: Page,
  target: 'PAGE' | 'VEHICLE',
  id: string,
  imageField: 'hero_image' | 'og_image',
) {
  const generated = await page.request.post('/admin/api/studio/images', {
    data: {
      action: 'generate',
      target,
      id,
      imageField,
      prompt: `Editorial ${target.toLowerCase()} image with an unbranded luxury transfer vehicle at dawn, no people`,
      altText: `${target} güvenli AI görseli`,
    },
  });
  expect(generated.ok()).toBeTruthy();
  const generatedJson = await generated.json() as { image?: { imagePath?: string } };
  const imagePath = generatedJson.image?.imagePath;
  expect(imagePath).toMatch(/\/api\/storage\/objects\/ai-images\//);
  const attached = await page.request.post('/admin/api/studio/images', {
    data: {
      action: 'attach',
      target,
      id,
      imagePath,
      imageField,
      placement: imageField === 'og_image' ? 'og' : 'hero',
      altText: `${target} güvenli AI görseli`,
    },
  });
  expect(attached.ok()).toBeTruthy();
  return imagePath!;
}

test('PAGE hero and VEHICLE OG contracts use real provider and restore originals', async ({ page }) => {
  await login(page);
  for (const [target, field] of [['PAGE', 'hero_image'], ['VEHICLE', 'og_image']] as const) {
    const listing = await page.request.get(`/admin/api/studio/images?target=${target}`);
    expect(listing.ok()).toBeTruthy();
    const payload = await listing.json() as { targets?: Array<Record<string, string | null>> };
    const record = payload.targets?.[0];
    expect(record?.id).toBeTruthy();
    const id = String(record!.id);
    const oldValue = field === 'hero_image' ? record!.heroImage : record!.ogImage;
    try {
      const path = await generateAndAttach(page, target, id, field);
      const refreshed = await page.request.get(`/admin/api/studio/images?target=${target}`);
      const after = (await refreshed.json() as { targets: Array<Record<string, string | null>> }).targets.find(item => item.id === id);
      expect(field === 'hero_image' ? after?.heroImage : after?.ogImage).toBe(path);
    } finally {
      const restore = target === 'PAGE'
        ? page.request.put(`/admin/api/content/${id}`, { data: { heroImage: oldValue } })
        : page.request.put(`/admin/api/vehicles/${id}`, { data: { ogImage: oldValue } });
      expect((await restore).ok()).toBeTruthy();
    }
  }
});
