/**
 * POST /admin/api/google-ads/disconnect
 * Removes stored Google Ads tokens from the DB.
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  try {
    const { disconnectGoogleAds } = await import('@/lib/google-ads');
    await disconnectGoogleAds();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[google-ads/disconnect]', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
