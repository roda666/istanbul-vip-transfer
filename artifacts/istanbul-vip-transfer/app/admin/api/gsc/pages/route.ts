/**
 * GET /admin/api/gsc/pages
 * Authenticated page-level Search Console analytics. Provider diagnostics are
 * intentionally not exposed to the browser.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import 'server-only';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const params = new URL(req.url).searchParams;
  const startDate = params.get('startDate');
  const endDate = params.get('endDate');
  const rawLimit = params.get('limit');
  if (!startDate || !endDate || (rawLimit !== null && !/^\d+$/.test(rawLimit))) {
    return NextResponse.json({ error: 'invalid_request', rows: [] }, { status: 400 });
  }

  const { fetchPageSearchAnalytics } = await import('@/lib/gsc');
  const result = await fetchPageSearchAnalytics({
    startDate,
    endDate,
    limit: rawLimit === null ? undefined : Number(rawLimit),
  });
  if (!result.ok) {
    const status = result.reason === 'invalid_date_range' || result.reason === 'invalid_limit' ? 400 : 200;
    return NextResponse.json({
      error: status === 400 ? 'invalid_request' : 'gsc_page_analytics_unavailable',
      rows: [],
    }, { status });
  }
  return NextResponse.json({ rows: result.rows, dataSource: 'gsc', fetchedAt: new Date().toISOString() });
}