import { createHash } from 'node:crypto';
import type { Page, Route as PlaywrightRoute } from '@playwright/test';
import { db } from '../../db';
import { transferRoutes } from '../../db/schema';
import {
  assertNoHorizontalOverflow,
  expect,
  test,
  waitForSettledAdminPage,
} from './fixtures';

type RouteFixture = {
  id: string;
  name: string;
  slug: string;
  origin: string;
  destination: string;
  distanceKm: number;
  durationMinutes: number;
  priceVitoMinEur: number;
  priceVitoMaxEur: number;
  priceSprinterMinEur: number;
  priceSprinterMaxEur: number;
  imagePath: string;
  displayOrder: number;
  active: boolean;
  updatedAt: string;
  translations: [];
};

const stableRouteHash = (rows: unknown[]): string => createHash('sha256')
  .update(JSON.stringify(rows, (_key, value) => value instanceof Date ? value.toISOString() : value))
  .digest('hex');

const immutableRouteFields = (route: RouteFixture) => {
  const { displayOrder, updatedAt, ...immutable } = route;
  void displayOrder;
  void updatedAt;
  return immutable;
};

const fixtureRoute = (key: 'a' | 'b' | 'c', displayOrder: number): RouteFixture => ({
  id: `00000000-0000-4000-8000-00000000000${displayOrder + 1}`,
  name: `QA Sıralama Rotası ${key.toUpperCase()}`,
  slug: `qa-siralama-${key}`,
  origin: `Kalkış ${key.toUpperCase()}`,
  destination: `Varış ${key.toUpperCase()}`,
  distanceKm: 30 + displayOrder,
  durationMinutes: 60 + displayOrder,
  priceVitoMinEur: 80 + displayOrder,
  priceVitoMaxEur: 100 + displayOrder,
  priceSprinterMinEur: 120 + displayOrder,
  priceSprinterMaxEur: 150 + displayOrder,
  imagePath: `/qa/transfer-route-${key}.webp`,
  displayOrder,
  active: true,
  updatedAt: '2026-01-01T00:00:00.000Z',
  translations: [],
});

async function clickRouteAction(page: Page, routeId: string, label: 'Yukarı' | 'Aşağı') {
  const row = page.getByTestId(`transfer-route-row-${routeId}`);
  if ((page.viewportSize()?.width ?? 1280) <= 480) {
    await row.getByRole('button', { name: 'İşlemler' }).click();
    return page.getByRole('dialog').getByRole('button', { name: label });
  }
  return row.getByRole('button', { name: label });
}

test.describe('@transfer-route-reorder admin route ordering', () => {
  test.describe.configure({ retries: 0 });

  test('partial PATCH responses never replace complete route rows', async ({ adminPage }) => {
    test.setTimeout(120_000);

    const realRoutesBefore = await db.select().from(transferRoutes);
    const realRoutesHashBefore = stableRouteHash(realRoutesBefore);
    const fixtures = [
      fixtureRoute('a', 0),
      fixtureRoute('b', 1),
      fixtureRoute('c', 2),
    ];
    const immutableFields = fixtures.map(immutableRouteFields);
    let listRequests = 0;
    let patchRequests = 0;
    let failNextPatch = false;

    await adminPage.route('**/qa/transfer-route-*.webp', async (route: PlaywrightRoute) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/webp',
        body: Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==', 'base64'),
      });
    });
    await adminPage.route('**/admin/api/locations?active=true', (route) => route.fulfill({ json: { items: [] } }));
    await adminPage.route('**/admin/api/vehicles?limit=100', (route) => route.fulfill({ json: { items: [] } }));
    await adminPage.route('**/admin/api/transfer-routes', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      listRequests += 1;
      await route.fulfill({ json: { routes: fixtures, serviceOptions: [] } });
    });
    await adminPage.route('**/admin/api/transfer-routes/*', async (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      patchRequests += 1;
      if (failNextPatch) {
        failNextPatch = false;
        await route.fulfill({ status: 500, json: { error: 'Sıralama geçici olarak tamamlanamadı.' } });
        return;
      }

      const routeId = route.request().url().split('/').pop();
      const body = route.request().postDataJSON() as { action: 'up' | 'down' };
      const index = fixtures.findIndex((item) => item.id === routeId);
      const peerIndex = body.action === 'up' ? index - 1 : index + 1;
      const [moved] = fixtures.splice(index, 1);
      fixtures.splice(peerIndex, 0, moved);
      fixtures.forEach((item, position) => {
        item.displayOrder = position;
        item.updatedAt = '2026-01-02T00:00:00.000Z';
      });

      await new Promise((resolve) => setTimeout(resolve, 150));
      await route.fulfill({
        json: {
          routes: fixtures.map(({ id, displayOrder, active }) => ({ id, displayOrder, active })),
          route: { id: moved.id, displayOrder: moved.displayOrder, active: moved.active },
        },
      });
    });

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      fixtures.splice(0, fixtures.length, fixtureRoute('a', 0), fixtureRoute('b', 1), fixtureRoute('c', 2));
      const initialListRequests = listRequests;
      const initialPatchRequests = patchRequests;
      await adminPage.setViewportSize(viewport);
      await adminPage.goto('/admin/transfer-rotalari', { waitUntil: 'domcontentloaded' });
      await waitForSettledAdminPage(adminPage);
      await expect.poll(() => listRequests).toBe(initialListRequests + 1);

      const middleId = fixtures[1].id;
      const upButton = await clickRouteAction(adminPage, middleId, 'Yukarı');
      await upButton.evaluate((button) => {
        (button as HTMLButtonElement).click();
        (button as HTMLButtonElement).click();
      });
      await expect.poll(() => patchRequests).toBe(initialPatchRequests + 1);
      await expect.poll(() => listRequests).toBe(initialListRequests + 2);
      await expect(adminPage.locator('tbody tr').nth(0)).toContainText('QA Sıralama Rotası B');

      const downButton = await clickRouteAction(adminPage, middleId, 'Aşağı');
      await downButton.evaluate((button) => {
        (button as HTMLButtonElement).click();
        (button as HTMLButtonElement).click();
      });
      await expect.poll(() => patchRequests).toBe(initialPatchRequests + 2);
      await expect.poll(() => listRequests).toBe(initialListRequests + 3);
      await expect(adminPage.locator('tbody tr').nth(1)).toContainText('QA Sıralama Rotası B');

      for (const route of fixtures) {
        const row = adminPage.getByTestId(`transfer-route-row-${route.id}`);
        await expect(row).toContainText(route.name);
        await expect(row).toContainText(`${route.origin} → ${route.destination}`);
        await expect(row).toContainText(`${route.distanceKm} km`);
        await expect(row).toContainText(`${route.priceVitoMinEur}–${route.priceVitoMaxEur}`);
        await expect(row).toContainText(`${route.priceSprinterMinEur}–${route.priceSprinterMaxEur}`);
        await expect(row.locator('img')).toHaveAttribute('src', route.imagePath);
        await expect(row).not.toContainText('NaN sa');
      }
      await expect(adminPage.locator('tbody')).not.toContainText(/^\s*→\s*$/);
      await assertNoHorizontalOverflow(adminPage);

      await adminPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForSettledAdminPage(adminPage);
      await expect(adminPage.locator('tbody tr').nth(1)).toContainText('QA Sıralama Rotası B');
    }

    failNextPatch = true;
    const completeRowsBeforeFailure = await adminPage.locator('tbody tr').allTextContents();
    const failedButton = await clickRouteAction(adminPage, fixtures[1].id, 'Yukarı');
    await failedButton.click();
    await expect(adminPage.getByText('Sıralama geçici olarak tamamlanamadı.')).toBeVisible();
    expect(await adminPage.locator('tbody tr').allTextContents()).toEqual(completeRowsBeforeFailure);

    const finalImmutableFields = fixtures.map(immutableRouteFields);
    expect(finalImmutableFields).toEqual(immutableFields);
    expect(fixtures.map((route) => route.id)).toEqual([
      fixtureRoute('a', 0).id,
      fixtureRoute('b', 1).id,
      fixtureRoute('c', 2).id,
    ]);

    const realRoutesAfter = await db.select().from(transferRoutes);
    expect(stableRouteHash(realRoutesAfter)).toBe(realRoutesHashBefore);
    expect(realRoutesAfter).toHaveLength(realRoutesBefore.length);
  });
});