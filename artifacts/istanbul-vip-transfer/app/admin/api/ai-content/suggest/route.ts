/**
 * POST /admin/api/ai-content/suggest
 * Suggests a topic + keyword cluster using OpenAI.
 * Records the suggestion in ai_content_suggestions with status PENDING.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { suggestTopicAndKeywords } from '@/lib/ai/content-hub';
import 'server-only';

export const dynamic = 'force-dynamic';

const schema = z.object({
  articleType:      z.string().max(100),
  targetService:    z.string().max(200),
  targetLocation:   z.string().max(200),
  customerProfile:  z.string().max(300).optional(),
  targetCountry:    z.string().max(100).optional(),
  searchIntent:     z.string().max(100).optional(),
  tone:             z.string().max(100).optional(),
  wordCountTarget:  z.number().int().min(300).max(5000).optional(),
  competitorContext: z.string().max(500).optional(),
  targetLanguage:   z.string().max(10).default('tr'),
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
  const data = parsed.data;

  const result = await suggestTopicAndKeywords({
    articleType:      data.articleType,
    targetService:    data.targetService,
    targetLocation:   data.targetLocation,
    customerProfile:  data.customerProfile,
    targetCountry:    data.targetCountry,
    searchIntent:     data.searchIntent,
    tone:             data.tone,
    wordCountTarget:  data.wordCountTarget,
    targetLanguage:   data.targetLanguage,
  });

  if (!result.ok) {
    return NextResponse.json({
      error: result.message,
      reason: result.reason,
      partial: 'partial' in result ? result.partial : undefined,
    }, { status: result.reason === 'not_configured' ? 503 : result.reason === 'rate_limited' ? 429 : 422 });
  }

  // Persist suggestion
  const { db }                  = await import('@/db');
  const { aiContentSuggestions, auditLogs } = await import('@/db/schema');

  const [saved] = await db.insert(aiContentSuggestions).values({
    suggestedTitle:        result.data.title,
    primaryKeyword:        result.data.primaryKeyword,
    secondaryKeywords:     result.data.supportingKeywords.join(', '),
    suggestedKeywordsJson: {
      keywords: [
        { term: result.data.primaryKeyword, intent: result.data.searchIntent, isPrimary: true },
        ...result.data.supportingKeywords.map(k => ({ term: k, intent: result.data.searchIntent, isPrimary: false })),
      ],
      dataSourceNote: result.data.dataSourceNote,
    },
    searchIntent:     result.data.searchIntent,
    suggestedOutline: result.data.suggestedH2s.join('\n'),
    aiSummary:        result.data.contentSummary,
    targetService:    data.targetService,
    targetLocation:   data.targetLocation,
    articleType:      data.articleType,
    customerProfile:  data.customerProfile,
    targetCountry:    data.targetCountry,
    targetLanguage:   data.targetLanguage,
    contentBrief:     {
      tone:              data.tone ?? 'Profesyonel',
      wordCountTarget:   data.wordCountTarget ?? 1500,
      competitorContext: data.competitorContext,
    },
    status: 'IN_PROGRESS',
  }).returning();

  await db.insert(auditLogs).values({
    adminUserId: session.adminId,
    action: 'AI_SUGGEST',
    entityType: 'AISuggestion',
    entityId: saved.id,
    metadata: { model: result.model, articleType: data.articleType },
  }).catch(() => {});

  return NextResponse.json({ suggestion: saved, aiResult: result.data }, { status: 201 });
}
