import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, tollPoints, tollTariffs } from '@/db/schema';
import { getIstanbulDayBounds } from '@/lib/istanbul-time';
import { normalizeGateName } from '@/lib/toll-gate-pairs';
import { parseQuickTariffAmount, quickTariffIdentity, quickTariffInputSchema } from '@/lib/toll-quick-tariff';
import { assertNoActiveTariffOverlap, assertTariffTimeBandForPointType, tollTimeBandFlags } from '@/lib/toll-management';

export const dynamic = 'force-dynamic';

const DUPLICATE_ERROR = 'Bu sınıf için bu gişe çiftinin tarifesi zaten var; mevcut tarifeyi Düzenle ile güncelleyin';

function validationResponse(error: string, fieldErrors: Record<string, string>) {
  return NextResponse.json({ error, fieldErrors }, { status: 422 });
}

function schemaFieldErrors(error: { issues: Array<{ path: (string | number)[]; message: string }> }) {
  return error.issues.reduce<Record<string, string>>((result, issue) => {
    const field = String(issue.path[0] ?? '_general');
    if (!result[field]) result[field] = issue.message;
    return result;
  }, {});
}

/** POST /admin/api/pricing/tolls/tariffs/quick — add one manual GATE_PAIR tariff. */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized', fieldErrors: {} }, { status: 401 });
  }

  const input = await request.json().catch(() => null);
  const payload = quickTariffInputSchema.safeParse(input);
  if (!payload.success) {
    const fieldErrors = schemaFieldErrors(payload.error);
    return validationResponse(Object.values(fieldErrors)[0] ?? 'Geçersiz hızlı tarife.', fieldErrors);
  }

  const entryGateName = normalizeGateName(payload.data.entryGateName);
  const exitGateName = normalizeGateName(payload.data.exitGateName);
  const identity = quickTariffIdentity({
    tollPointId: payload.data.tollPointId,
    entryGateName,
    exitGateName,
    vehicleClass: payload.data.vehicleClass,
    timeBand: payload.data.timeBand,
  });

  try {
    const amountKurus = parseQuickTariffAmount(payload.data.amount);
    const { start: validFrom } = getIstanbulDayBounds();
    const now = new Date();

    const tariff = await db.transaction(async (tx) => {
      // Hashing the complete canonical identity makes simultaneous requests for
      // the same row serialize without changing the schema or existing APIs.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${identity}, 0::bigint))`);

      const [point] = await tx.select({
        id: tollPoints.id,
        active: tollPoints.active,
        type: tollPoints.type,
        pricingMode: tollPoints.pricingMode,
      }).from(tollPoints).where(eq(tollPoints.id, payload.data.tollPointId)).limit(1);
      if (!point) {
        const error = new Error('Geçiş noktası bulunamadı.');
        (error as Error & { field: string }).field = 'tollPointId';
        throw error;
      }
      if (!point.active) {
        const error = new Error('Yalnızca aktif geçiş noktasına tarife eklenebilir.');
        (error as Error & { field: string }).field = 'tollPointId';
        throw error;
      }
      assertTariffTimeBandForPointType(point.type, payload.data.timeBand);

      let pricingMode = point.pricingMode;
      if (point.type === 'FERRY' && pricingMode === 'FLAT') {
        const [legacyTariff] = await tx.select({ id: tollTariffs.id }).from(tollTariffs)
          .where(eq(tollTariffs.tollPointId, point.id)).limit(1);
        if (legacyTariff) {
          const error = new Error('Bu eski feribot noktasında mevcut sabit tarifeler var. Gişe bazlı sisteme geçmeden önce bu tarifeleri ayrıca inceleyin.');
          (error as Error & { field: string }).field = 'tollPointId';
          throw error;
        }
        await tx.update(tollPoints).set({
          pricingMode: 'GATE_PAIR',
          dayStartHour: null,
          nightStartHour: null,
          updatedAt: now,
          updatedBy: session.adminId,
        }).where(eq(tollPoints.id, point.id));
        pricingMode = 'GATE_PAIR';
      }
      if (pricingMode !== 'GATE_PAIR') {
        const error = new Error('Hızlı tarife yalnızca giriş/çıkış gişe çifti kullanan noktalara eklenebilir.');
        (error as Error & { field: string }).field = 'tollPointId';
        throw error;
      }

      const existingRows = await tx.select({
        id: tollTariffs.id,
        entryGateName: tollTariffs.entryGateName,
        exitGateName: tollTariffs.exitGateName,
        vehicleClass: tollTariffs.vehicleClass,
        timeBand: tollTariffs.timeBand,
      }).from(tollTariffs).where(and(
        eq(tollTariffs.tollPointId, payload.data.tollPointId),
        eq(tollTariffs.vehicleClass, payload.data.vehicleClass),
        eq(tollTariffs.active, true),
      ));
      const duplicate = existingRows.some((row) => quickTariffIdentity({
        tollPointId: payload.data.tollPointId,
        entryGateName: row.entryGateName ?? '',
        exitGateName: row.exitGateName ?? '',
        vehicleClass: row.vehicleClass,
        timeBand: row.timeBand,
      }) === identity);
      if (duplicate) throw new Error(DUPLICATE_ERROR);
      await assertNoActiveTariffOverlap({
        tollPointId: payload.data.tollPointId,
        vehicleClass: payload.data.vehicleClass,
        timeBand: payload.data.timeBand,
        validFrom,
        validUntil: null,
        entryGateName,
        exitGateName,
      }, tx);

      const [created] = await tx.insert(tollTariffs).values({
        tollPointId: payload.data.tollPointId,
        vehicleClass: payload.data.vehicleClass,
        displayOrder: (await tx.select({ displayOrder: tollTariffs.displayOrder })
          .from(tollTariffs)
          .where(and(
            eq(tollTariffs.tollPointId, payload.data.tollPointId),
            eq(tollTariffs.vehicleClass, payload.data.vehicleClass),
          ))).reduce((max, row) => Math.max(max, row.displayOrder), -1) + 1,
        timeBand: payload.data.timeBand,
        appliesDay: tollTimeBandFlags(payload.data.timeBand).appliesDay,
        appliesNight: tollTimeBandFlags(payload.data.timeBand).appliesNight,
        amountKurus,
        automaticAmountKurus: null,
        manualAmountKurus: amountKurus,
        sourceName: 'Manuel hızlı tarife girişi',
        sourceUrl: null,
        sourceVerified: false,
        sourceFetchedAt: null,
        manualUpdatedAt: now,
        validFrom,
        validUntil: null,
        queriedAt: null,
        active: true,
        entryGateName,
        exitGateName,
        direction: null,
        createdAt: now,
        updatedAt: now,
        createdBy: session.adminId,
        updatedBy: session.adminId,
      }).returning();
      return created;
    });

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'CREATE',
      entityType: 'TollTariff',
      entityId: tariff.id,
      metadata: { tollPointId: tariff.tollPointId, vehicleClass: tariff.vehicleClass, timeBand: tariff.timeBand, sourceName: tariff.sourceName },
    }).catch(() => {});
    return NextResponse.json({ tariff }, { status: 201 });
  } catch (error) {
    const field = error instanceof Error && 'field' in error
      ? String((error as Error & { field?: string }).field)
      : '_general';
    const knownMessage = error instanceof Error
      && (field !== '_general' || error.message === DUPLICATE_ERROR);
    if (!knownMessage) console.error('[quick-tariff] create failed', error);
    const message = knownMessage && error instanceof Error
      ? error.message
      : 'Hızlı tarife kaydedilemedi.';
    return validationResponse(message, { [field]: message });
  }
}