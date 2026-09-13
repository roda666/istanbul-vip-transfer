import { createHash } from 'node:crypto';
import { and, eq, notLike } from 'drizzle-orm';
import { db } from '../../db';
import { auditLogs, tollPoints, tollTariffs } from '../../db/schema';
import { expect, test, waitForSettledAdminPage } from './fixtures';

const stableHash = (rows: unknown[]) => createHash('sha256')
  .update(JSON.stringify(rows, (_key, value) => value instanceof Date ? value.toISOString() : value))
  .digest('hex');

test('previews and atomically applies a percentage increase to existing priced toll rows', async ({
  adminIdentity,
  adminPage,
}) => {
  test.setTimeout(120_000);
  const suffix = crypto.randomUUID();
  const pointName = `__qa_bulk_toll_${suffix}`;
  const realPointsBefore = await db.select().from(tollPoints).where(notLike(tollPoints.name, '__qa_bulk_toll_%')).orderBy(tollPoints.id);
  const realTariffsBefore = await db.select().from(tollTariffs).orderBy(tollTariffs.id);
  let pointId = '';

  try {
    const [point] = await db.insert(tollPoints).values({
      name: pointName,
      type: 'BRIDGE',
      active: true,
      pricingMode: 'FLAT',
      bannedVehicleClasses: [],
      createdBy: adminIdentity.id,
      updatedBy: adminIdentity.id,
    }).returning();
    pointId = point.id;
    await db.insert(tollTariffs).values([
      {
        tollPointId: point.id, vehicleClass: 'class_1', timeBand: 'ALL',
        amountKurus: 15_000, manualAmountKurus: 15_000, active: true,
        createdBy: adminIdentity.id, updatedBy: adminIdentity.id,
      },
      {
        tollPointId: point.id, vehicleClass: 'class_2', timeBand: 'ALL',
        amountKurus: 20_000, manualAmountKurus: 20_000, active: true,
        createdBy: adminIdentity.id, updatedBy: adminIdentity.id,
      },
      {
        tollPointId: point.id, vehicleClass: 'class_3', timeBand: 'ALL',
        amountKurus: null, manualAmountKurus: null, active: true,
        createdBy: adminIdentity.id, updatedBy: adminIdentity.id,
      },
    ]);

    await adminPage.goto('/admin/yol-gecis-ucretleri');
    await waitForSettledAdminPage(adminPage);
    await adminPage.getByRole('button', { name: 'Geçiş Noktaları ve Maliyetler', exact: true }).click();
    await adminPage.getByRole('button', { name: new RegExp(pointName) }).click();

    const card = adminPage.getByTestId('bulk-increase-card');
    await expect(card).toBeVisible();
    await card.getByTestId('bulk-increase-percentage').fill('15');
    const previewResponse = adminPage.waitForResponse((response) =>
      response.url().endsWith('/admin/api/pricing/tolls/bulk-increase') &&
      response.request().postDataJSON()?.action === 'PREVIEW');
    await card.getByTestId('bulk-increase-preview').click();
    const previewHttp = await previewResponse;
    expect(previewHttp.status()).toBe(200);
    const preview = await previewHttp.json();
    expect(preview.rows).toHaveLength(2);
    expect(preview.skippedEmptyCount).toBe(1);
    await expect(card).toContainText('2 satır güncellenecek');
    await expect(card).toContainText('1 boş satır atlanacak');
    await expect(card).toContainText('₺150,00');
    await expect(card).toContainText('₺172,50');
    await expect(card).toContainText('₺200,00');
    await expect(card).toContainText('₺230,00');

    const applyPayload = {
      action: 'APPLY',
      tollPointId: point.id,
      percentage: '15',
      previewHash: preview.previewHash,
      idempotencyKey: preview.idempotencyKey,
    };
    const applyResponse = adminPage.waitForResponse((response) =>
      response.url().endsWith('/admin/api/pricing/tolls/bulk-increase') &&
      response.request().postDataJSON()?.action === 'APPLY');
    await card.getByTestId('bulk-increase-apply').click();
    expect((await applyResponse).status()).toBe(200);

    let tempRows = await db.select().from(tollTariffs)
      .where(eq(tollTariffs.tollPointId, point.id))
      .orderBy(tollTariffs.vehicleClass);
    expect(tempRows).toHaveLength(3);
    expect(tempRows.map((row) => row.amountKurus)).toEqual([17_250, 23_000, null]);
    expect(tempRows.filter((row) => !row.active)).toHaveLength(0);

    const replay = await adminPage.evaluate(async (body) => {
      const response = await fetch('/admin/api/pricing/tolls/bulk-increase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: response.status, json: await response.json() };
    }, applyPayload);
    expect(replay.status).toBe(200);
    expect(replay.json.alreadyApplied).toBe(true);
    tempRows = await db.select().from(tollTariffs)
      .where(eq(tollTariffs.tollPointId, point.id))
      .orderBy(tollTariffs.vehicleClass);
    expect(tempRows.map((row) => row.amountKurus)).toEqual([17_250, 23_000, null]);
    expect(tempRows).toHaveLength(3);

    const stalePreview = await adminPage.evaluate(async (point) => {
      const response = await fetch('/admin/api/pricing/tolls/bulk-increase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'PREVIEW', tollPointId: point, percentage: '1' }),
      });
      return response.json();
    }, point.id);
    const pricedRow = tempRows.find((row) => row.vehicleClass === 'class_1');
    expect(pricedRow).toBeTruthy();
    await db.update(tollTariffs).set({
      amountKurus: 17_251,
      manualAmountKurus: 17_251,
      updatedAt: new Date(),
    }).where(eq(tollTariffs.id, pricedRow!.id));
    const staleApply = await adminPage.evaluate(async ({ point, preview }) => {
      const response = await fetch('/admin/api/pricing/tolls/bulk-increase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'APPLY',
          tollPointId: point,
          percentage: '1',
          previewHash: preview.previewHash,
          idempotencyKey: preview.idempotencyKey,
        }),
      });
      return { status: response.status, json: await response.json() };
    }, { point: point.id, preview: stalePreview });
    expect(staleApply.status).toBe(409);
    expect(staleApply.json.error).toContain('önizlemeden sonra değişti');

    for (const width of [390, 768]) {
      await adminPage.setViewportSize({ width, height: 900 });
      await expect(card).toBeVisible();
      expect(await adminPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const smallTargets = await card.locator('button, input').evaluateAll((elements) =>
        elements.filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.height < 44;
        }).map((element) => element.textContent || element.getAttribute('data-testid')));
      expect(smallTargets).toEqual([]);
    }
  } finally {
    if (pointId) {
      await db.delete(auditLogs).where(and(
        eq(auditLogs.adminUserId, adminIdentity.id),
        eq(auditLogs.entityId, pointId),
      )).catch(() => {});
      await db.delete(tollTariffs).where(eq(tollTariffs.tollPointId, pointId)).catch(() => {});
      await db.delete(tollPoints).where(eq(tollPoints.id, pointId)).catch(() => {});
    }
    const realPointsAfter = await db.select().from(tollPoints).where(notLike(tollPoints.name, '__qa_bulk_toll_%')).orderBy(tollPoints.id);
    const realTariffsAfter = await db.select().from(tollTariffs).orderBy(tollTariffs.id);
    expect(realPointsAfter).toHaveLength(realPointsBefore.length);
    expect(realTariffsAfter).toHaveLength(realTariffsBefore.length);
    expect(stableHash(realPointsAfter)).toBe(stableHash(realPointsBefore));
    expect(stableHash(realTariffsAfter)).toBe(stableHash(realTariffsBefore));
  }
});