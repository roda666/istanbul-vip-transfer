import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { tollPoints, tollTariffImports } from '@/db/schema';
import { requireAdminSession } from '@/lib/auth/session';
import { hashPreview, MAX_IMPORT_BYTES, parseStrictImportDate, parseTollImport, validateImportFile, TOLL_IMPORT_PARSER_VERSION } from '@/lib/toll-tariff-import';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let session;
  try { session = await requireAdminSession(); } catch (error) {
    const status = (error as { status?: number }).status === 403 ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? 'Forbidden' : 'Unauthorized' }, { status });
  }
  try {
    const form = await request.formData();
    const file = form.get('file');
    const tollPointId = String(form.get('tollPointId') ?? '');
    const suppliedDate = String(form.get('effectiveDate') ?? '').trim();
    if (!(file instanceof File) || !tollPointId) return NextResponse.json({ error: 'Dosya ve geçiş noktası zorunludur.' }, { status: 422 });
    const [point] = await db.select({ id: tollPoints.id, pricingMode: tollPoints.pricingMode, verificationLocked: tollPoints.verificationLocked }).from(tollPoints).where(eq(tollPoints.id, tollPointId)).limit(1);
    if (!point) return NextResponse.json({ error: 'Geçiş noktası bulunamadı.' }, { status: 404 });
    if (point.verificationLocked) return NextResponse.json({ error: 'Bu nokta doğrulama kilidi altında; içe aktarma önizlemesi oluşturulamaz.' }, { status: 409 });
    if (point.pricingMode === 'GATE_PAIR') return NextResponse.json({ error: 'Giriş/çıkış gişesi gerektiren noktalar bu içe aktarmayı desteklemez.' }, { status: 422 });
    if (file.size > MAX_IMPORT_BYTES) throw new Error('Dosya boyutu izin verilen sınırı aşıyor (en fazla 8 MB).');
    const bytes = Buffer.from(await file.arrayBuffer());
    const extension = validateImportFile(file.name, file.type, bytes);
    const parsed = await parseTollImport(bytes, extension);
    const effectiveDate = suppliedDate ? parseStrictImportDate(suppliedDate) : parsed.effectiveDate;
    if (suppliedDate && !effectiveDate) return NextResponse.json({ error: 'Geçerlilik tarihi geçersiz.' }, { status: 422 });
    if (!effectiveDate) return NextResponse.json({ error: 'Belgede geçerlilik tarihi yok; yönetici tarihi belirtmelidir.' }, { status: 422 });
    const effectiveDateValue = new Date(effectiveDate);
    const previewJson = { parserVersion: TOLL_IMPORT_PARSER_VERSION, rows: parsed.rows, effectiveDate, evidenceText: parsed.evidenceText, cells: parsed.cells };
    const previewHash = hashPreview(previewJson);
    const [created] = await db.insert(tollTariffImports).values({
      originalFilename: file.name.slice(0, 255), tollPointId, effectiveDate: effectiveDateValue, previewJson, previewHash,
      parserVersion: TOLL_IMPORT_PARSER_VERSION, createdBy: session.adminId,
    }).onConflictDoNothing({ target: [tollTariffImports.previewHash, tollTariffImports.tollPointId, tollTariffImports.createdBy] }).returning();
    const row = created ?? (await db.select().from(tollTariffImports).where(and(
      eq(tollTariffImports.previewHash, previewHash), eq(tollTariffImports.tollPointId, tollPointId),
      eq(tollTariffImports.createdBy, session.adminId),
    )).limit(1))[0];
    if (!row) throw new Error('İçe aktarma önizlemesi kaydedilemedi.');
    return NextResponse.json({ importId: row.id, previewHash, originalFilename: row.originalFilename, effectiveDate, rows: parsed.rows, unresolvedClasses: parsed.rows.filter(r => r.status === 'UNRESOLVED').map(r => r.classNumber) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Belge işlenemedi.' }, { status: 422 });
  }
}