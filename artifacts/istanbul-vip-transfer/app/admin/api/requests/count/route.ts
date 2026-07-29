/**
 * GET /admin/api/requests/count
 * Returns the count of NEW (unarchived) reservation requests for the sidebar badge.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { getSession } = await import('@/lib/auth/session');
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ count: 0 }, { status: 401 });

  try {
    const { db } = await import('@/db');
    const { reservationRequests } = await import('@/db/schema');
    const { eq, isNull, and, count } = await import('drizzle-orm');

    const [result] = await db
      .select({ count: count() })
      .from(reservationRequests)
      .where(and(
        eq(reservationRequests.status, 'NEW'),
        isNull(reservationRequests.archivedAt),
      ));

    return NextResponse.json({ count: result?.count ?? 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
