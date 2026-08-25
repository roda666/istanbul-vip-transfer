import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs, tollTariffs } from '@/db/schema';

export const dynamic = 'force-dynamic';

const actionSchema = z.object({
  action: z.enum(['preview', 'apply']),
  tollTariffId: z.string().uuid(),
  confirmationText: z.string().max(80).optional(),
});

/**
 * Only explicitly coded official adapters may appear here. The map starts empty
 * intentionally: an admin-supplied URL must never become an arbitrary server
 * fetch target. Add a provider only after its official endpoint, parser and
 * response validation have been reviewed.
 */
const OFFICIAL_TOLL_SOURCE_ADAPTERS: Readonly<Record<string, never>> = {};

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
  if (payload.data.action === 'apply' && payload.data.confirmationText !== 'TARİFEYİ UYGULA') {
    return NextResponse.json({ error: 'Kaynak değerini uygulamak için “TARİFEYİ UYGULA” onayı gereklidir.' }, { status: 422 });
  }
  let hostname = '';
  try {
    hostname = new URL(tariff.sourceUrl).hostname.toLowerCase();
  } catch {
    hostname = '';
  }
  if (!hostname || !(hostname in OFFICIAL_TOLL_SOURCE_ADAPTERS)) {
    const errorMessage = 'Bu resmî kaynak için doğrulanmış bir senkronizasyon adaptörü henüz tanımlı değil. URL’ye istek atılmadı; manuel override güvenle kullanılabilir.';
    await db.update(tollTariffs).set({ lastSyncError: errorMessage, updatedAt: new Date(), updatedBy: session.adminId })
      .where(eq(tollTariffs.id, tariff.id));
    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'SYNC_BLOCKED',
      entityType: 'TollTariff',
      entityId: tariff.id,
      metadata: { reason: 'NO_VERIFIED_ADAPTER', sourceName: tariff.sourceName },
    }).catch(() => {});
    return NextResponse.json({ error: errorMessage, safeBlocked: true }, { status: 422 });
  }
  return NextResponse.json({ error: 'Senkronizasyon adaptörü hazırlanıyor.' }, { status: 503 });
}