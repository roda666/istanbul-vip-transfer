import { NextResponse } from 'next/server';
import { auditLogs } from '@/db/schema';
import { db } from '@/db';
import { runGoogleBusinessReviewSync } from '@/lib/google-business-review-scheduler';
import { requireSocialPlatformAdmin, socialAuthErrorResponse } from '@/lib/social-auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  let session;
  try { session = await requireSocialPlatformAdmin(); }
  catch (error) {
    const response = socialAuthErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
  try {
    const result = await runGoogleBusinessReviewSync({ source: 'manual', requireEnabled: false });
    if (result.status !== 'complete') {
      return NextResponse.json({ error: 'Google yorumları senkronlanamadı.', status: result.status }, { status: 503 });
    }
    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'GOOGLE_BUSINESS_REVIEWS_SYNCED',
      entityType: 'social_platform',
      entityId: 'google_business',
      metadata: { received: result.received, upserted: result.upserted, skipped: result.skipped },
    });
    return NextResponse.json({ result });
  } catch {
    return NextResponse.json(
      { error: 'Google yorumları senkronlanamadı.' },
      { status: 503 },
    );
  }
}