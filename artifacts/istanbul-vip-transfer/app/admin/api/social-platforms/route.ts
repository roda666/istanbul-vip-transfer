import { NextResponse } from 'next/server';
import { requireSocialPlatformAdmin, socialAuthErrorResponse } from '@/lib/social-auth';
import { getSocialPlatforms } from '@/lib/social-platforms';

export const dynamic = 'force-dynamic';

export async function GET() {
  try { await requireSocialPlatformAdmin(); }
  catch (error) {
    const response = socialAuthErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }

  try {
    return NextResponse.json({ platforms: await getSocialPlatforms() });
  } catch (error) {
    console.error('[social-platforms] status error', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Platform durumları alınamadı.' }, { status: 503 });
  }
}