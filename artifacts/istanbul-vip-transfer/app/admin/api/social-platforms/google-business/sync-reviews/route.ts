import { NextResponse } from 'next/server';
import { auditLogs } from '@/db/schema';
import { db } from '@/db';
import { syncGoogleBusinessReviews } from '@/lib/google-business';
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
    const result = await syncGoogleBusinessReviews();
    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'GOOGLE_BUSINESS_REVIEWS_SYNCED',
      entityType: 'social_platform',
      entityId: 'google_business',
      metadata: { received: result.received, upserted: result.upserted, skipped: result.skipped },
    });
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Google yorumları senkronlanamadı.' },
      { status: 503 },
    );
  }
}