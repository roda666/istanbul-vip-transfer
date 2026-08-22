import { NextResponse } from 'next/server';
import { getHomepageTransferRoutes } from '@/lib/transfer-route-pages';

/**
 * Public endpoint for homepage "Popüler Transfer Bölgeleri" section.
 * GET /data/transfer-routes
 * Returns active routes ordered by display_order.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ routes: await getHomepageTransferRoutes() });
  } catch (err) {
    console.error('transfer-routes public endpoint error:', err);
    return NextResponse.json({ routes: [] }, { status: 200 });
  }
}
