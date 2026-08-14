/**
 * POST /admin/api/ai-content/generate
 * Generates a full blog article draft from an approved suggestion.
 * - Saves draft to ai_content_suggestions.content_draft
 * - Records research_sources
 * - Creates a DRAFT blog post in content table
 * - Runs quality analysis
 * - Runs cannibalization check
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { generateArticleDraft, analyzeQuality } from '@/lib/ai/content-hub';
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

  const { db }  = await import('@/db');
  const { aiContentSuggestions, researchSources, content, auditLogs } = await import('@/db/schema');
  const { eq, like, or, ilike } = await import('drizzle-orm');
  const now = new Date();

  // Fetch the suggestion
  const [sug] = await db.select().from(aiContentSuggestions).where(eq(aiContentSuggestions.id, parsed.data.suggestionId)).limit(1);
  if (!sug) return NextResponse.json({ error: 'Öneri bulunamadı.' }, { status: 404 });

  // Extract keyword data
  const keywords = sug.suggestedKeywordsJson?.keywords ?? [];
  const primaryKeyword  = sug.primaryKeyword ?? '';
  const supportingKws   = keywords.filter(k => !k.isPrimary).map(k => k.term);
  const h2s             = (sug.suggestedOutline ?? '').split('\n').filter(Boolean);

  const brief = sug.contentBrief as { tone?: string; wordCountTarget?: number; competitorContext?: string } | null;

  // Generate article
  const result = await generateArticleDraft({
    title:              sug.suggestedTitle ?? '',
    primaryKeyword,
    supportingKeywords: supportingKws,
    searchIntent:       sug.searchIntent ?? 'Informational',
    suggestedH2s:       h2s,
    targetService:      sug.targetService ?? '',
    targetLocation:     sug.targetLocation ?? '',
    customerProfile:    sug.customerProfile ?? undefined,
    targetCountry:      sug.targetCountry ?? undefined,
    wordCountTarget:    brief?.wordCountTarget,
    tone:               brief?.tone,
    competitorContext:  brief?.competitorContext,
    targetLanguage:     sug.targetLanguage ?? 'tr',
  });

  if (!result.ok) {
    // Save error to DB so admin can see it
    await db.update(aiContentSuggestions)
      .set({ draftError: result.message, updatedAt: now } as never)
      .where(eq(aiContentSuggestions.id, sug.id));
    return NextResponse.json({
      error: result.message,
      reason: result.reason,
      partial: 'partial' in result ? result.partial : undefined,
    }, { status: result.reason === 'not_configured' ? 503 : result.reason === 'rate_limited' ? 429 : 422 });
  }

  const draft = result.data;

  // Cannibalization check — find existing blog/service pages with same primary keyword
  const cannibalRows = await db.select({ id: content.id, slug: content.slug, title: content.title, updatedAt: content.updatedAt })
    .from(content)
    .where(or(
      ilike(content.title,        `%${primaryKeyword}%`),
      ilike(content.seoTitle ?? content.title, `%${primaryKeyword}%`),
      like(content.body ?? '',    `%${primaryKeyword}%`),
    ))
    .limit(5);

  const cannibalWarning = {
    hasConflict: cannibalRows.length > 0,
    conflictingPages: cannibalRows.map(r => ({
      slug: r.slug,
      title: r.title,
      url: `/blog/${r.slug}`,
      updatedAt: r.updatedAt?.toISOString(),
    })),
  };

  // Quality analysis
  const qualityScore = analyzeQuality({
    title:          draft.title,
    body:           draft.body,
    excerpt:        draft.excerpt,
    metaTitle:      draft.metaTitle,
    metaDescription: draft.metaDescription,
    primaryKeyword,
    sourceCount:    draft.researchSources.length,
  });

  // Time-sensitive detection
  const timeSensitivePattern = /\b(2[0-9]{3}|güncel (fiyat|tarife|bilgi)|bugün itibar|bu yıl|son durum)/i;
  const timeSensitive = timeSensitivePattern.test(draft.body + draft.title) || draft.timeSensitive;

  // Create DRAFT blog post in content table
  const { slugify } = await import('@/lib/ai/slugify');
  let blogSlug = draft.slug ? slugify(draft.slug) : slugify(sug.suggestedTitle ?? 'taslak');

  // Ensure slug uniqueness
  const existing = await db.select({ id: content.id }).from(content).where(eq(content.slug, blogSlug)).limit(1);
  if (existing.length > 0) blogSlug = `${blogSlug}-${Date.now().toString(36)}`;

  const [blogPost] = await db.insert(content).values({
    contentType:    'BLOG_POST',
    title:          draft.title,
    slug:           blogSlug,
    excerpt:        draft.excerpt || null,
    body:           draft.body,
    ogTitle:        draft.ogTitle || null,
    ogDescription:  draft.ogDescription || null,
    seoTitle:       draft.metaTitle || null,
    seoDescription: draft.metaDescription || null,
    author:         'AI Taslak',
    status:         'DRAFT',
    indexable:      false,     // not indexed until published
    isActive:       false,
    timeSensitive:  timeSensitive as never,
    createdAt:      now,
    updatedAt:      now,
  } as never).returning();

  // Save research sources
  if (draft.researchSources.length > 0) {
    await db.insert(researchSources).values(
      draft.researchSources.map(src => ({
        suggestionId:   sug.id,
        contentId:      blogPost.id,
        title:          src.title,
        url:            src.url,
        claimSupported: src.claimSupported,
        sourceType:     src.sourceType ?? 'ai_context',
        accessedAt:     now,
        sourceName:     'AI generated',
      } as never))
    ).catch(() => {});
  }

  // Update suggestion
  await db.update(aiContentSuggestions).set({
    contentDraft:          draft.body,
    draftError:            null,
    draftBlogPostId:       blogPost.id,
    qualityScore:          qualityScore as never,
    cannibalWarning:  cannibalWarning as never,
    timeSensitive,
    status:                'COMPLETE',
    updatedAt:             now,
  } as never).where(eq(aiContentSuggestions.id, sug.id));

  await db.insert(auditLogs).values({
    adminUserId: session.adminId,
    action: 'AI_GENERATE',
    entityType: 'AISuggestion',
    entityId: sug.id,
    metadata: {
      model: result.model, wordCount: draft.wordCount,
      blogPostId: blogPost.id, timeSensitive,
      cannibalConflict: cannibalWarning.hasConflict,
    },
  }).catch(() => {});

  return NextResponse.json({
    draft,
    blogPostId: blogPost.id,
    blogSlug,
    qualityScore,
    cannibalWarning,
    timeSensitive,
    forbiddenClaimsFound: draft.forbiddenClaimsFound,
  }, { status: 201 });
}
