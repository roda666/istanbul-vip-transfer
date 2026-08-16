import { NextResponse } from 'next/server';

/**
 * Public endpoint for homepage "Popüler Transfer Bölgeleri" section.
 * GET /data/transfer-routes
 * Returns active routes ordered by display_order.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { db } = await import('@/db');
    const { transferRoutes } = await import('@/db/schema');
    const { eq, asc } = await import('drizzle-orm');

    const rows = await db
      .select()
      .from(transferRoutes)
      .where(eq(transferRoutes.active, true))
      .orderBy(asc(transferRoutes.displayOrder));

    return NextResponse.json({ routes: rows });
  } catch (err) {
    console.error('transfer-routes public endpoint error:', err);
    return NextResponse.json({ routes: [] }, { status: 200 });
  }
}
