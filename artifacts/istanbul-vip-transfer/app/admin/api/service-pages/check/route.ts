/**
 * POST /admin/api/service-pages/check
 *
 * Manually triggers one health-check cycle (same logic as the scheduler) and
 * returns the result. Useful for testing without waiting for the next scheduled
 * run, and for verifying email delivery.
 *
 * Requires an active admin session.
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { runServiceHealthCheck } from '@/lib/service-health-scheduler';
import 'server-only';

export async function POST() {
  try { await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await runServiceHealthCheck();
    return NextResponse.json({ ok: true, message: 'Health check complete — see server logs for details.' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
