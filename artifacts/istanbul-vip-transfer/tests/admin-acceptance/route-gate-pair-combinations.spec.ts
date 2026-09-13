import { eq, inArray } from 'drizzle-orm';
import {
  auditLogs,
  routeTollAlternativeItems,
  routeTollAlternatives,
  tollPoints,
  tollTariffs,
  transferRoutes,
  vehiclePricingProfiles,
  vehicleTollPointClasses,
  vehicles,
} from '../../db/schema';
import { db } from '../../db';
import { expect, test, waitForSettledAdminPage } from './fixtures';

const MISSING_PAIR_WARNING =
  'Önce Geçiş Noktaları ve Maliyetler bölümünde bu nokta için gişe çifti tarifesi ekleyin';
const MISSING_COMPARISON = 'Eksik veya yasaklı — hesaplanamadı';

test('route combinations use exact active tariff-backed gate pairs', async ({
  adminPage,
  adminIdentity,
}) => {
  test.setTimeout(180_000);

  const suffix = crypto.randomUUID();
  const ids = {
    point: crypto.randomUUID(),
    route: crypto.randomUUID(),
    vehicle: crypto.randomUUID(),
    missingVehicle: crypto.randomUUID(),
    profile: crypto.randomUUID(),
  };
  const names = {
    point: `__qa_gate_pair_point_${suffix}`,
    route: `__qa_gate_pair_route_${suffix}`,
    vehicle: `__qa_gate_pair_vehicle_${suffix}`,
    missingVehicle: `__qa_gate_pair_missing_vehicle_${suffix}`,
    primary: `__qa_gate_pair_primary_${suffix}`,
    secondary: `__qa_gate_pair_secondary_${suffix}`,
  };
  const tariffIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  const createdAlternativeIds: string[] = [];
  const now = new Date();

  // Snapshot the real rows this acceptance flow is allowed to touch. The
  // temporary rows are deleted below and the complete snapshots are compared
  // after cleanup so a failed UI/API request cannot leave production data
  // changed behind.
  const before = {
    points: await db.select().from(tollPoints),
    tariffs: await db.select().from(tollTariffs),
    routes: await db.select().from(transferRoutes),
    vehicles: await db.select().from(vehicles),
    assignments: await db.select().from(vehicleTollPointClasses),
    profiles: await db.select().from(vehiclePricingProfiles),
    alternatives: await db.select().from(routeTollAlternatives),
    alternativeItems: await db.select().from(routeTollAlternativeItems),
    audits: await db.select().from(auditLogs),
  };

  const createAlternative = async (name: string, pair: string) => {
    await adminPage.getByRole('button', { name: 'Yeni Alternatif', exact: true }).click();
    await adminPage.getByPlaceholder('Örn: 1. Köprü Üzerinden').fill(name);
    await adminPage
      .locator('label')
      .filter({ hasText: names.point })
      .locator('input[type="checkbox"]')
      .check();
    const selector = adminPage.getByLabel(`${names.point} gişe çifti`, { exact: true });
    await expect(selector).toBeVisible();
    const [selectedValue] = await selector.selectOption({ label: pair });
    await expect(selector).toHaveValue(selectedValue);
    const responsePromise = adminPage.waitForResponse((response) =>
      response.url().includes('/admin/api/pricing/tolls/alternatives') &&
      response.request().method() === 'POST',
    );
    await adminPage.getByRole('button', { name: 'Kaydet', exact: true }).last().click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const json = await response.json() as { alternative: { id: string } };
    createdAlternativeIds.push(json.alternative.id);
    await expect(adminPage.getByText(name, { exact: true })).toBeVisible();
    return json.alternative.id;
  };

  const editAlternativePair = async (name: string, pair: string) => {
    const card = adminPage
      .getByText(name, { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"border-slate-200")][1]');
    await card.getByRole('button', { name: 'Düzenle', exact: true }).click();
    const selector = adminPage.getByLabel(`${names.point} gişe çifti`, { exact: true });
    const [selectedValue] = await selector.selectOption({ label: pair });
    await expect(selector).toHaveValue(selectedValue);
    const responsePromise = adminPage.waitForResponse((response) =>
      /\/admin\/api\/pricing\/tolls\/alternatives\/[^/]+$/.test(new URL(response.url()).pathname) &&
      response.request().method() === 'PATCH',
    );
    await adminPage.getByRole('button', { name: 'Kaydet', exact: true }).last().click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
  };

  try {
    await db.insert(tollPoints).values({
      id: ids.point,
      name: names.point,
      type: 'HIGHWAY',
      active: true,
      pricingMode: 'GATE_PAIR',
      classificationLabel: 'QA per-point classification',
      bannedVehicleClasses: [],
      bannedVehicleTypes: [],
    });
    await db.insert(tollTariffs).values([
      {
        id: tariffIds[0],
        tollPointId: ids.point,
        vehicleClass: 'class_1',
        entryGateName: 'Odayeri',
        exitGateName: 'Kurnaköy',
        amountKurus: 11_100,
        manualAmountKurus: 11_100,
        sourceName: 'QA active tariff',
        queriedAt: now,
        updatedAt: new Date(now.getTime() + 1_000),
        active: true,
      },
      {
        id: tariffIds[1],
        tollPointId: ids.point,
        vehicleClass: 'class_2',
        entryGateName: 'Odayeri',
        exitGateName: 'Kurnaköy',
        amountKurus: 12_500,
        manualAmountKurus: 12_500,
        sourceName: 'QA active tariff',
        queriedAt: now,
        updatedAt: new Date(now.getTime() + 2_000),
        active: true,
      },
      {
        id: tariffIds[2],
        tollPointId: ids.point,
        vehicleClass: 'class_2',
        entryGateName: 'Riva',
        exitGateName: 'Kurnaköy',
        amountKurus: 9_000,
        manualAmountKurus: 9_000,
        sourceName: 'QA active tariff',
        queriedAt: now,
        updatedAt: new Date(now.getTime() + 1_000),
        active: true,
      },
    ]);
    await db.insert(transferRoutes).values({
      id: ids.route,
      slug: `qa-gate-pair-route-${suffix}`,
      name: names.route,
      origin: 'QA İstanbul',
      destination: 'QA Kurnaköy',
      distanceKm: 50,
      durationMinutes: 60,
      priceVitoMinEur: 1,
      priceVitoMaxEur: 2,
      priceSprinterMinEur: 1,
      priceSprinterMaxEur: 2,
      active: true,
    });
    await db.insert(vehicles).values([
      {
        id: ids.vehicle,
        name: names.vehicle,
        slug: `qa-gate-pair-vehicle-${suffix}`,
        tollClass: 'class_1',
        pricingClass: 'minivan',
        priceCalculationEligible: true,
        isActive: true,
        status: 'DRAFT',
      },
      {
        id: ids.missingVehicle,
        name: names.missingVehicle,
        slug: `qa-gate-pair-missing-vehicle-${suffix}`,
        tollClass: 'class_1',
        pricingClass: 'minivan',
        priceCalculationEligible: true,
        isActive: true,
        status: 'DRAFT',
      },
    ]);
    await db.insert(vehicleTollPointClasses).values({
      id: crypto.randomUUID(),
      vehicleId: ids.vehicle,
      tollPointId: ids.point,
      vehicleClass: 'class_2',
      createdBy: adminIdentity.id,
      updatedBy: adminIdentity.id,
    });
    await db.insert(vehiclePricingProfiles).values({
      id: ids.profile,
      vehicleId: ids.vehicle,
      mode: 'DISTANCE',
      active: true,
      distanceOpeningKurus: 1_000,
      distanceFirstKmKurus: 100,
      distanceThresholdKm: 100,
      distanceSecondKmKurus: 100,
      createdBy: adminIdentity.id,
      updatedBy: adminIdentity.id,
    });

    await adminPage.setViewportSize({ width: 390, height: 844 });
    const pageResponse = await adminPage.goto('/admin/yol-gecis-ucretleri');
    expect(pageResponse?.status()).toBe(200);
    await waitForSettledAdminPage(adminPage);
    await adminPage.getByRole('button', { name: 'Rota Kombinasyonları', exact: true }).click();
    await adminPage.locator('select').first().selectOption(ids.route);
    await expect(adminPage.getByRole('button', { name: 'Yeni Alternatif', exact: true })).toBeVisible();

    await adminPage.getByRole('button', { name: 'Yeni Alternatif', exact: true }).click();
    await adminPage
      .locator('label')
      .filter({ hasText: names.point })
      .locator('input[type="checkbox"]')
      .check();
    const selector = adminPage.getByLabel(`${names.point} gişe çifti`, { exact: true });
    await selector.locator('option').allTextContents().then((options) => {
      expect(options).toEqual([
        'Gişe çifti seçin',
        'Odayeri → Kurnaköy',
        'Riva → Kurnaköy',
      ]);
    });
    await expect(adminPage.locator('input[placeholder="Giriş gişesi"], input[placeholder="Çıkış gişesi"]')).toHaveCount(0);
    expect((await selector.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(await adminPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await adminPage.getByRole('button', { name: 'İptal', exact: true }).last().click();

    const primaryId = await createAlternative(names.primary, 'Odayeri → Kurnaköy');
    const primaryCard = adminPage
      .getByText(names.primary, { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"border-slate-200")][1]');
    await expect(primaryCard).toContainText('Odayeri → Kurnaköy');
    await editAlternativePair(names.primary, 'Riva → Kurnaköy');
    await expect(
      adminPage
        .getByText(names.primary, { exact: true })
        .locator('xpath=ancestor::div[contains(@class,"border-slate-200")][1]'),
    ).toContainText('Riva → Kurnaköy');

    const secondaryId = await createAlternative(names.secondary, 'Odayeri → Kurnaköy');
    expect(primaryId).not.toBe(secondaryId);

    // The endpoint must reject a pair that is not backed by an active tariff.
    const inventedPairResult = await adminPage.evaluate(async (payload) => {
      const response = await fetch('/admin/api/pricing/tolls/alternatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return { status: response.status, body: await response.json() };
    }, {
        routeId: ids.route,
        name: `__qa_gate_pair_invented_${suffix}`,
        active: true,
        isDefault: false,
        displayOrder: 100,
        pointIds: [ids.point],
        gatePairs: {
          [ids.point]: { entryGateName: 'Invented', exitGateName: 'No Such Gate' },
        },
        needsReview: false,
        reviewNote: null,
    });
    expect(inventedPairResult.status).toBe(422);
    expect(inventedPairResult.body).toMatchObject({ error: MISSING_PAIR_WARNING });

    const comparisonSelector = adminPage.locator('select').nth(1);
    await comparisonSelector.selectOption(ids.missingVehicle);
    await expect(adminPage.getByText(MISSING_COMPARISON, { exact: true }).first()).toBeVisible();
    const missingComparison = await adminPage.request.get(
      `/admin/api/pricing/tolls/route-alternatives/${ids.route}?vehicleId=${ids.missingVehicle}`,
    );
    expect(missingComparison.status()).toBe(200);
    const missingJson = await missingComparison.json() as {
      alternatives: Array<{ totalKurus: number | null }>;
    };
    expect(missingJson.alternatives).toHaveLength(2);
    expect(missingJson.alternatives.every((alternative) => alternative.totalKurus === null)).toBe(true);

    await comparisonSelector.selectOption(ids.vehicle);
    await expect(adminPage.getByText('Toplam geçiş ücreti: ₺90,00', { exact: true })).toBeVisible();
    const exactComparison = await adminPage.request.get(
      `/admin/api/pricing/tolls/route-alternatives/${ids.route}?vehicleId=${ids.vehicle}`,
    );
    expect(exactComparison.status()).toBe(200);
    const exactJson = await exactComparison.json() as {
      alternatives: Array<{ totalKurus: number | null; pointIds: string[] }>;
    };
    expect(exactJson.alternatives.map((alternative) => alternative.totalKurus)).toEqual([9_000, 12_500]);

    // Put an old, non-tariff-backed pair in state to cover edit/reload
    // migration behavior. The editor keeps it visible but cannot submit it.
    await db.update(routeTollAlternativeItems)
      .set({ entryGateName: 'Old Gate', exitGateName: 'Old Exit' })
      .where(eq(routeTollAlternativeItems.alternativeId, primaryId));
    await adminPage.reload();
    await waitForSettledAdminPage(adminPage);
    await adminPage.getByRole('button', { name: 'Rota Kombinasyonları', exact: true }).click();
    await adminPage.locator('select').first().selectOption(ids.route);
    const oldCard = adminPage
      .getByText(names.primary, { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"border-slate-200")][1]');
    await oldCard.getByRole('button', { name: 'Düzenle', exact: true }).click();
    await expect(adminPage.getByText('Eşleştirme gerekli', { exact: true })).toBeVisible();
    const oldPairSelector = adminPage.getByLabel(`${names.point} gişe çifti`, { exact: true });
    await expect(oldPairSelector).toContainText('Old Gate → Old Exit · Eşleştirme gerekli');
    let patchCalled = false;
    adminPage.on('dialog', async (dialog) => {
      expect(dialog.message()).toBe(MISSING_PAIR_WARNING);
      await dialog.dismiss();
    });
    adminPage.on('request', (request) => {
      if (request.method() === 'PATCH' && request.url().includes('/admin/api/pricing/tolls/alternatives/')) patchCalled = true;
    });
    await adminPage.getByRole('button', { name: 'Kaydet', exact: true }).last().click();
    expect(patchCalled).toBe(false);
    await expect(oldPairSelector).toBeVisible();
    const [unchangedOldPair] = await db.select({
      entryGateName: routeTollAlternativeItems.entryGateName,
      exitGateName: routeTollAlternativeItems.exitGateName,
    }).from(routeTollAlternativeItems).where(eq(routeTollAlternativeItems.alternativeId, primaryId));
    expect(unchangedOldPair).toEqual({ entryGateName: 'Old Gate', exitGateName: 'Old Exit' });

    // Check the same controls at the tablet breakpoint; no second selector
    // or horizontal overflow may be introduced by the compact layout.
    await adminPage.getByRole('button', { name: 'İptal', exact: true }).last().click();
    await adminPage.setViewportSize({ width: 768, height: 1024 });
    const secondaryCard = adminPage
      .getByText(names.secondary, { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"border-slate-200")][1]');
    await secondaryCard.getByRole('button', { name: 'Düzenle', exact: true }).click();
    const tabletSelector = adminPage.getByLabel(`${names.point} gişe çifti`, { exact: true });
    await expect(tabletSelector).toBeVisible();
    await expect(tabletSelector.locator('option')).toHaveCount(3);
    expect((await tabletSelector.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(await adminPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    if (createdAlternativeIds.length) {
      await db.delete(auditLogs).where(inArray(auditLogs.entityId, createdAlternativeIds));
    }
    const baselineAuditIds = new Set(before.audits.map((audit) => audit.id));
    const workerAuditRows = await db.select({
      id: auditLogs.id,
      adminUserId: auditLogs.adminUserId,
    }).from(auditLogs).where(eq(auditLogs.adminUserId, adminIdentity.id));
    const testAuditIds = workerAuditRows
      .filter((audit) => !baselineAuditIds.has(audit.id))
      .map((audit) => audit.id);
    // adminIdentity is a unique worker-scoped temporary account, so these
    // rows cannot belong to a real admin or another acceptance worker.
    if (testAuditIds.length) await db.delete(auditLogs).where(inArray(auditLogs.id, testAuditIds));
    await db.delete(routeTollAlternatives).where(eq(routeTollAlternatives.routeId, ids.route));
    await db.delete(vehiclePricingProfiles).where(eq(vehiclePricingProfiles.id, ids.profile));
    await db.delete(vehicleTollPointClasses).where(eq(vehicleTollPointClasses.vehicleId, ids.vehicle));
    await db.delete(tollTariffs).where(inArray(tollTariffs.id, tariffIds));
    await db.delete(tollPoints).where(eq(tollPoints.id, ids.point));
    await db.delete(vehicles).where(inArray(vehicles.id, [ids.vehicle, ids.missingVehicle]));
    await db.delete(transferRoutes).where(eq(transferRoutes.id, ids.route));

    const after = {
      points: await db.select().from(tollPoints),
      tariffs: await db.select().from(tollTariffs),
      routes: await db.select().from(transferRoutes),
      vehicles: await db.select().from(vehicles),
      assignments: await db.select().from(vehicleTollPointClasses),
      profiles: await db.select().from(vehiclePricingProfiles),
      alternatives: await db.select().from(routeTollAlternatives),
      alternativeItems: await db.select().from(routeTollAlternativeItems),
      audits: await db.select().from(auditLogs),
    };
    expect(after).toEqual(before);
  }
});