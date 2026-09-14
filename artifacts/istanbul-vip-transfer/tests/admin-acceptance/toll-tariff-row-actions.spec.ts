import { createHash } from 'node:crypto';
import { eq, inArray, isNull, ne, or } from 'drizzle-orm';
import { db, closeDatabaseConnection } from '../../db';
import {
  auditLogs,
  routeTollAlternativeItems,
  routeTollAlternatives,
  tollPoints,
  tollTariffs,
  transferRoutes,
} from '../../db/schema';
import {
  assertNoHorizontalOverflow,
  assertTouchTargets,
  expect,
  test,
  waitForSettledAdminPage,
} from './fixtures';

const stableHash = (rows: unknown[]) => createHash('sha256')
  .update(JSON.stringify([...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), (_key, value) =>
    value instanceof Date ? value.toISOString() : value))
  .digest('hex');

const snapshot = async (adminId: string) => {
  const [points, tariffs, routes, alternatives, audits] = await Promise.all([
    db.select().from(tollPoints),
    db.select().from(tollTariffs),
    db.select().from(transferRoutes),
    db.select().from(routeTollAlternatives),
    db.select().from(auditLogs).where(or(
      isNull(auditLogs.adminUserId),
      ne(auditLogs.adminUserId, adminId),
    )),
  ]);
  return {
    points: { count: points.length, hash: stableHash(points) },
    tariffs: { count: tariffs.length, hash: stableHash(tariffs) },
    routes: { count: routes.length, hash: stableHash(routes) },
    alternatives: { count: alternatives.length, hash: stableHash(alternatives) },
    audits: { count: audits.length, hash: stableHash(audits) },
  };
};

test('manages temporary tariff rows without crossing point/class boundaries', async ({
  adminPage,
  adminIdentity,
}) => {
  test.setTimeout(180_000);
  const suffix = crypto.randomUUID();
  const pointId = crypto.randomUUID();
  const routeId = crypto.randomUUID();
  const pointName = `__qa_tariff_actions_point_${suffix}`;
  const routeName = `__qa_tariff_actions_route_${suffix}`;
  const before = await snapshot(adminIdentity.id);

  const addQuick = async (entryGate: string, exitGate: string, vehicleClass: string, amount: string) => {
    await adminPage.getByTestId('quick-tariff-entry-gate').fill(entryGate);
    await adminPage.getByTestId('quick-tariff-exit-gate').fill(exitGate);
    await adminPage.getByTestId('quick-tariff-class').selectOption(vehicleClass);
    await adminPage.getByTestId('quick-tariff-amount').fill(amount);
    const response = adminPage.waitForResponse((res) =>
      res.url().endsWith('/admin/api/pricing/tolls/tariffs/quick') && res.request().method() === 'POST');
    await adminPage.getByTestId('quick-tariff-add').click();
    expect((await response).status()).toBe(201);
  };

  const row = (vehicleClass: string, index = 0) =>
    adminPage.getByTestId(`tariff-row-${vehicleClass}`).nth(index);
  const action = async (vehicleClass: string, name: string, index = 0) => {
    await row(vehicleClass, index).getByRole('button', { name, exact: true }).click();
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
      slug: `qa-tariff-actions-route-${suffix}`,
      name: routeName,
      origin: 'QA İstanbul',
      destination: 'QA Bursa',
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
    expect(await db.select().from(tollTariffs).where(eq(tollTariffs.tollPointId, pointId))).toHaveLength(0);

    // Class changes are a local form reset only: no request and no DB write.
    await entry.fill('Odayeri');
    await exit.fill('Kurnaköy');
    await amount.fill('1234');
    await vehicleClass.selectOption('class_2');
    await expect(entry).toHaveValue('Odayeri');
    await expect(exit).toHaveValue('Kurnaköy');
    await expect(amount).toHaveValue('');
    expect(await db.select().from(tollTariffs).where(eq(tollTariffs.tollPointId, pointId))).toHaveLength(0);

    await addQuick('Odayeri', 'Kurnaköy', 'class_1', '1234');
    await addQuick('Kurnaköy', 'Odayeri', 'class_1', '2345');
    await addQuick('Odayeri', 'Kurnaköy', 'class_2', '3456');
    expect(await db.select().from(tollTariffs).where(eq(tollTariffs.tollPointId, pointId))).toHaveLength(3);

    // Existing row edit uses the normal tariff form.
    await action('class_1', 'Düzenle', 0);
    await adminPage.getByLabel(/Manuel Fiyat/).fill('4567');
    const patchResponse = adminPage.waitForResponse((res) =>
      res.url().includes('/admin/api/pricing/tolls/tariffs/') && res.request().method() === 'PATCH');
    await adminPage.getByRole('button', { name: 'Tarifeyi Kaydet', exact: true }).click();
    expect((await patchResponse).status()).toBe(200);
    await expect(row('class_1', 0)).toContainText('₺4.567,00');

    // Activation is a PATCH preserving the tariff's other values.
    const class2Before = (await db.select().from(tollTariffs)
      .where(eq(tollTariffs.tollPointId, pointId))).find((t) => t.vehicleClass === 'class_2');
    expect(class2Before).toBeDefined();
    await action('class_2', 'Pasifleştir');
    await expect.poll(async () => (await db.select().from(tollTariffs).where(eq(tollTariffs.tollPointId, pointId))).find((t) => t.vehicleClass === 'class_2')?.active).toBe(false);
    const class2Inactive = (await db.select().from(tollTariffs)
      .where(eq(tollTariffs.tollPointId, pointId))).find((t) => t.vehicleClass === 'class_2');
    expect(class2Inactive).toMatchObject({
      amountKurus: class2Before?.amountKurus,
      entryGateName: class2Before?.entryGateName,
      exitGateName: class2Before?.exitGateName,
    });
    await expect(row('class_2').getByRole('button', { name: 'Aktifleştir', exact: true })).toBeVisible();
    await action('class_2', 'Aktifleştir');
    await expect.poll(async () => (await db.select().from(tollTariffs).where(eq(tollTariffs.tollPointId, pointId))).find((t) => t.vehicleClass === 'class_2')?.active).toBe(true);
    await expect(row('class_2').getByRole('button', { name: 'Pasifleştir', exact: true })).toBeVisible();

    const beforeOrder = (await db.select().from(tollTariffs).where(eq(tollTariffs.tollPointId, pointId)))
      .filter((t) => t.vehicleClass === 'class_1')
      .sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id))
      .map((t) => t.id);
    await action('class_1', 'Yukarı', 1);
    await expect.poll(async () => (await db.select().from(tollTariffs).where(eq(tollTariffs.tollPointId, pointId)))
      .filter((t) => t.vehicleClass === 'class_1')
      .sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id))
      .map((t) => t.id)).toEqual([beforeOrder[1], beforeOrder[0]]);

    // Explicitly prove a caller cannot move a row into another class.
    const crossClassStatus = await adminPage.evaluate(async ({ tariffId, tollPointId }) => {
      const response = await fetch('/admin/api/pricing/tolls/tariffs/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tariffId,
          direction: 'down',
          vehicleClass: 'class_2',
          tollPointId,
        }),
      });
      return response.status;
    }, { tariffId: beforeOrder[0], tollPointId: pointId });
    expect(crossClassStatus).toBe(422);

    const first = row('class_1', 0);
    const last = row('class_1', 1);
    await expect(first.getByRole('button', { name: 'Yukarı', exact: true })).toBeDisabled();
    await expect(last.getByRole('button', { name: 'Aşağı', exact: true })).toBeDisabled();

    // Dismiss once, then explicitly confirm permanent deletion.
    let dialogMessage = '';
    adminPage.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });
    await action('class_2', 'Sil');
    expect(dialogMessage).toMatch(/kalıcı olarak silinecek/i);
    expect(await db.select().from(tollTariffs).where(eq(tollTariffs.tollPointId, pointId))).toHaveLength(3);
    adminPage.once('dialog', (dialog) => dialog.accept());
    const deleteResponse = adminPage.waitForResponse((res) =>
      res.url().includes('/admin/api/pricing/tolls/tariffs/') && res.request().method() === 'DELETE');
    await action('class_2', 'Sil');
    expect((await deleteResponse).status()).toBe(200);
    await expect.poll(async () => (await db.select().from(tollTariffs).where(eq(tollTariffs.tollPointId, pointId))).length).toBe(2);

    await adminPage.reload();
    await waitForSettledAdminPage(adminPage);
    await adminPage.getByRole('button', { name: new RegExp(pointName) }).click();
    await expect(row('class_1', 0)).toBeVisible();
    await expect(adminPage.getByTestId('tariff-row-class_2')).toHaveCount(0);
    const afterReloadOrder = (await db.select().from(tollTariffs).where(eq(tollTariffs.tollPointId, pointId)))
      .filter((t) => t.vehicleClass === 'class_1')
      .sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id))
      .map((t) => t.id);
    expect(afterReloadOrder).toEqual([beforeOrder[1], beforeOrder[0]]);

    await adminPage.setViewportSize({ width: 1280, height: 900 });
    await assertNoHorizontalOverflow(adminPage);
    await assertTouchTargets(adminPage, 44);
    for (const width of [390, 768]) {
      await adminPage.setViewportSize({ width, height: 900 });
      await assertNoHorizontalOverflow(adminPage);
      await assertTouchTargets(adminPage, 44);
    }
  } finally {
    const temporaryAlternatives = await db.select({ id: routeTollAlternatives.id })
      .from(routeTollAlternatives).where(eq(routeTollAlternatives.routeId, routeId));
    if (temporaryAlternatives.length > 0) {
      await db.delete(routeTollAlternativeItems)
        .where(inArray(routeTollAlternativeItems.alternativeId, temporaryAlternatives.map((row) => row.id)))
        .catch(() => {});
    }
    await db.delete(routeTollAlternatives).where(eq(routeTollAlternatives.routeId, routeId)).catch(() => {});
    await db.delete(auditLogs).where(eq(auditLogs.adminUserId, adminIdentity.id)).catch(() => {});
    await db.delete(tollTariffs).where(eq(tollTariffs.tollPointId, pointId)).catch(() => {});
    await db.delete(tollPoints).where(eq(tollPoints.id, pointId)).catch(() => {});
    await db.delete(transferRoutes).where(eq(transferRoutes.id, routeId)).catch(() => {});
    try {
      const after = await snapshot(adminIdentity.id);
      expect(after).toEqual(before);
      expect(await db.select().from(tollPoints).where(eq(tollPoints.id, pointId))).toHaveLength(0);
      expect(await db.select().from(tollTariffs).where(eq(tollTariffs.tollPointId, pointId))).toHaveLength(0);
      expect(await db.select().from(transferRoutes).where(eq(transferRoutes.id, routeId))).toHaveLength(0);
    } finally {
      await closeDatabaseConnection().catch(() => {});
    }
  }
});