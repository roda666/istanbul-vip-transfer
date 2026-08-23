import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auditLogs } from '@/db/schema';
import { db } from '@/db';
import { getGoogleBusinessLocationOptions, selectGoogleBusinessLocation } from '@/lib/google-business';
import { requireSocialPlatformAdmin, socialAuthErrorResponse } from '@/lib/social-auth';

export const dynamic = 'force-dynamic';

const selectionSchema = z.object({
  accountName: z.string().regex(/^accounts\/[^/]+$/),
  locationName: z.string().regex(/^accounts\/[^/]+\/locations\/[^/]+$/),
});

export async function GET() {
  try { await requireSocialPlatformAdmin(); }
  catch (error) {
    const response = socialAuthErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }

  try {
    return NextResponse.json({ locations: await getGoogleBusinessLocationOptions() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Google hesapları alınamadı.' },
      { status: 503 },
    );
  }
}

export async function PUT(req: NextRequest) {
  let session;
  try { session = await requireSocialPlatformAdmin(); }
  catch (error) {
    const response = socialAuthErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }
  const parsed = selectionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz Google hesap veya konum seçimi.' }, { status: 422 });

  try {
    const platform = await selectGoogleBusinessLocation(parsed.data);
    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'GOOGLE_BUSINESS_LOCATION_SELECTED',
      entityType: 'social_platform',
      entityId: 'google_business',
      metadata: { accountName: parsed.data.accountName, locationName: parsed.data.locationName },
    });
    return NextResponse.json({ platform });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Google Business Profile konumu seçilemedi.' },
      { status: 409 },
    );
  }
}