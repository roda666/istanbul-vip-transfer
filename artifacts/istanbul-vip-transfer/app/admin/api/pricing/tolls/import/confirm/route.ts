import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs, tollPoints, tollTariffs, tollTariffImports } from '@/db/schema';
import { requireAdminSession } from '@/lib/auth/session';
import { hashPreview } from '@/lib/toll-tariff-import';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let session;
  try { session = await requireAdminSession(); } catch (error) {
    const status = (error as { status?: number }).status === 403 ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? 'Forbidden' : 'Unauthorized' }, { status });
  }
  const body = await request.json().catch(() => null) as { importId?: string; previewHash?: string; tollPointId?: string; confirm?: boolean } | null;
  if (!body?.importId || !body.previewHash || body.confirm !== true) return NextResponse.json({ error: 'Önizleme özeti ve açık onay zorunludur.' }, { status: 422 });
  const importId = body.importId;
  const previewHash = body.previewHash;
  try {
    const result = await db.transaction(async tx => {
      const [imp] = await tx.select().from(tollTariffImports).where(and(
        eq(tollTariffImports.id, importId),
        eq(tollTariffImports.createdBy, session.adminId),
        ...(body.tollPointId ? [eq(tollTariffImports.tollPointId, body.tollPointId)] : []),
      )).limit(1);
      if (!imp) throw new Error('İçe aktarma önizlemesi bulunamadı.');
      if (imp.previewHash !== previewHash || hashPreview(imp.previewJson) !== previewHash) throw new Error('Önizleme değişmiş veya özeti geçersiz.');
       if (imp.status === 'CONFIRMED') return { imported: 0, skipped: [], alreadyConfirmed: true };
      const [claimed] = await tx.update(tollTariffImports).set({ status: 'CONFIRMING' })
        .where(and(eq(tollTariffImports.id, imp.id), eq(tollTariffImports.createdBy, session.adminId), eq(tollTariffImports.tollPointId, imp.tollPointId), eq(tollTariffImports.status, 'PREVIEW'))).returning();
      if (!claimed) {
        const [current] = await tx.select({ status: tollTariffImports.status }).from(tollTariffImports).where(eq(tollTariffImports.id, imp.id)).limit(1);
        if (current?.status === 'CONFIRMED') return { imported: 0, skipped: [], alreadyConfirmed: true };
        throw new Error('İçe aktarma başka bir onay işlemi tarafından yürütülüyor.');
      }
      const [point] = await tx.select({ id: tollPoints.id, pricingMode: tollPoints.pricingMode }).from(tollPoints).where(eq(tollPoints.id, imp.tollPointId)).limit(1);
      if (!point || point.pricingMode === 'GATE_PAIR') throw new Error('Giriş/çıkış gişesi gerektiren noktalar bu içe aktarmayı desteklemez.');
      const preview = imp.previewJson as { rows?: Array<{ classNumber: number; status: string; amountKurus: number | null }>; effectiveDate?: string };
      const rows = Array.isArray(preview.rows) ? preview.rows : [];
      const resolved = rows.filter(r => r.status === 'RESOLVED' && Number.isInteger(r.classNumber) && r.classNumber >= 1 && r.classNumber <= 6 && Number.isInteger(r.amountKurus) && (r.amountKurus as number) > 0);
      const skipped = [1, 2, 3, 4, 5, 6].filter(c => !resolved.some(r => r.classNumber === c));
      for (const row of resolved) {
        const vehicleClass = `class_${row.classNumber}`;
        await tx.update(tollTariffs).set({ active: false, updatedAt: new Date(), updatedBy: session.adminId }).where(and(eq(tollTariffs.tollPointId, imp.tollPointId), eq(tollTariffs.vehicleClass, vehicleClass), eq(tollTariffs.active, true)));
        await tx.insert(tollTariffs).values({
          tollPointId: imp.tollPointId, vehicleClass, amountKurus: row.amountKurus, manualAmountKurus: row.amountKurus,
          sourceName: `${imp.originalFilename.slice(0, 180)} — ${new Date(imp.effectiveDate ?? preview.effectiveDate!).toISOString().slice(0, 10)}`,
          sourceVerified: false, timeBand: 'ALL', appliesDay: true, appliesNight: true, validFrom: imp.effectiveDate,
          active: true, manualUpdatedAt: new Date(), createdBy: session.adminId, updatedBy: session.adminId,
        });
      }
      await tx.update(tollTariffImports).set({ status: 'CONFIRMED', confirmedBy: session.adminId, confirmedAt: new Date() }).where(eq(tollTariffImports.id, imp.id));
      await tx.insert(auditLogs).values({ adminUserId: session.adminId, action: 'TOLL_TARIFF_IMPORT_CONFIRMED', entityType: 'TollTariffImport', entityId: imp.id, metadata: { filename: imp.originalFilename.slice(0, 120), resolvedCount: resolved.length, skippedClasses: skipped.join(',') } });
      return { imported: resolved.length, skipped, alreadyConfirmed: false };
    });
    return NextResponse.json({ ...result, message: result.skipped.length ? `Çözülemeyen sınıflar atlandı: ${result.skipped.join(', ')}` : 'Tarifeler içe aktarıldı.' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'İçe aktarma onaylanamadı.' }, { status: 422 });
  }
}