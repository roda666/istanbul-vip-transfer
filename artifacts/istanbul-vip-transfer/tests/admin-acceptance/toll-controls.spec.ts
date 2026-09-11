import {
  assertNoHorizontalOverflow,
  assertTouchTargets,
  expect,
  screenshotEvidence,
  test,
  waitForSettledAdminPage,
} from './fixtures';

const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
] as const;

const pointStates = [
  { name: 'Ankara', active: true },
  { name: 'Antalya', active: false },
  { name: 'Bodrum', active: true },
] as const;

type TollPoint = {
  id: string;
  name: string;
  displayOrder: number;
  active?: boolean;
  verificationLocked?: boolean;
  verification_locked?: boolean;
};
type TollPayload = { points: TollPoint[] };

const customerLeakPattern = /toll|tariff|toll[_-]?point|verification[_-]?lock|source[_-]?verified|geçiş[\s_-]?ücret|gecis[\s_-]?ucret/i;

async function tollPoints(page: import('@playwright/test').Page) {
  const response = await page.request.get('/admin/api/pricing/tolls');
  expect(response.status(), 'Toll management API must be available').toBe(200);
  return (await response.json()) as TollPayload;
}

function findCustomerLeaks(value: unknown, path: string[] = []): string[] {
  if (value == null) return [];
  if (typeof value === 'string') {
    return customerLeakPattern.test(value) ? [`${path.join('.')}: ${value}`] : [];
  }
  if (Array.isArray(value)) return value.flatMap((item, index) => findCustomerLeaks(item, [...path, `[${index}]`]));
  if (typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => [
      ...(customerLeakPattern.test(key) ? [`${[...path, key].join('.')}: <internal key>`] : []),
      ...findCustomerLeaks(item, [...path, key]),
    ]);
  }
  return [];
}

function sequence(points: TollPoint[]) {
  return points.map(({ id, name, displayOrder }) => ({ id, name, displayOrder }));
}

function businessFields(points: TollPoint[]) {
  return points.map((point) => {
    const {
      displayOrder: _displayOrder,
      updatedAt: _updatedAt,
      updatedBy: _updatedBy,
      updatedByName: _updatedByName,
      ...business
    } = point as TollPoint & {
      updatedAt?: string;
      updatedBy?: string | null;
      updatedByName?: string | null;
    };
    return business;
  });
}

async function assertPointCardsDoNotOverlap(page: import('@playwright/test').Page) {
  const cards = page.locator('button[aria-label$=" yukarı taşı"]').locator('xpath=../..');
  const boxes = await cards.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    }),
  );
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const overlaps = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      expect(overlaps, `Toll point cards ${i} and ${j} overlap`).toBe(false);
    }
  }
}

async function assertPointControlsAreEnabledAndSized(page: import('@playwright/test').Page) {
  const controls = page.locator(
    'button[aria-label*="yukarı taşı"], button[aria-label*="aşağı taşı"], ' +
      'button[aria-label*="tarife"], button:has-text("Yeni Geçiş Noktası"), ' +
      'button:has-text("Değişiklikleri Kaydet"), button:has-text("Kaydet")',
  );
  const failures = await controls.evaluateAll((elements) =>
    elements.flatMap((element) => {
      const box = element.getBoundingClientRect();
      const button = element as HTMLButtonElement;
      return box.width < 44 || box.height < 44
        ? [{ name: element.getAttribute('aria-label') || element.textContent?.trim(), width: box.width, height: box.height }]
        : [];
    }),
  );
  expect(failures, 'Point, reorder, save, and tariff controls must be enabled and at least 44px').toEqual([]);
}

for (const viewport of viewports) {
  test(`toll controls remain usable and settled at ${viewport.name} size`, async ({ adminPage }) => {
    await adminPage.setViewportSize({ width: viewport.width, height: viewport.height });
    const response = await adminPage.goto('/admin/yol-gecis-ucretleri');
    expect(response?.status()).toBe(200);
    await waitForSettledAdminPage(adminPage);
    await expect(adminPage).not.toHaveURL(/\/admin\/login/);

    await expect(adminPage.getByRole('heading', { name: 'Yol & Geçiş Ücretleri', exact: true })).toBeVisible();
    await expect(adminPage.getByText(/Eksik araç sınıfı tarifesi olan geçişler/i)).toBeVisible();
    await assertNoHorizontalOverflow(adminPage);
    await assertPointCardsDoNotOverlap(adminPage);
    await assertPointControlsAreEnabledAndSized(adminPage);
    await assertTouchTargets(adminPage, 44);

    const apiPoints = await tollPoints(adminPage);
    for (const { name: pointName, active } of pointStates) {
      const apiPoint = apiPoints.points.find(({ name }) => name.toLocaleLowerCase('tr-TR').includes(pointName.toLocaleLowerCase('tr-TR')));
      expect(apiPoint, `${pointName} must be present in the admin API`).toBeDefined();
      expect(apiPoint?.active, `${pointName} active state must be preserved`).toBe(active);
      expect(apiPoint?.verificationLocked ?? apiPoint?.verification_locked, `${pointName} must not be verification locked`).not.toBe(true);
      const pointButton = adminPage.getByRole('button', { name: new RegExp(pointName, 'i') }).first();
      await expect(pointButton, `${pointName} toll point should be visible`).toBeVisible();
      const card = pointButton.locator('xpath=..');
      await expect(card.getByRole('button')).not.toHaveCount(0);
      await expect(card.locator('button:disabled')).toHaveCount(0);
      await expect(card).not.toContainText(/doğrulama gerekli|kilitli|kilitlendi/i);
    }
    await expect(adminPage.locator('main')).not.toContainText(
      /doğrulama gerekli|verification required|verification[_ -]?lock|kilitli|disabled/i,
    );
    await screenshotEvidence(adminPage, `toll-controls-${viewport.name}`);
  });
}

test('customer quote, reservation, public APIs, and UI never expose toll internals', async ({ adminPage }) => {
  const publicEndpoints = [
    '/data/vehicles?lang=tr',
    '/data/transfer-routes',
    '/data/service-types',
    '/data/locations?for=pickup&scope=local&q=ist',
    '/data/booking-form-options?lang=tr',
    '/data/optional-services?locale=tr&serviceType=TRANSFER',
    '/data/price-estimate',
  ];

  for (const endpoint of publicEndpoints) {
    const response = endpoint === '/data/price-estimate'
      ? await adminPage.request.post(endpoint, { data: {} })
      : await adminPage.request.get(endpoint);
    const contentType = response.headers()['content-type'] ?? '';
    if (!contentType.includes('json')) continue;
    const leaks = findCustomerLeaks(await response.json());
    expect(leaks, `${endpoint} leaked toll internals`).toEqual([]);
  }

  await adminPage.goto('/');
  await waitForSettledAdminPage(adminPage);
  await expect(adminPage.locator('body')).not.toContainText(customerLeakPattern);
  await expect(adminPage.locator('[id="rezervasyon"], [data-testid*="reservation"]').first())
    .toBeVisible({ timeout: 15_000 });
});

test('one adjacent toll point reorder is reversible without changing toll data', async ({ adminPage }) => {
  await adminPage.setViewportSize({ width: 390, height: 844 });
  const response = await adminPage.goto('/admin/yol-gecis-ucretleri');
  expect(response?.status()).toBe(200);
  await waitForSettledAdminPage(adminPage);

  const before = await tollPoints(adminPage);
  expect(before.points.length, 'At least two toll points are required for reorder acceptance').toBeGreaterThan(1);
  const originalSequence = sequence(before.points);
  const first = adminPage.locator('button[aria-label$=" aşağı taşı"]').first();
  await expect(first).toBeEnabled();
  const firstName = await first.getAttribute('aria-label');
  const movedName = firstName?.replace(/ aşağı taşı$/, '') ?? '';
  let moved = false;

  try {
    const downResponse = adminPage.waitForResponse((candidate) =>
      candidate.url().includes('/admin/api/pricing/tolls/order') &&
      candidate.request().method() === 'POST',
    );
    await first.click();
    expect((await (await downResponse).status()), 'Adjacent reorder must return 200').toBe(200);
    moved = true;
    await expect(adminPage.getByRole('button', { name: new RegExp(`${movedName} yukarı taşı`, 'i') })).toBeVisible();
  } finally {
    if (moved) {
      const reverse = adminPage.getByRole('button', { name: new RegExp(`${movedName} yukarı taşı`, 'i') });
      const reverseResponse = adminPage.waitForResponse((candidate) =>
        candidate.url().includes('/admin/api/pricing/tolls/order') &&
        candidate.request().method() === 'POST',
      );
      await reverse.click();
      expect((await (await reverseResponse).status()), 'Reverse reorder must return 200').toBe(200);
    }
  }

  const after = await tollPoints(adminPage);
  expect(sequence(after.points), 'Final API toll point sequence must be restored exactly').toEqual(originalSequence);
  expect(businessFields(after.points), 'Reordering must not mutate toll point business fields').toEqual(
    businessFields(before.points),
  );
  await adminPage.reload();
  await waitForSettledAdminPage(adminPage);
  await expect(adminPage.getByRole('button', { name: new RegExp(`${movedName} aşağı taşı`, 'i') })).toBeVisible();
  await screenshotEvidence(adminPage, 'toll-controls-reordered-restored');
});