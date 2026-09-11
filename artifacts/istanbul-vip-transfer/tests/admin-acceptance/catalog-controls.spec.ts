import {
  assertNoHorizontalOverflow,
  assertTouchTargets,
  expect,
  screenshotEvidence,
  test,
  waitForSettledAdminPage,
} from './fixtures';

type CatalogPage = {
  name: string;
  url: string;
  api?: string;
  collection: string;
  label: (item: Record<string, unknown>) => string;
  snapshot?: (page: import('@playwright/test').Page) => Promise<Array<{ id: string; label: string }>>;
  visibleItemCount: (page: import('@playwright/test').Page) => Promise<number>;
  upButtons: (page: import('@playwright/test').Page) => import('@playwright/test').Locator;
  controls: (page: import('@playwright/test').Page) => Promise<void>;
  method: 'POST' | 'PATCH';
  actionPrefix: string;
  actionPath: (id: string) => string;
  idFromResponse: (path: string) => string;
  actionBody: (direction: 'up' | 'down') => Record<string, string>;
};

async function orderedItems(page: import('@playwright/test').Page, config: CatalogPage) {
  if (config.snapshot) return config.snapshot(page);
  const response = await page.request.get(config.api!, { timeout: 45_000 });
  expect(response.status(), `${config.name} catalog API`).toBe(200);
  const body = await response.json() as Record<string, unknown>;
  const items = body[config.collection];
  expect(Array.isArray(items), `${config.name} catalog payload`).toBe(true);
  return (items as Record<string, unknown>[]).map((item) => ({
    id: String(item.id),
    label: config.label(item),
  }));
}

async function reorderRoundTrip(page: import('@playwright/test').Page, config: CatalogPage) {
  const initial = await orderedItems(page, config);
  const visibleCount = await config.visibleItemCount(page);
  test.skip(visibleCount < 2, `${config.name} has fewer than two visible reorderable items`);
  const requestForCatalog = (response: import('@playwright/test').Response) =>
    response.request().method() === config.method &&
    new URL(response.url()).pathname.startsWith(config.actionPrefix);

  const moveResponsePromise = page.waitForResponse(requestForCatalog);
  const up = config.upButtons(page).filter({ hasNot: page.locator('[disabled]') }).first();
  await up.evaluate((button: HTMLElement) => button.click());
  const moveResponse = await moveResponsePromise;
  expect(moveResponse.status()).toBe(200);
  try {
  } finally {
    const cleanupStatus = await page.evaluate(async ({ url, method, body }) => {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return response.status;
    }, {
      url: moveResponse.url(),
      method: config.method,
      body: config.actionBody('down'),
    });
    expect(cleanupStatus, 'reorder cleanup').toBe(200);
  }

  if (config.snapshot) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForSettledAdminPage(page);
  }
  await expect.poll(async () => orderedItems(page, config)).toEqual(initial);
}

const pages: CatalogPage[] = [
  {
    name: 'optional services',
    url: '/admin/fiyat-kurallari?tab=ek-hizmetler',
    api: '/admin/api/ek-hizmetler',
    collection: 'services',
    label: (item) => String(item.name),
    method: 'POST',
    actionPrefix: '/admin/api/ek-hizmetler/',
    actionPath: (id) => `/admin/api/ek-hizmetler/${id}/reorder`,
    idFromResponse: (path) => path.split('/').at(-2)!,
    actionBody: (direction) => ({ direction }),
    visibleItemCount: async (page) => (await page.locator('button[aria-label="Yukarı taşı"]:visible:not([disabled])').count()) + 1,
    upButtons: (page) => page.locator('button[aria-label="Yukarı taşı"]:visible:not([disabled])'),
    controls: async (page) => {
      const edit = page.getByRole('button', { name: 'Düzenle' }).first();
      const empty = page.getByText(/Henüz ek hizmet tanımlanmadı|Arşivlenmiş hizmet yok/).first();
      await Promise.race([
        edit.waitFor({ state: 'visible', timeout: 15_000 }),
        empty.waitFor({ state: 'visible', timeout: 15_000 }),
      ]);
      if (await edit.isVisible()) {
      await expect(page.getByRole('button', { name: 'Düzenle' }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /Aktif|Pasif/ }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /Arşivle|Sil/ }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Yukarı taşı' }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Aşağı taşı' }).first()).toBeVisible();
      }
    },
  },
  {
    name: 'categories',
    url: '/admin/kategoriler',
    api: '/admin/api/categories',
    collection: 'categories',
    label: (item) => String((item.nameTranslations as Record<string, unknown>)?.tr ?? item.slug),
    method: 'PATCH',
    actionPrefix: '/admin/api/categories/',
    actionPath: (id) => `/admin/api/categories/${id}`,
    idFromResponse: (path) => path.split('/').at(-1)!,
    actionBody: (direction) => ({ action: direction }),
    visibleItemCount: async (page) => (await page.locator('button[title="Yukarı taşı"]:visible:not([disabled])').count()) + 1,
    upButtons: (page) => page.locator('button[title="Yukarı taşı"]:visible:not([disabled])'),
    controls: async (page) => {
      if (!await page.locator('button[title="Düzenle"]:visible').count()) return;
      await expect(page.locator('button[title="Düzenle"]').first()).toBeVisible();
      await expect(page.locator('button[title*="devre dışı"], button[title*="etkinleştir"]').first()).toBeVisible();
      await expect(page.locator('button[title*="Sil"]').first()).toBeVisible();
      await expect(page.locator('button[title="Yukarı taşı"]').first()).toBeVisible();
      await expect(page.locator('button[title="Aşağı taşı"]').first()).toBeVisible();
      await expect(page.locator('input[placeholder*="Türkçe kategori"]').first()).toBeVisible();
    },
  },
  {
    name: 'vehicles',
    url: '/admin/araclar',
    api: '/admin/api/vehicles',
    collection: 'items',
    label: (item) => String(item.name),
    method: 'PATCH',
    actionPrefix: '/admin/api/vehicles/',
    actionPath: (id) => `/admin/api/vehicles/${id}`,
    idFromResponse: (path) => path.split('/').at(-1)!,
    actionBody: (direction) => ({ action: direction }),
    visibleItemCount: async (page) => page.locator('tr:visible').filter({ has: page.locator('a[href*="/admin/araclar/"][href$="/duzenle"]') }).count(),
    upButtons: (page) => page.locator('button[aria-label="Yukarı taşı"]:visible:not([disabled])'),
    controls: async (page) => {
      if (!await page.getByRole('link', { name: 'Düzenle' }).count()) return;
      await expect(page.getByRole('link', { name: 'Düzenle' }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /Aktif|Pasif/ }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Arşivle' }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sil' }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Yukarı taşı' }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Aşağı taşı' }).first()).toBeVisible();
    },
  },
  {
    name: 'services',
    url: '/admin/hizmetler',
    api: '/admin/api/service-pages',
    collection: 'items',
    label: (item) => String(item.title),
    method: 'POST',
    actionPrefix: '/admin/api/service-pages/',
    actionPath: (id) => `/admin/api/service-pages/${id}`,
    idFromResponse: (path) => path.split('/').at(-1)!,
    actionBody: (direction) => ({ action: direction }),
    snapshot: async (page) => page.locator('.hl-card:visible, .hl-table-row:visible')
      .filter({ has: page.locator('a[href*="/admin/hizmetler/"]') })
      .evaluateAll((rows) => rows.map((row) => {
        const link = row.querySelector<HTMLAnchorElement>('a[href*="/admin/hizmetler/"]');
        return {
          id: link?.href.split('/').at(-1) ?? '',
          label: row.querySelector('.hl-card-title')?.textContent?.trim()
            ?? row.querySelector('p')?.textContent?.trim()
            ?? '',
        };
      })),
    visibleItemCount: async (page) => page.locator('.hl-card:visible, .hl-table-row:visible').filter({ has: page.locator('button[aria-label="Yukarı"]') }).count(),
    upButtons: (page) => page.locator('button[aria-label="Yukarı"]:visible:not([disabled])'),
    controls: async (page) => {
      const row = page.locator('.hl-card:visible, .hl-table-row:visible').first();
      if (!await row.count()) return;
      await expect(row.getByRole('link', { name: 'Düzenle' })).toBeVisible();
      await expect(row.getByText(/^(Yayında|Taslak|Arşiv)$/).first()).toBeVisible();
      const archive = row.getByRole('button', { name: 'Arşivle' });
      if (await archive.count()) await expect(archive).toBeVisible();
      else await expect(row.getByRole('button', { name: 'Kopyala' })).toBeVisible();
      await expect(row.getByRole('button', { name: 'Yukarı' })).toBeVisible();
      await expect(row.getByRole('button', { name: 'Aşağı' })).toBeVisible();
    },
  },
];

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
]) {
  for (const config of pages) {
    test(`${config.name} controls and layout at ${viewport.name}`, async ({ adminPage }) => {
      await adminPage.setViewportSize({ width: viewport.width, height: viewport.height });
      const response = await adminPage.goto(config.url);
      expect(response?.status()).toBe(200);
      await waitForSettledAdminPage(adminPage);
      await expect(adminPage).not.toHaveURL(/\/admin\/login/);
      await config.controls(adminPage);
      await assertNoHorizontalOverflow(adminPage);
      await assertTouchTargets(adminPage);
      await screenshotEvidence(adminPage, `${config.name}-${viewport.name}`);
    });
  }
}

for (const config of pages) {
  test(`${config.name} adjacent reorder round trip`, async ({ adminPage }) => {
    await adminPage.setViewportSize({ width: 390, height: 844 });
    const response = await adminPage.goto(config.url);
    expect(response?.status()).toBe(200);
    await waitForSettledAdminPage(adminPage);
    await expect(adminPage).not.toHaveURL(/\/admin\/login/);
    await config.controls(adminPage);
    await reorderRoundTrip(adminPage, config);
  });
}