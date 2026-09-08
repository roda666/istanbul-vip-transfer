import { NextRequest, NextResponse } from 'next/server';
import { requestsToExcel, requestsToPdf, requestExportFileName } from '@/lib/admin-request-export';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { getSession } = await import('@/lib/auth/session');
  const session = await getSession();
  if (!session.isLoggedIn || !['SUPER_ADMIN', 'ADMIN'].includes(session.role)) {
    return NextResponse.json({ error: 'Bu işlem için yönetici yetkisi gerekir.' }, { status: session.isLoggedIn ? 403 : 401 });
  }
  const format = req.nextUrl.searchParams.get('format');
  if (format !== 'xls' && format !== 'pdf') return NextResponse.json({ error: 'Geçersiz dışa aktarma biçimi.' }, { status: 422 });

  try {
    const { db } = await import('@/db');
    const { reservationRequests } = await import('@/db/schema');
    const { and, eq, gte, ilike, inArray, isNull, lte, or, desc } = await import('drizzle-orm');
    const p = req.nextUrl.searchParams;
    const conditions = [isNull(reservationRequests.archivedAt)];
    const ids = p.get('ids')?.split(',').map(value => value.trim()).filter(Boolean).slice(0, 1000) ?? [];
    if (ids.length) conditions.push(inArray(reservationRequests.id, ids));
    const search = p.get('search')?.trim();
    const testData = p.get('test_data');
    if (testData === 'real') conditions.push(eq(reservationRequests.isTestData, false));
    if (testData === 'test') conditions.push(eq(reservationRequests.isTestData, true));
    for (const [param, column] of [['status', reservationRequests.status], ['service', reservationRequests.serviceType], ['intent', reservationRequests.intent], ['lang', reservationRequests.locale], ['source', reservationRequests.source]] as const) {
      const value = p.get(param);
      if (value) conditions.push(eq(column, value as never));
    }
    if (p.get('date_from')) conditions.push(gte(reservationRequests.createdAt, new Date(p.get('date_from')!)));
    if (p.get('date_to')) { const end = new Date(p.get('date_to')!); end.setHours(23, 59, 59, 999); conditions.push(lte(reservationRequests.createdAt, end)); }
    if (search) conditions.push(or(ilike(reservationRequests.referenceNumber, `%${search}%`), ilike(reservationRequests.name, `%${search}%`), ilike(reservationRequests.phone, `%${search}%`), ilike(reservationRequests.normalizedEmail, `%${search}%`))!);
    const rows = await db.select({
      referenceNumber: reservationRequests.referenceNumber, name: reservationRequests.name, phone: reservationRequests.phone,
      normalizedEmail: reservationRequests.normalizedEmail, locale: reservationRequests.locale, source: reservationRequests.source,
      serviceType: reservationRequests.serviceType, intent: reservationRequests.intent,
      status: reservationRequests.status, createdAt: reservationRequests.createdAt,
      requestData: reservationRequests.requestData, adminNotes: reservationRequests.adminNotes,
    }).from(reservationRequests).where(and(...conditions)).orderBy(desc(reservationRequests.createdAt));
    const detailed = ids.length === 1;
    const body = format === 'xls' ? requestsToExcel(rows, detailed) : requestsToPdf(rows, detailed);
    return new NextResponse(body, { headers: {
      'Content-Type': format === 'xls' ? 'application/vnd.ms-excel; charset=utf-8' : 'application/pdf',
      'Content-Disposition': `attachment; filename="${requestExportFileName(format)}"`,
      'Cache-Control': 'no-store',
    } });
  } catch (error) {
    console.error('[admin/requests/export] error:', (error as Error).message);
    return NextResponse.json({ error: 'Dışa aktarma hazırlanamadı.' }, { status: 500 });
  }
}