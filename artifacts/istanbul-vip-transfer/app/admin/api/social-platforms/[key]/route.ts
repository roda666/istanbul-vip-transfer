import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSocialPlatformAdmin, socialAuthErrorResponse } from '@/lib/social-auth';
import { isSocialPlatformKey, setSocialPlatformEnabled } from '@/lib/social-platforms';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';

const toggleSchema = z.object({ enabled: z.boolean() });

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  let session;
  try { session = await requireSocialPlatformAdmin(); }
  catch (error) {
    const response = socialAuthErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }

  const { key } = await params;
  if (!isSocialPlatformKey(key)) return NextResponse.json({ error: 'Bilinmeyen platform.' }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }
  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz etkinlik değeri.' }, { status: 422 });

  try {
    const platform = await setSocialPlatformEnabled(key, parsed.data.enabled);
    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'SOCIAL_PLATFORM_TOGGLE',
      entityType: 'social_platform',
      entityId: key,
      metadata: { enabled: parsed.data.enabled },
    });
    return NextResponse.json({ platform });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Platform güncellenemedi.' },
      { status: 409 },
    );
  }
}