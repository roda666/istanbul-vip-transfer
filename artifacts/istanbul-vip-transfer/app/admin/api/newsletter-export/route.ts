/**
 * GET /admin/api/newsletter-export
 * Downloads active (consented) newsletter subscribers as CSV.
 * Only exports PENDING and ACTIVE subscribers — never UNSUBSCRIBED.
 */
import { NextResponse } from 'next/server';
import { formatSource } from '@/lib/source-labels';

export const dynamic = 'force-dynamic';

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  const { getSession } = await import('@/lib/auth/session');
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { db } = await import('@/db');
    const { newsletterSubscribers, newsletterConsentEvents } = await import('@/db/schema');
    const { inArray, eq, desc } = await import('drizzle-orm');

    const subs = await db.select({
      id:                newsletterSubscribers.id,
      normalizedEmail:   newsletterSubscribers.normalizedEmail,
      name:              newsletterSubscribers.name,
      preferredLanguage: newsletterSubscribers.preferredLanguage,
      status:            newsletterSubscribers.status,
      source:            newsletterSubscribers.source,
      createdAt:         newsletterSubscribers.createdAt,
    }).from(newsletterSubscribers)
      .where(inArray(newsletterSubscribers.status, ['PENDING', 'ACTIVE']));

    // Get latest consent version for each
    const ids = subs.map((s) => s.id);
    const consentMap: Record<string, string> = {};
    if (ids.length > 0) {
      const events = await db.select({
        subscriberId: newsletterConsentEvents.subscriberId,
        version:      newsletterConsentEvents.consentTextVersion,
      }).from(newsletterConsentEvents)
        .where(eq(newsletterConsentEvents.action, 'GRANTED'))
        .orderBy(desc(newsletterConsentEvents.createdAt));
      for (const ev of events) {
        if (ev.subscriberId && !consentMap[ev.subscriberId]) {
          consentMap[ev.subscriberId] = ev.version;
        }
      }
    }

    const header = 'email,name,language,status,source,source_label,consent_version,created_at\n';
    const csvRows = subs.map((s) =>
      [
        escapeCsv(s.normalizedEmail),
        escapeCsv(s.name),
        escapeCsv(s.preferredLanguage),
        escapeCsv(s.status),
        escapeCsv(s.source),
        escapeCsv(formatSource(s.source)),
        escapeCsv(consentMap[s.id] ?? ''),
        escapeCsv(new Date(s.createdAt).toISOString()),
      ].join(',')
    ).join('\n');

    const csv = '\uFEFF' + header + csvRows; // BOM for Excel compatibility

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="bulten-aboneleri-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[newsletter-export] error:', (err as Error)?.message);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
