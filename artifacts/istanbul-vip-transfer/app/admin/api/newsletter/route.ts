/**
 * GET /admin/api/newsletter — Paginated list of newsletter subscribers (admin-only).
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { getSession } = await import('@/lib/auth/session');
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit  = 25;
  const offset = (page - 1) * limit;
  const status = searchParams.get('status') ?? '';
  const lang   = searchParams.get('lang') ?? '';
  const search = searchParams.get('search')?.trim() ?? '';
  const source = searchParams.get('source')?.trim() ?? '';

  try {
    const { db } = await import('@/db');
    const { newsletterSubscribers, newsletterConsentEvents } = await import('@/db/schema');
    const { desc, eq, and, count, ilike } = await import('drizzle-orm');

    const conditions = [];
    if (status) conditions.push(eq(newsletterSubscribers.status, status as never));
    if (lang)   conditions.push(eq(newsletterSubscribers.preferredLanguage, lang));
    if (source) conditions.push(ilike(newsletterSubscribers.source, `%${source}%`));
    if (search) conditions.push(ilike(newsletterSubscribers.normalizedEmail, `%${search}%`));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, totals] = await Promise.all([
      db.select({
        id:                newsletterSubscribers.id,
        normalizedEmail:   newsletterSubscribers.normalizedEmail,
        name:              newsletterSubscribers.name,
        preferredLanguage: newsletterSubscribers.preferredLanguage,
        status:            newsletterSubscribers.status,
        source:            newsletterSubscribers.source,
        createdAt:         newsletterSubscribers.createdAt,
      }).from(newsletterSubscribers).where(where).orderBy(desc(newsletterSubscribers.createdAt)).limit(limit).offset(offset),
      db.select({ count: count() }).from(newsletterSubscribers).where(where),
    ]);

    // Get latest consent event (action + date) for each subscriber
    const ids = rows.map((r) => r.id);
    const consentMap: Record<string, { version: string; action: string; date: string }> = {};
    if (ids.length > 0) {
      const events = await db
        .select({
          subscriberId:  newsletterConsentEvents.subscriberId,
          version:       newsletterConsentEvents.consentTextVersion,
          action:        newsletterConsentEvents.action,
          createdAt:     newsletterConsentEvents.createdAt,
        })
        .from(newsletterConsentEvents)
        .orderBy(desc(newsletterConsentEvents.createdAt));

      for (const ev of events) {
        if (ev.subscriberId && !consentMap[ev.subscriberId]) {
          consentMap[ev.subscriberId] = {
            version: ev.version,
            action:  ev.action,
            date:    ev.createdAt.toISOString(),
          };
        }
      }
    }

    const rowsWithConsent = rows.map((r) => ({
      ...r,
      consentVersion: consentMap[r.id]?.version ?? null,
      consentAction:  consentMap[r.id]?.action  ?? null,
      consentDate:    consentMap[r.id]?.date     ?? null,
    }));

    const total      = totals[0]?.count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({ rows: rowsWithConsent, total, page, totalPages });
  } catch (err) {
    console.error('[admin/newsletter] list error:', (err as Error)?.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}
