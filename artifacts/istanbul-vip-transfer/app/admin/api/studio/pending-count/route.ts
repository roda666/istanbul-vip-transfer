/**
 * GET /admin/api/studio/pending-count
 * Returns the number of studio projects in 'draft' status awaiting admin approval.
 * Used by AdminSidebar to show a numeric badge.
 * Returns 0 on auth failure — never exposes a 401 to the sidebar poll.
 */
import { NextResponse } from 'next/server';
import 'server-only';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { requireAdminSession } = await import('@/lib/auth/session');
    await requireAdminSession();

    const { db } = await import('@/db');
    const { studioProjects } = await import('@/db/schema');
    const { eq, count } = await import('drizzle-orm');

    const [row] = await db
      .select({ count: count() })
      .from(studioProjects)
      .where(eq(studioProjects.status, 'draft'));

    return NextResponse.json({ count: row?.count ?? 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
