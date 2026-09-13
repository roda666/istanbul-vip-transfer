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
  orderFromIds?: (page: import('@playwright/test').Page, ids: string[]) => Promise<string[]>;
  reorderAllowed?: boolean;
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

  const moved = initial[1];
  const expectedAfterMove = [moved, initial[0], ...initial.slice(2)];
  const moveResponsePromise = page.waitForResponse(requestForCatalog);
  const up = config.upButtons(page).first();
  let movedSuccessfully = false;
  try {
    await up.click();
    const moveResponse = await moveResponsePromise;
    expect(moveResponse.status()).toBe(200);
    movedSuccessfully = true;
    if (config.orderFromIds) {
      await expect.poll(() => config.orderFromIds!(page, initial.map(item => item.id))).toEqual(
        expectedAfterMove.map(item => item.id),
      );
    }
  } finally {
    if (movedSuccessfully) {
      const pageUrl = new URL(page.url());
      const cleanupResponse = await page.request.fetch(
        new URL(config.actionPath(moved.id), pageUrl).toString(),
        {
          method: config.method,
          data: config.actionBody('down'),
          headers: {
            origin: pageUrl.origin,
            referer: pageUrl.toString(),
          },
        },
      );
      const cleanupStatus = cleanupResponse.status();
      expect(cleanupStatus, 'reorder cleanup').toBe(200);
    }
  }

  if (config.orderFromIds) {
    await expect.poll(() => config.orderFromIds!(page, initial.map(item => item.id))).toEqual(
      initial.map(item => item.id),
    );
  }
}

async function assertStandardRecordActions(
  page: import('@playwright/test').Page,
  options: { nonArchivedDeleteReason?: boolean } = {},
) {
  const isMobile = (page.viewportSize()?.width ?? 1440) <= 480;
  let scope = page.locator('main');
  if (isMobile) {
    const trigger = page.getByRole('button', { name: 'İşlemler' }).first();
    await expect(trigger).toBeVisible();
    await trigger.click();
    scope = page.getByRole('dialog', { name: 'İşlemler' });
    await expect(scope).toBeVisible();
  }

  await expect(scope.getByText('Yukarı', { exact: true }).first()).toBeVisible();
  await expect(scope.getByText('Aşağı', { exact: true }).first()).toBeVisible();
  await expect(scope.getByText('Düzenle', { exact: true }).first()).toBeVisible();
  await expect(scope.getByText(/^(Aktifleştir|Pasifleştir)$/).first()).toBeVisible();
  await expect(scope.getByText(/^(Arşivle|Arşivden Çıkar)$/).first()).toBeVisible();
  await expect(scope.getByText('Sil', { exact: true }).first()).toBeVisible();

  if (isMobile && options.nonArchivedDeleteReason) {
    await expect(scope.getByText('Kalıcı silme için önce arşivleyin.', { exact: true }).first())
      .toBeVisible();
  }
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
      const isMobile = (page.viewportSize()?.width ?? 1440) <= 480;
      const actionEntry = isMobile
        ? page.getByRole('button', { name: 'İşlemler' }).first()
        : page.getByText('Düzenle', { exact: true }).first();
      const empty = page.getByText(/Henüz ek hizmet tanımlanmadı|Arşivlenmiş hizmet yok/).first();
      await Promise.race([
        actionEntry.waitFor({ state: 'visible', timeout: 15_000 }),
        empty.waitFor({ state: 'visible', timeout: 15_000 }),
      ]);
      if (await actionEntry.isVisible()) {
        await assertStandardRecordActions(page, { nonArchivedDeleteReason: true });
      }
    },
  },
  {
    name: 'locations',
    url: '/admin/rezervasyon-ayarlari',
    api: '/admin/api/locations?limit=300',
    collection: 'items',
    label: (item) => String(item.name),
    method: 'PATCH',
    actionPrefix: '/admin/api/locations/',
    actionPath: (id) => `/admin/api/locations/${id}`,
    idFromResponse: (path) => path.split('/').at(-1)!,
    actionBody: (direction) => ({ action: direction }),
    reorderAllowed: false,
    visibleItemCount: async (page) => page.locator('.desktop-loc-table tbody tr:visible').count(),
    upButtons: (page) => page.locator('button[aria-label="Yukarı taşı"]:visible:not([disabled])'),
    controls: async (page) => {
      await expect(page.getByText(/^\d+ lokasyon/).first()).toBeVisible({ timeout: 20_000 });
      await assertStandardRecordActions(page, { nonArchivedDeleteReason: true });
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
      if (!await page.getByText('Düzenle', { exact: true }).count()) return;
      await assertStandardRecordActions(page);
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
    snapshot: async (page) => page.getByTestId('service-row').filter({ visible: true })
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
    visibleItemCount: async (page) => page.getByTestId('service-row').filter({ visible: true }).filter({ has: page.locator('button[aria-label="Yukarı"]') }).count(),
    upButtons: (page) => page.locator('[data-testid="service-move-up"]:visible:not([disabled])'),
    orderFromIds: async (page, ids) => {
      const records = await Promise.all(ids.map(async (id) => {
        const response = await page.request.get(`/admin/api/service-pages/${id}`);
        expect(response.status()).toBe(200);
        const body = await response.json() as { record?: { id: string; displayOrder: number } };
        expect(body.record).toBeTruthy();
        return body.record!;
      }));
      return records.sort((a, b) => a.displayOrder - b.displayOrder).map(record => record.id);
    },
    controls: async (page) => {
      const row = page.getByTestId('service-row').filter({ visible: true }).first();
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
  { name: 'compact-mobile', width: 320, height: 700 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
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
  if (config.reorderAllowed === false) continue;
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