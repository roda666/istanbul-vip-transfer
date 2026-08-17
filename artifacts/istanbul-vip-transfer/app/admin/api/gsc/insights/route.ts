/**
 * GET /admin/api/gsc/insights
 * Returns keyword opportunities from Google Search Console.
 * Requires GSC to be connected (tokens in DB).
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import 'server-only';

export const dynamic = 'force-dynamic';

export async function GET() {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { findKeywordOpportunities, isGscConnected } = await import('@/lib/gsc');

  const connected = await isGscConnected();
  if (!connected) {
    return NextResponse.json({ error: 'gsc_not_connected', opportunities: [] }, { status: 200 });
  }

  const result = await findKeywordOpportunities(20);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason, opportunities: [] }, { status: 200 });
  }

  return NextResponse.json({
    opportunities: result.opportunities,
    dataSource: result.dataSource,
    fetchedAt: new Date().toISOString(),
  });
}

/**
 * DELETE /admin/api/gsc/insights → disconnect GSC
 */
export async function DELETE() {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { disconnectGsc } = await import('@/lib/gsc');
  await disconnectGsc();
  return NextResponse.json({ ok: true });
}
