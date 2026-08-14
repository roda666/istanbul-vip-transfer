/**
 * POST /admin/api/ai-content/social
 * Generates newsletter summary + social media drafts from a blog post.
 * Saves as a DRAFT note in the suggestion record. No auto-posting.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { generateSocialDrafts } from '@/lib/ai/content-hub';
import 'server-only';

export const dynamic = 'force-dynamic';

const schema = z.object({
  suggestionId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  let rawBody: unknown;
  try { rawBody = await req.json(); }
  catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }

  const parsed = schema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });
  }

  const { db } = await import('@/db');
  const { aiContentSuggestions, auditLogs } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const [sug] = await db.select().from(aiContentSuggestions).where(eq(aiContentSuggestions.id, parsed.data.suggestionId)).limit(1);
  if (!sug) return NextResponse.json({ error: 'Öneri bulunamadı.' }, { status: 404 });
  if (!sug.contentDraft) return NextResponse.json({ error: 'Önce makale taslağı oluşturun.' }, { status: 409 });

  const result = await generateSocialDrafts({
    title:          sug.suggestedTitle ?? '',
    excerpt:        sug.aiSummary ?? '',
    body:           sug.contentDraft,
    primaryKeyword: sug.primaryKeyword ?? '',
    targetLanguage: sug.targetLanguage ?? 'tr',
  });

  if (!result.ok) {
    return NextResponse.json({
      error: result.message,
      reason: result.reason,
    }, { status: result.reason === 'not_configured' ? 503 : result.reason === 'rate_limited' ? 429 : 422 });
  }

  await db.insert(auditLogs).values({
    adminUserId: session.adminId,
    action: 'AI_SOCIAL_DRAFTS',
    entityType: 'AISuggestion',
    entityId: sug.id,
    metadata: { model: result.model },
  }).catch(() => {});

  return NextResponse.json({ drafts: result.data });
}
