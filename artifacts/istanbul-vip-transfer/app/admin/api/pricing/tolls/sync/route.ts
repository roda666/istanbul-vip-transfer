import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, tollTariffs } from '@/db/schema';
import { fetchSupportedOfficialTariff, isSupportedOfficialTariff, signTariffSyncPreview, verifyTariffSyncPreview } from '@/lib/toll-tariff-sync';

export const dynamic = 'force-dynamic';

const actionSchema = z.object({
  action: z.enum(['preview', 'apply']),
  tollTariffId: z.string().uuid(),
  confirmationText: z.string().max(80).optional(),
  previewToken: z.string().min(20).max(4000).optional(),
});

/**
 * Only explicitly coded official adapters may appear here. The map starts empty
 * intentionally: an admin-supplied URL must never become an arbitrary server
 * fetch target. Add a provider only after its official endpoint, parser and
 * response validation have been reviewed.
 */
/** POST /admin/api/pricing/tolls/sync — safe preview/apply gate for future official adapters. */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = actionSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) return NextResponse.json({ error: 'Geçersiz senkronizasyon isteği.' }, { status: 422 });
  const [tariff] = await db.select().from(tollTariffs).where(eq(tollTariffs.id, payload.data.tollTariffId)).limit(1);
  if (!tariff) return NextResponse.json({ error: 'Geçiş tarifesi bulunamadı.' }, { status: 404 });
  if (!tariff.sourceVerified || !tariff.sourceName || !tariff.sourceUrl) {
    return NextResponse.json({ error: 'Bu tarife için doğrulanmış resmî kaynak bulunmuyor; manuel değer kullanılmaya devam eder.' }, { status: 422 });
  }
  if (payload.data.action === 'apply' && (payload.data.confirmationText !== 'TARİFEYİ UYGULA' || !payload.data.previewToken)) {
    return NextResponse.json({ error: 'Kaynak değerini uygulamak için “TARİFEYİ UYGULA” onayı gereklidir.' }, { status: 422 });
  }
  if (!isSupportedOfficialTariff(tariff)) {
    const errorMessage = 'Bu resmî kaynak için doğrulanmış bir senkronizasyon adaptörü henüz tanımlı değil. URL’ye istek atılmadı; manuel override güvenle kullanılabilir.';
    return NextResponse.json({ error: errorMessage, safeBlocked: true }, { status: 422 });
  }
  try {
    if (payload.data.action === 'preview') {
      const synced = await fetchSupportedOfficialTariff(tariff);
      return NextResponse.json({
        ...synced,
        fetchedAt: synced.fetchedAt.toISOString(),
        queriedAt: synced.queriedAt.toISOString(),
        newAmountKurus: synced.amountKurus,
        requiresConfirmation: true,
        previewToken: await signTariffSyncPreview({ ...synced, tariffId: tariff.id }),
      });
    }
    const synced = await verifyTariffSyncPreview(payload.data.previewToken!, tariff.id);
    const fetchedAt = new Date(synced.fetchedAt);
    const queriedAt = new Date(synced.queriedAt);
    const [updated] = await db.update(tollTariffs).set({
      automaticAmountKurus: synced.amountKurus,
      // Manual overrides always remain the effective customer-facing amount.
      amountKurus: tariff.manualAmountKurus ?? synced.amountKurus,
      sourceName: synced.sourceName,
      sourceUrl: synced.sourceUrl,
      sourceVerified: true,
      sourceFetchedAt: fetchedAt,
      validFrom: null,
      queriedAt,
      lastSyncError: null,
      updatedAt: new Date(),
      updatedBy: session.adminId,
    }).where(eq(tollTariffs.id, tariff.id)).returning();
    await db.insert(auditLogs).values({
      adminUserId: session.adminId, action: 'SYNC_APPLY', entityType: 'TollTariff', entityId: tariff.id,
      metadata: { sourceUrl: synced.sourceUrl, fetchedAt: synced.fetchedAt, queriedAt: synced.queriedAt, automaticAmountKurus: synced.amountKurus, manualOverridePreserved: tariff.manualAmountKurus != null },
    }).catch(() => {});
    return NextResponse.json({ tariff: updated, applied: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Resmî tarife senkronizasyonu başarısız oldu; manuel override kullanılabilir.' }, { status: 422 });
  }
}