import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSocialPlatformAdmin, socialAuthErrorResponse } from '@/lib/social-auth';
import { isSocialPlatformKey } from '@/lib/social-platforms';
import { publishFacebookPost, publishInstagramPost, publishXTweet } from '@/lib/social-publish';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';

const publishSchema = z.object({
  text: z.string().min(1).max(5000),
  url: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  let session;
  try { session = await requireSocialPlatformAdmin(); }
  catch (error) {
    const response = socialAuthErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
  const { key } = await params;
  if (!isSocialPlatformKey(key) || !['facebook', 'instagram', 'x'].includes(key)) {
    return NextResponse.json({ error: 'Bu platform için yayınlama henüz desteklenmiyor.' }, { status: 400 });
  }
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }
  const parsed = publishSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz yayın içeriği.' }, { status: 422 });

  try {
    const result = key === 'facebook'
      ? await publishFacebookPost({ message: parsed.data.text, link: parsed.data.url })
      : key === 'instagram'
        ? await publishInstagramPost({ caption: parsed.data.text, imageUrl: parsed.data.imageUrl ?? '' })
        : await publishXTweet(parsed.data.text);
    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'SOCIAL_PUBLISH',
      entityType: 'social_platform',
      entityId: key,
      metadata: { hasLink: Boolean(parsed.data.url), hasImage: Boolean(parsed.data.imageUrl) },
    });
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Yayınlama başarısız.' }, { status: 502 });
  }
}