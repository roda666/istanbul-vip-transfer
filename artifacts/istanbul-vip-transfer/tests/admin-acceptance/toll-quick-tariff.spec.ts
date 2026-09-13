import { createHash } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import {
  auditLogs,
  routeTollAlternatives,
  tollPoints,
  tollTariffs,
  transferRoutes,
} from '../../db/schema';
import { expect, test, waitForSettledAdminPage } from './fixtures';

const stableHash = (rows: unknown[]) => createHash('sha256')
  .update(JSON.stringify(rows, (_key, value) => value instanceof Date ? value.toISOString() : value))
  .digest('hex');

test('adds quick gate-pair tariffs without changing gates or real pricing data', async ({
  adminPage,
  adminIdentity,
}) => {
  test.setTimeout(120_000);
  const suffix = crypto.randomUUID();
  const pointId = crypto.randomUUID();
  const routeId = crypto.randomUUID();
  const pointName = `__qa_quick_tariff_point_${suffix}`;
  const routeName = `__qa_quick_tariff_route_${suffix}`;
  const before = {
    points: await db.select().from(tollPoints),
    tariffs: await db.select().from(tollTariffs),
    routes: await db.select().from(transferRoutes),
  };

  try {
    await db.insert(tollPoints).values({
      id: pointId,
      name: pointName,
      type: 'HIGHWAY',
      active: true,
      pricingMode: 'GATE_PAIR',
      bannedVehicleClasses: [],
      bannedVehicleTypes: [],
      createdBy: adminIdentity.id,
      updatedBy: adminIdentity.id,
    });
    await db.insert(transferRoutes).values({
      id: routeId,
      slug: `qa-quick-tariff-route-${suffix}`,
      name: routeName,
      origin: 'QA İstanbul',
      destination: 'QA Kestel',
      distanceKm: 50,
      durationMinutes: 60,
      priceVitoMinEur: 1,
      priceVitoMaxEur: 2,
      priceSprinterMinEur: 1,
      priceSprinterMaxEur: 2,
      active: true,
    });

    await adminPage.goto('/admin/yol-gecis-ucretleri');
    await waitForSettledAdminPage(adminPage);
    await adminPage.getByRole('button', { name: 'Geçiş Noktaları ve Maliyetler', exact: true }).click();
    await adminPage.getByRole('button', { name: new RegExp(pointName) }).click();

    const entry = adminPage.getByTestId('quick-tariff-entry-gate');
    const exit = adminPage.getByTestId('quick-tariff-exit-gate');
    const amount = adminPage.getByTestId('quick-tariff-amount');
    const vehicleClass = adminPage.getByTestId('quick-tariff-class');
    const add = adminPage.getByTestId('quick-tariff-add');

    expect(await db.select().from(tollTariffs).where(eq(tollTariffs.tollPointId, pointId))).toHaveLength(0);
    await add.click();
    await expect(adminPage.getByText('Giriş gişesi zorunludur.', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Çıkış gişesi zorunludur.', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Ücret zorunludur.', { exact: true })).toBeVisible();
    expect(await db.select().from(tollTariffs).where(eq(tollTariffs.tollPointId, pointId))).toHaveLength(0);
    await entry.fill('Odayeri');
    await exit.fill('Kurnaköy');
    await amount.fill('1.234,56');
    await vehicleClass.selectOption('class_2');
    await expect(entry).toHaveValue('Odayeri');
    await expect(exit).toHaveValue('Kurnaköy');
    await expect(amount).toHaveValue('');
    expect(await db.select().from(tollTariffs).where(eq(tollTariffs.tollPointId, pointId))).toHaveLength(0);
    await vehicleClass.selectOption('class_1');
    await amount.fill('1.234,56');
    const firstResponse = adminPage.waitForResponse((response) =>
      response.url().endsWith('/admin/api/pricing/tolls/tariffs/quick')
      && response.request().method() === 'POST');
    await add.click();
    expect((await firstResponse).status()).toBe(201);
    await expect(adminPage.getByText('₺1.234,56', { exact: true }).first()).toBeVisible();
    await expect(amount).toHaveValue('');
    await expect(entry).toHaveValue('Odayeri');
    await expect(exit).toHaveValue('Kurnaköy');

    // Changing only the class retains the route pair and clears only amount.
    await vehicleClass.selectOption('class_2');
    await expect(entry).toHaveValue('Odayeri');
    await expect(exit).toHaveValue('Kurnaköy');
    await expect(amount).toHaveValue('');
    await amount.fill('2000');
    const secondResponse = adminPage.waitForResponse((response) =>
      response.url().endsWith('/admin/api/pricing/tolls/tariffs/quick')
      && response.request().method() === 'POST');
    await add.click();
    expect((await secondResponse).status()).toBe(201);
    await expect(adminPage.getByText('₺2.000,00', { exact: true }).first()).toBeVisible();

    await vehicleClass.selectOption('class_1');
    await entry.fill('  ODAYERİ  ');
    await exit.fill('  KURNAKÖY  ');
    await amount.fill('1500');
    const duplicateResponse = adminPage.waitForResponse((response) =>
      response.url().endsWith('/admin/api/pricing/tolls/tariffs/quick')
      && response.request().method() === 'POST');
    await add.click();
    expect((await duplicateResponse).status()).toBe(422);
    await expect(adminPage.getByText(
      'Bu sınıf için bu gişe çiftinin tarifesi zaten var; mevcut tarifeyi Düzenle ile güncelleyin',
      { exact: true },
    )).toBeVisible();
    const createdRows = await db.select().from(tollTariffs).where(eq(tollTariffs.tollPointId, pointId));
    expect(createdRows).toHaveLength(2);
    expect(createdRows.map((row) => row.vehicleClass).sort()).toEqual(['class_1', 'class_2']);
    await expect(adminPage.getByText(/Sınıf 1.*\(1\)/).first()).toBeVisible();
    await expect(adminPage.getByText(/Sınıf 2.*\(1\)/).first()).toBeVisible();
    await expect(adminPage.getByText(/Sınıf 3.*\(0\)/).first()).toBeVisible();
    await expect(adminPage.getByText('Henüz tarife yok.', { exact: true }).first()).toBeVisible();

    // Class-section actions only prepare the existing quick form; they never create a row.
    await amount.fill('999');
    await adminPage.getByTestId('prepare-quick-tariff-class_3').click();
    await expect(vehicleClass).toHaveValue('class_3');
    await expect(entry).toHaveValue('  ODAYERİ  ');
    await expect(exit).toHaveValue('  KURNAKÖY  ');
    await expect(amount).toHaveValue('');
    await expect(amount).toBeFocused();
    expect(await db.select().from(tollTariffs).where(eq(tollTariffs.tollPointId, pointId))).toHaveLength(2);

    const classSections = adminPage.locator('[data-testid^="tariff-class-section-"]');
    await expect(classSections).toHaveCount(6);
    await expect(adminPage.getByTestId('tariff-row-class_1')).toHaveCount(1);
    await expect(adminPage.getByTestId('tariff-row-class_2')).toHaveCount(1);
    await expect(adminPage.getByTestId('tariff-row-class_3')).toHaveCount(0);

    for (const width of [390, 768]) {
      await adminPage.setViewportSize({ width, height: 900 });
      expect(await adminPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      for (const control of await adminPage.locator('[data-testid^="quick-tariff-"]').evaluateAll((elements) =>
        elements.map((element) => ({ id: element.getAttribute('data-testid'), height: element.getBoundingClientRect().height })))) {
        expect(control.height, `${control.id} at ${width}px`).toBeGreaterThanOrEqual(44);
      }
      for (const button of await adminPage.locator('[data-testid^="prepare-quick-tariff-"]').evaluateAll((elements) =>
        elements.map((element) => ({ id: element.getAttribute('data-testid'), height: element.getBoundingClientRect().height })))) {
        expect(button.height, `${button.id} at ${width}px`).toBeGreaterThanOrEqual(44);
      }
      const sectionBoxes = await classSections.evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          return { top: box.top, bottom: box.bottom };
        }));
      for (let index = 1; index < sectionBoxes.length; index += 1) {
        expect(sectionBoxes[index].top - sectionBoxes[index - 1].bottom).toBeGreaterThanOrEqual(20);
      }
    }

    // Both class rows must produce one route-combination pair option.
    await adminPage.getByRole('button', { name: 'Rota Kombinasyonları', exact: true }).click();
    await adminPage.locator('select').first().selectOption(routeId);
    await adminPage.getByRole('button', { name: 'Yeni Alternatif', exact: true }).click();
    await adminPage.getByPlaceholder('Örn: 1. Köprü Üzerinden').fill(`QA alternatif ${suffix}`);
    await adminPage.locator('label').filter({ hasText: pointName }).locator('input[type="checkbox"]').check();
    const pairSelector = adminPage.getByLabel(`${pointName} gişe çifti`, { exact: true });
    await expect(pairSelector.locator('option')).toHaveCount(2);
    await expect(pairSelector.locator('option').nth(1)).toHaveText('Odayeri → Kurnaköy');
    expect(await pairSelector.locator('option').allTextContents()).toEqual([
      'Gişe çifti seçin',
      'Odayeri → Kurnaköy',
    ]);

    for (const width of [390, 768]) {
      await adminPage.setViewportSize({ width, height: 900 });
      expect(await adminPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await pairSelector.boundingBox()).not.toBeNull();
      expect((await pairSelector.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  } finally {
    const temporaryTariffs = await db.select({ id: tollTariffs.id })
      .from(tollTariffs).where(eq(tollTariffs.tollPointId, pointId));
    const temporaryEntityIds = [pointId, routeId, ...temporaryTariffs.map((row) => row.id)];
    await db.delete(auditLogs).where(and(
      eq(auditLogs.adminUserId, adminIdentity.id),
      inArray(auditLogs.entityId, temporaryEntityIds),
    )).catch(() => {});
    await db.delete(routeTollAlternatives).where(eq(routeTollAlternatives.routeId, routeId)).catch(() => {});
    await db.delete(tollTariffs).where(eq(tollTariffs.tollPointId, pointId)).catch(() => {});
    await db.delete(tollPoints).where(eq(tollPoints.id, pointId)).catch(() => {});
    await db.delete(transferRoutes).where(eq(transferRoutes.id, routeId)).catch(() => {});

    const after = {
      points: await db.select().from(tollPoints),
      tariffs: await db.select().from(tollTariffs),
      routes: await db.select().from(transferRoutes),
    };
    expect(stableHash(after.points)).toBe(stableHash(before.points));
    expect(stableHash(after.tariffs)).toBe(stableHash(before.tariffs));
    expect(stableHash(after.routes)).toBe(stableHash(before.routes));
  }
});