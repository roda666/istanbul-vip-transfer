import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, tollPoints, tollTariffs } from '@/db/schema';
import {
  assertNoActiveTariffOverlap,
  assertPricingModeMatchesGatePair,
  assertTollDateRange,
  assertVerifiedSourceForAmount,
  effectiveTollAmount,
  isOfficialTollSourceUrl,
  parseTollDate,
  safeOfficialSourceUrl,
  tollTimeBandFlags,
} from '@/lib/toll-management';
import { tollTariffInputSchema } from '@/lib/toll-input';

export const dynamic = 'force-dynamic';

/** PATCH /admin/api/pricing/tolls/tariffs/[id] — edit a class tariff or deactivate it. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const payload = tollTariffInputSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? 'Geçersiz geçiş tarifesi.' }, { status: 422 });
  }
  try {
    const [[existing], [point]] = await Promise.all([
      db.select().from(tollTariffs).where(eq(tollTariffs.id, id)).limit(1),
      db.select({ id: tollPoints.id, pricingMode: tollPoints.pricingMode }).from(tollPoints).where(eq(tollPoints.id, payload.data.tollPointId)).limit(1),
    ]);
    if (!existing) return NextResponse.json({ error: 'Geçiş tarifesi bulunamadı.' }, { status: 404 });
    if (!point) return NextResponse.json({ error: 'Geçiş noktası bulunamadı.' }, { status: 404 });
    assertPricingModeMatchesGatePair(point.pricingMode, payload.data.entryGateName, payload.data.exitGateName);
    const validFrom = parseTollDate(payload.data.validFrom);
    const validUntil = parseTollDate(payload.data.validUntil);
    assertTollDateRange(validFrom, validUntil);
    const sourceUrl = safeOfficialSourceUrl(payload.data.sourceUrl);
    const amountKurus = effectiveTollAmount(payload.data);
    assertVerifiedSourceForAmount(amountKurus, sourceUrl);
    const sourceVerified = isOfficialTollSourceUrl(sourceUrl);
    const { appliesDay, appliesNight } = tollTimeBandFlags(payload.data.timeBand);
    if (payload.data.active) {
      await assertNoActiveTariffOverlap({
        tollPointId: payload.data.tollPointId,
        vehicleClass: payload.data.vehicleClass,
        timeBand: payload.data.timeBand,
        validFrom,
        validUntil,
        excludeId: id,
        entryGateName: payload.data.entryGateName ?? null,
        exitGateName: payload.data.exitGateName ?? null,
      });
    }
    const now = new Date();
    const [tariff] = await db.update(tollTariffs).set({
      tollPointId: payload.data.tollPointId,
      vehicleClass: payload.data.vehicleClass,
      timeBand: payload.data.timeBand,
      appliesDay,
      appliesNight,
      amountKurus,
      automaticAmountKurus: payload.data.automaticAmountKurus ?? null,
      manualAmountKurus: payload.data.manualAmountKurus ?? null,
      sourceName: payload.data.sourceName?.trim() || null,
      sourceUrl,
      sourceVerified,
      sourceFetchedAt: payload.data.automaticAmountKurus !== existing.automaticAmountKurus ? now : existing.sourceFetchedAt,
      manualUpdatedAt: payload.data.manualAmountKurus !== existing.manualAmountKurus ? now : existing.manualUpdatedAt,
      validFrom,
      validUntil,
      queriedAt: parseTollDate(payload.data.queriedAt),
      active: payload.data.active,
      entryGateName: payload.data.entryGateName ?? null,
      exitGateName: payload.data.exitGateName ?? null,
      direction: payload.data.direction ?? null,
      updatedAt: now,
      updatedBy: session.adminId,
    }).where(eq(tollTariffs.id, id)).returning();
    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: tariff.active ? 'UPDATE' : 'DEACTIVATE',
      entityType: 'TollTariff',
      entityId: tariff.id,
      metadata: { tollPointId: tariff.tollPointId, vehicleClass: tariff.vehicleClass, timeBand: tariff.timeBand, active: tariff.active, sourceVerified: tariff.sourceVerified },
    }).catch(() => {});
    return NextResponse.json({ tariff });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Geçiş tarifesi güncellenemedi.' }, { status: 422 });
  }
}