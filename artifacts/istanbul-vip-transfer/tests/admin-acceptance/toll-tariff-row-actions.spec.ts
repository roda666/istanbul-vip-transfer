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
    const addButton = adminPage.getByTestId('quick-tariff-add');
    await expect(addButton).toBeEnabled();
    await adminPage.getByTestId('quick-tariff-entry-gate').fill(entryGate);
    await adminPage.getByTestId('quick-tariff-exit-gate').fill(exitGate);
    await adminPage.getByTestId('quick-tariff-class').selectOption(vehicleClass);
    await adminPage.getByTestId('quick-tariff-amount').fill(amount);
    const response = adminPage.waitForResponse((res) =>
      res.url().endsWith('/admin/api/pricing/tolls/tariffs/quick') && res.request().method() === 'POST');
    await addButton.click();
    expect((await response).status()).toBe(201);
    await expect(addButton).toBeEnabled();
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

    await addQuick('KURNAKÖY 2', 'ADAPAZARI-2', 'class_1', '490');
    await addQuick('Kurnaköy', 'Odayeri', 'class_1', '2345');
    await addQuick('Odayeri', 'Kurnaköy', 'class_2', '3456');
    expect(await db.select().from(tollTariffs).where(eq(tollTariffs.tollPointId, pointId))).toHaveLength(3);

    // Existing rows edit in place, never in a modal or separate form.
    await action('class_1', 'Düzenle', 0);
    const inlineEntry = row('class_1', 0).getByTestId('inline-tariff-entry');
    const inlineExit = row('class_1', 0).getByTestId('inline-tariff-exit');
    const inlineAmount = row('class_1', 0).getByTestId('inline-tariff-amount');
    const inlineSave = row('class_1', 0).getByTestId('inline-tariff-save');
    await expect(inlineEntry).toHaveValue('KURNAKÖY 2');
    await expect(inlineExit).toHaveValue('ADAPAZARI-2');
    await expect(inlineAmount).toHaveValue('490,00');
    await expect(inlineSave).toBeDisabled();
    await expect(adminPage.getByRole('dialog')).toHaveCount(0);

    // Opening another row closes the first editor so only one row can edit at once.
    await action('class_1', 'Düzenle', 1);
    await expect(adminPage.getByTestId('inline-tariff-save')).toHaveCount(1);
    await expect(row('class_1', 0).getByTestId('inline-tariff-save')).toHaveCount(0);
    await row('class_1', 1).getByRole('button', { name: 'Vazgeç', exact: true }).click();
    await action('class_1', 'Düzenle', 0);

    // Invalid values cannot be saved; cancelling restores the original compact row.
    await inlineEntry.fill('');
    await inlineAmount.fill('-1');
    await expect(inlineSave).toBeDisabled();
    await expect(row('class_1', 0)).toContainText('Giriş gişesi zorunludur.');
    await expect(row('class_1', 0)).toContainText('Geçerli, negatif olmayan bir TL tutarı girin.');
    await row('class_1', 0).getByRole('button', { name: 'Vazgeç', exact: true }).click();
    await expect(row('class_1', 0)).toContainText('KURNAKÖY 2');
    await expect(row('class_1', 0)).toContainText('₺490,00');

    // A failed PATCH keeps edit mode and every entered value.
    await action('class_1', 'Düzenle', 0);
    await inlineEntry.fill('KURNAKÖY TEST');
    await inlineExit.fill('ADAPAZARI TEST');
    await inlineAmount.fill('491,25');
    await adminPage.route('**/admin/api/pricing/tolls/tariffs/*', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Geçici kayıt hatası' }) });
      } else {
        await route.continue();
      }
    }, { times: 1 });
    await inlineSave.click();
    await expect(row('class_1', 0).getByRole('alert')).toContainText('Geçici kayıt hatası');
    await expect(inlineEntry).toHaveValue('KURNAKÖY TEST');
    await expect(inlineExit).toHaveValue('ADAPAZARI TEST');
    await expect(inlineAmount).toHaveValue('491,25');
    expect(await db.select().from(tollTariffs).where(eq(tollTariffs.tollPointId, pointId))).toHaveLength(3);

    // The responsive editor keeps inputs and both actions usable at all required widths.
    for (const width of [1440, 1280, 768, 390]) {
      await adminPage.setViewportSize({ width, height: 900 });
      await assertNoHorizontalOverflow(adminPage);
      await assertTouchTargets(
        adminPage,
        44,
        '[data-testid="inline-tariff-entry"], [data-testid="inline-tariff-exit"], [data-testid="inline-tariff-amount"], [data-testid="inline-tariff-save"], [data-testid="inline-tariff-cancel"]',
      );
    }

    // A synchronous double click produces one PATCH and updates the same DB row.
    await adminPage.setViewportSize({ width: 1280, height: 900 });
    await inlineEntry.fill('KURNAKÖY 3');
    await inlineExit.fill('ADAPAZARI-3');
    await inlineAmount.fill('491,50');
    await expect(inlineSave).toBeEnabled();
    let patchCount = 0;
    await adminPage.route('**/admin/api/pricing/tolls/tariffs/*', async (route) => {
      if (route.request().method() === 'PATCH') patchCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 150));
      await route.continue();
    }, { times: 1 });
    const patchResponse = adminPage.waitForResponse((res) =>
      res.url().includes('/admin/api/pricing/tolls/tariffs/') && res.request().method() === 'PATCH');
    await inlineSave.dblclick();
    await expect(inlineSave).toContainText('Kaydediliyor...');
    expect((await patchResponse).status()).toBe(200);
    expect(patchCount).toBe(1);
    await expect(row('class_1', 0)).toContainText('KURNAKÖY 3');
    await expect(row('class_1', 0)).toContainText('ADAPAZARI-3');
    await expect(row('class_1', 0)).toContainText('₺491,50');
    await expect(row('class_1', 0).getByTestId('inline-tariff-save')).toHaveCount(0);
    const tariffsAfterEdit = await db.select().from(tollTariffs).where(eq(tollTariffs.tollPointId, pointId));
    expect(tariffsAfterEdit).toHaveLength(3);
    expect(tariffsAfterEdit.find((tariff) => tariff.vehicleClass === 'class_1' && tariff.entryGateName === 'KURNAKÖY 3')).toMatchObject({
      exitGateName: 'ADAPAZARI-3',
      amountKurus: 49_150,
      manualAmountKurus: 49_150,
    });

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
    await expect(row('class_1', 0)).toContainText('KURNAKÖY 3');
    await expect(row('class_1', 0)).toContainText('ADAPAZARI-3');
    await expect(row('class_1', 0)).toContainText('₺491,50');
    await expect(adminPage.getByTestId('tariff-row-class_2')).toHaveCount(0);

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