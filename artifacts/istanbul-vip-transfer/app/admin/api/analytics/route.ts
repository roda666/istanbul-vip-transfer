/**
 * GET /admin/api/analytics
 *
 * Returns aggregated statistics from the DB for the admin dashboard:
 * - Daily reservation requests for the last 30 days
 * - Requests grouped by locale
 * - Requests grouped by service type
 * - Newsletter subscriber counts by status
 * - Summary totals
 *
 * Uses raw SQL via Drizzle's db.execute() which returns rows as a plain array.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { requireAdminSession } = await import('@/lib/auth/session');
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await import('@/db');
    const { sql } = await import('drizzle-orm');

    // db.execute(sql`...`) returns the rows array directly in Drizzle + postgres-js
    const [daily, byLocale, byService, byNewsletterStatus, totalsArr] = await Promise.all([

      // Daily requests — last 30 days
      db.execute(sql`
        SELECT
          DATE_TRUNC('day', created_at AT TIME ZONE 'Europe/Istanbul')::date AS day,
          COUNT(*)::int AS count
        FROM reservation_requests
        WHERE created_at >= NOW() - INTERVAL '30 days'
          AND archived_at IS NULL
        GROUP BY 1
        ORDER BY 1
      `),

      // By locale — last 90 days
      db.execute(sql`
        SELECT locale, COUNT(*)::int AS count
        FROM reservation_requests
        WHERE created_at >= NOW() - INTERVAL '90 days'
          AND archived_at IS NULL
        GROUP BY locale
        ORDER BY count DESC
        LIMIT 10
      `),

      // By service type — last 90 days
      db.execute(sql`
        SELECT service_type, COUNT(*)::int AS count
        FROM reservation_requests
        WHERE created_at >= NOW() - INTERVAL '90 days'
          AND archived_at IS NULL
        GROUP BY service_type
        ORDER BY count DESC
      `),

      // Newsletter subscribers by status
      db.execute(sql`
        SELECT status, COUNT(*)::int AS count
        FROM newsletter_subscribers
        GROUP BY status
        ORDER BY count DESC
      `),

      // Totals
      db.execute(sql`
        SELECT
          COUNT(*)                                                        AS total_all_time,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS total_30d,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')  AS total_7d,
          COUNT(*) FILTER (WHERE status = 'CONFIRMED')                     AS confirmed,
          COUNT(*) FILTER (WHERE status = 'COMPLETED')                     AS completed
        FROM reservation_requests
        WHERE archived_at IS NULL
      `),
    ]);

    // Drizzle postgres-js driver: execute() returns the array directly
    const toArr = (r: unknown) => Array.isArray(r) ? r : [];

    return NextResponse.json({
      daily:              toArr(daily),
      byLocale:           toArr(byLocale),
      byService:          toArr(byService),
      byNewsletterStatus: toArr(byNewsletterStatus),
      totals:             toArr(totalsArr)[0] ?? {},
    });
  } catch (err) {
    console.error('[admin/analytics] error:', (err as Error)?.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
}
