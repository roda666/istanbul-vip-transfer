import {
  assertNoHorizontalOverflow,
  assertTouchTargets,
  expect,
  screenshotEvidence,
  test,
  waitForSettledAdminPage,
} from './fixtures';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db';
import { auditLogs, content, contentTranslations, serviceCategories } from '../../db/schema';

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
  isolatedReorderFixture?: 'categories' | 'services';
};

type ReorderFixture = {
  items: Array<{ id: string; label: string }>;
  cleanup: () => Promise<void>;
};

async function createReorderFixture(
  kind: NonNullable<CatalogPage['isolatedReorderFixture']>,
  adminId: string,
): Promise<ReorderFixture> {
  const runId = crypto.randomUUID();
  if (kind === 'categories') {
    const [{ nextOrder }] = await db.select({
      nextOrder: sql<number>`coalesce(max(${serviceCategories.sortOrder}), 0) + 1`,
    }).from(serviceCategories);
    const rows = await db.insert(serviceCategories).values([
      {
        slug: `acceptance_category_a_${runId.replaceAll('-', '')}`,
        nameTranslations: { tr: `Acceptance kategori A ${runId}` },
        sortOrder: Number(nextOrder),
        isActive: true,
      },
      {
        slug: `acceptance_category_b_${runId.replaceAll('-', '')}`,
        nameTranslations: { tr: `Acceptance kategori B ${runId}` },
        sortOrder: Number(nextOrder) + 1,
        isActive: true,
      },
    ]).returning({ id: serviceCategories.id, names: serviceCategories.nameTranslations });
    const ids = rows.map(row => row.id);
    return {
      items: rows.map(row => ({
        id: String(row.id),
        label: String((row.names as Record<string, string>).tr),
      })),
      cleanup: async () => {
        await db.delete(auditLogs).where(and(
          eq(auditLogs.entityType, 'ServiceCategory'),
          inArray(auditLogs.entityId, ids.map(String)),
        )).catch(() => {});
        await db.delete(serviceCategories).where(inArray(serviceCategories.id, ids));
      },
    };
  }

  const [{ nextOrder }] = await db.select({
    nextOrder: sql<number>`coalesce(max(${content.displayOrder}), 0) + 1`,
  }).from(content);
  const ids = [crypto.randomUUID(), crypto.randomUUID()];
  const rows = await db.insert(content).values(ids.map((id, index) => ({
    id,
    title: `Acceptance hizmet ${index === 0 ? 'A' : 'B'} ${runId}`,
    slug: `acceptance-service-${index === 0 ? 'a' : 'b'}-${runId}`,
    contentType: 'SERVICE' as const,
    status: 'DRAFT' as const,
    body: '{}',
    displayOrder: Number(nextOrder) + index,
    createdBy: adminId,
    updatedBy: adminId,
  }))).returning({ id: content.id, title: content.title });
  return {
    items: rows.map(row => ({ id: row.id, label: row.title })),
    cleanup: async () => {
      await db.delete(contentTranslations).where(inArray(contentTranslations.entityId, ids)).catch(() => {});
      await db.delete(auditLogs).where(inArray(auditLogs.entityId, ids)).catch(() => {});
      await db.delete(content).where(inArray(content.id, ids));
    },
  };
}

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

async function reorderRoundTrip(
  page: import('@playwright/test').Page,
  config: CatalogPage,
  adminId: string,
) {
  const fixture = config.isolatedReorderFixture
    ? await createReorderFixture(config.isolatedReorderFixture, adminId)
    : null;
  const initial = fixture?.items ?? await orderedItems(page, config);
  if (!fixture) {
    const visibleCount = await config.visibleItemCount(page);
    test.skip(visibleCount < 2, `${config.name} has fewer than two visible reorderable items`);
  }
  const requestForCatalog = (response: import('@playwright/test').Response) =>
    response.request().method() === config.method &&
    new URL(response.url()).pathname.startsWith(config.actionPrefix);

  const moved = initial[1];
  const expectedAfterMove = [moved, initial[0], ...initial.slice(2)];
  let movedSuccessfully = false;
  try {
    if (fixture) {
      await page.reload();
      await waitForSettledAdminPage(page);
      const trigger = page.getByRole('button', { name: 'İşlemler', exact: true }).last();
      await expect(trigger).toBeVisible();
      await trigger.click();
      const fixtureDialog = page.getByRole('dialog', { name: 'İşlemler' });
      await expect(fixtureDialog).toBeVisible();
      for (const action of ['Yukarı', 'Aşağı', 'Düzenle', 'Sil']) {
        await expect(actionByAccessibleName(fixtureDialog, action)).toBeVisible();
      }
      await expect(actionByAccessibleName(
        fixtureDialog,
        config.isolatedReorderFixture === 'categories' ? 'Pasifleştir' : 'Arşivle',
      )).toBeVisible();
    }
    const scope = fixture ? page.getByRole('dialog', { name: 'İşlemler' }) : page;
    const up = fixture
      ? scope.getByRole('button', { name: 'Yukarı', exact: true })
      : config.upButtons(page).first();
    await expect(up).toBeVisible();
    await expect(up).toBeEnabled();
    const moveResponsePromise = page.waitForResponse(requestForCatalog);
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
    try {
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

      if (config.orderFromIds) {
        await expect.poll(() => config.orderFromIds!(page, initial.map(item => item.id))).toEqual(
          initial.map(item => item.id),
        );
      }
    } finally {
      await fixture?.cleanup();
    }
  }
}

function actionByAccessibleName(
  scope: import('@playwright/test').Locator,
  name: string | RegExp,
) {
  return scope.getByRole('button', { name, exact: typeof name === 'string' })
    .or(scope.getByRole('link', { name, exact: typeof name === 'string' }))
    .first();
}

async function assertStandardRecordActions(
  page: import('@playwright/test').Page,
  options: {
    statusAction: RegExp;
    deleteMode: 'visible' | 'visible-or-reason';
    firstRecord?: boolean;
  },
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

  const upAction = actionByAccessibleName(scope, 'Yukarı');
  await expect(upAction).toBeVisible();
  if (options.firstRecord) {
    await expect(upAction).toBeDisabled();
  }
  for (const action of ['Aşağı', 'Düzenle']) {
    await expect(actionByAccessibleName(scope, action)).toBeVisible();
  }
  await expect(actionByAccessibleName(scope, options.statusAction)).toBeVisible();

  const deleteAction = actionByAccessibleName(scope, 'Sil');
  if (options.deleteMode === 'visible') {
    await expect(deleteAction).toBeVisible();
  } else if (!await deleteAction.isVisible().catch(() => false)) {
    await expect(scope.getByText(/silmek için önce arşivleyin/i).first()).toBeVisible();
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
        await assertStandardRecordActions(page, {
          statusAction: /^(Aktifleştir|Pasifleştir|Arşivle|Arşivden Çıkar)$/,
          deleteMode: 'visible-or-reason',
        });
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
      await assertStandardRecordActions(page, {
        statusAction: /^(Aktifleştir|Pasifleştir|Arşivle|Arşivden Çıkar)$/,
        deleteMode: 'visible-or-reason',
      });
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
    isolatedReorderFixture: 'categories',
    visibleItemCount: async (page) => page.getByRole('button', { name: 'İşlemler', exact: true }).count(),
    upButtons: (page) => page.getByRole('button', { name: 'Yukarı', exact: true }).filter({ visible: true }),
    orderFromIds: async (page, ids) => {
      const response = await page.request.get('/admin/api/categories');
      expect(response.status()).toBe(200);
      const body = await response.json() as { categories: Array<{ id: number; sortOrder: number }> };
      return body.categories
        .filter(category => ids.includes(String(category.id)))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(category => String(category.id));
    },
    controls: async (page) => {
      await assertStandardRecordActions(page, {
        statusAction: /^(Aktifleştir|Pasifleştir)$/,
        deleteMode: 'visible',
        firstRecord: true,
      });
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
      await assertStandardRecordActions(page, {
        statusAction: /^(Aktifleştir|Pasifleştir|Arşivle|Arşivden Çıkar)$/,
        deleteMode: 'visible-or-reason',
      });
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
    isolatedReorderFixture: 'services',
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
      await expect(row).toBeVisible();
      await assertStandardRecordActions(page, {
        statusAction: /^(Arşivle|Arşivden Çıkar)$/,
        deleteMode: 'visible-or-reason',
        firstRecord: true,
      });
      await expect(row.getByText(/^(Yayında|Taslak|Arşiv)$/).first()).toBeVisible();
      const actionScope = (page.viewportSize()?.width ?? 1440) <= 480
        ? page.getByRole('dialog', { name: 'İşlemler' })
        : page.locator('main');
      await expect(actionByAccessibleName(actionScope, 'Kopyala')).toBeVisible();
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
      const actionLayout = viewport.width <= 480 ? 'actions-sheet' : 'direct-actions';
      await screenshotEvidence(adminPage, `${config.name}-${actionLayout}-${viewport.name}`);
    });
  }
}

for (const config of pages) {
  if (config.reorderAllowed === false) continue;
  test(`${config.name} adjacent reorder round trip`, async ({ adminPage, adminIdentity }) => {
    await adminPage.setViewportSize({ width: 390, height: 844 });
    const response = await adminPage.goto(config.url);
    expect(response?.status()).toBe(200);
    await waitForSettledAdminPage(adminPage);
    await expect(adminPage).not.toHaveURL(/\/admin\/login/);
    await config.controls(adminPage);
    await reorderRoundTrip(adminPage, config, adminIdentity.id);
  });
}