import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { syncGoogleBusinessReviews } from '@/lib/google-business';

export const dynamic = 'force-dynamic';

/**
 * Hourly external scheduler target. It intentionally uses the existing Google
 * OAuth refresh/sync flow and a separate bearer secret, never an admin cookie.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured.' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await syncGoogleBusinessReviews({ requireEnabled: true, source: 'scheduled' });
    await db.insert(auditLogs).values({
      action: 'GOOGLE_BUSINESS_REVIEWS_AUTO_SYNCED',
      entityType: 'social_platform',
      entityId: 'google_business',
      metadata: { received: result.received, upserted: result.upserted, skipped: result.skipped },
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    // A disconnected or disabled account is a visible, safe skip; it should
    // not turn every hourly invocation into a noisy failing scheduler job.
    const message = error instanceof Error ? error.message : 'Google yorumları senkronlanamadı.';
    if (/bağlantısı tamamlanmamış|kanalı pasif|işletme konumu seçilmeli/.test(message)) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'disconnected_or_unconfigured' });
    }
    return NextResponse.json({ error: 'Google yorumları senkronlanamadı.' }, { status: 503 });
  }
}