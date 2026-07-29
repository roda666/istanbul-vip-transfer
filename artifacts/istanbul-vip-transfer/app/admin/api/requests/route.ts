/**
 * GET /admin/api/requests — Paginated list of reservation requests (admin-only).
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Auth check
  const { getSession } = await import('@/lib/auth/session');
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const page      = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit     = 25;
  const offset    = (page - 1) * limit;
  const search    = searchParams.get('search')?.trim() ?? '';
  const status    = searchParams.get('status') ?? '';
  const service   = searchParams.get('service') ?? '';
  const intent    = searchParams.get('intent') ?? '';
  const lang      = searchParams.get('lang') ?? '';
  const source    = searchParams.get('source') ?? '';
  const dateFrom  = searchParams.get('date_from') ?? '';
  const dateTo    = searchParams.get('date_to') ?? '';

  try {
    const { db } = await import('@/db');
    const { reservationRequests } = await import('@/db/schema');
    const { desc, eq, ilike, or, and, count, isNull, gte, lte } = await import('drizzle-orm');

    const conditions = [isNull(reservationRequests.archivedAt)];
    if (status)  conditions.push(eq(reservationRequests.status,      status as never));
    if (service) conditions.push(eq(reservationRequests.serviceType, service));
    if (intent)  conditions.push(eq(reservationRequests.intent,      intent as never));
    if (lang)    conditions.push(eq(reservationRequests.locale,      lang));
    if (source)  conditions.push(eq(reservationRequests.source,      source));
    if (dateFrom) conditions.push(gte(reservationRequests.createdAt, new Date(dateFrom)));
    if (dateTo) {
      // Include the entire end day
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(reservationRequests.createdAt, end));
    }
    if (search)  conditions.push(or(
      ilike(reservationRequests.referenceNumber, `%${search}%`),
      ilike(reservationRequests.name,            `%${search}%`),
      ilike(reservationRequests.phone,           `%${search}%`),
      ilike(reservationRequests.normalizedEmail, `%${search}%`),
    )!);

    const where = and(...conditions);

    const [rows, totals] = await Promise.all([
      db.select({
        id:              reservationRequests.id,
        referenceNumber: reservationRequests.referenceNumber,
        intent:          reservationRequests.intent,
        serviceType:     reservationRequests.serviceType,
        name:            reservationRequests.name,
        phone:           reservationRequests.phone,
        normalizedEmail: reservationRequests.normalizedEmail,
        locale:          reservationRequests.locale,
        source:          reservationRequests.source,
        status:          reservationRequests.status,
        createdAt:       reservationRequests.createdAt,
        archivedAt:      reservationRequests.archivedAt,
      }).from(reservationRequests).where(where).orderBy(desc(reservationRequests.createdAt)).limit(limit).offset(offset),
      db.select({ count: count() }).from(reservationRequests).where(where),
    ]);

    const total      = totals[0]?.count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({ rows, total, page, totalPages });
  } catch (err) {
    console.error('[admin/requests] list error:', (err as Error)?.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}
