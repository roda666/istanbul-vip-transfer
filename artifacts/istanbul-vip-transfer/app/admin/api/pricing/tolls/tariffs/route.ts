import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, tollPoints, tollTariffs } from '@/db/schema';
import {
  assertNoActiveTariffOverlap,
  assertTollDateRange,
  effectiveTollAmount,
  parseTollDate,
  safeOfficialSourceUrl,
} from '@/lib/toll-management';
import { tollTariffInputSchema } from '@/lib/toll-input';

export const dynamic = 'force-dynamic';

/** POST /admin/api/pricing/tolls/tariffs — create a date-bound class tariff. */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = tollTariffInputSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? 'Geçersiz geçiş tarifesi.' }, { status: 422 });
  }
  try {
    const [point] = await db.select({ id: tollPoints.id }).from(tollPoints)
      .where(eq(tollPoints.id, payload.data.tollPointId)).limit(1);
    if (!point) return NextResponse.json({ error: 'Geçiş noktası bulunamadı.' }, { status: 404 });
    const validFrom = parseTollDate(payload.data.validFrom);
    const validUntil = parseTollDate(payload.data.validUntil);
    assertTollDateRange(validFrom, validUntil);
    const sourceUrl = safeOfficialSourceUrl(payload.data.sourceUrl);
    const amountKurus = effectiveTollAmount(payload.data);
    if (!amountKurus) return NextResponse.json({ error: 'Etkili TRY tutarı bulunamadı.' }, { status: 422 });
    if (payload.data.active) {
      await assertNoActiveTariffOverlap({
        tollPointId: payload.data.tollPointId,
        vehicleClass: payload.data.vehicleClass,
        validFrom,
        validUntil,
      });
    }
    const now = new Date();
    const [tariff] = await db.insert(tollTariffs).values({
      tollPointId: payload.data.tollPointId,
      vehicleClass: payload.data.vehicleClass,
      amountKurus,
      automaticAmountKurus: payload.data.automaticAmountKurus ?? null,
      manualAmountKurus: payload.data.manualAmountKurus ?? null,
      sourceName: payload.data.sourceName?.trim() || null,
      sourceUrl,
      sourceVerified: payload.data.sourceVerified,
      sourceFetchedAt: payload.data.automaticAmountKurus != null ? now : null,
      manualUpdatedAt: payload.data.manualAmountKurus != null ? now : null,
      validFrom,
      validUntil,
      active: payload.data.active,
      createdAt: now,
      updatedAt: now,
      createdBy: session.adminId,
      updatedBy: session.adminId,
    }).returning();
    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'CREATE',
      entityType: 'TollTariff',
      entityId: tariff.id,
      metadata: { tollPointId: tariff.tollPointId, vehicleClass: tariff.vehicleClass, active: tariff.active, sourceVerified: tariff.sourceVerified },
    }).catch(() => {});
    return NextResponse.json({ tariff }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Geçiş tarifesi kaydedilemedi.' }, { status: 422 });
  }
}