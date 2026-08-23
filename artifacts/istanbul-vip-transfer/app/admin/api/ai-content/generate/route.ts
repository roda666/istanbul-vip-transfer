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
import {
  generateArticleDraft, analyzeQuality, normalizeInternalLinkCatalog,
  normalizeModelResearchSources,
} from '@/lib/ai/content-hub';
import { classifyGscResearchRows } from '@/lib/search-research';
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
  const { aiContentSuggestions, researchSources, content, contentTranslations, auditLogs } = await import('@/db/schema');
  const { eq, and, like, or, ilike, sql } = await import('drizzle-orm');
  const now = new Date();

  // Fetch the suggestion
  const [sug] = await db.select().from(aiContentSuggestions).where(eq(aiContentSuggestions.id, parsed.data.suggestionId)).limit(1);
  if (!sug) return NextResponse.json({ error: 'Öneri bulunamadı.' }, { status: 404 });

  // Extract keyword data
  const keywords = sug.suggestedKeywordsJson?.keywords ?? [];
  // Only persisted, conservatively classified GSC questions may be promoted
  // to mandatory answer headings. Ads ideas and ordinary keywords never are.
  const selectedQuestionQueries = classifyGscResearchRows(
    (sug.suggestedKeywordsJson?.searchResearch?.gscRows ?? []) as Array<{
      query: string; clicks: number; impressions: number; ctr: number; position: number;
    }>,
    20,
  )
    .filter(row => row.isQuestion)
    .map(row => row.query)
    .slice(0, 6) ?? [];
  const primaryKeyword  = sug.primaryKeyword ?? '';
  const supportingKws   = keywords.filter(k => !k.isPrimary).map(k => k.term);
  const h2s             = (sug.suggestedOutline ?? '').split('\n').filter(Boolean);

  const brief = sug.contentBrief as { tone?: string; wordCountTarget?: number; competitorContext?: string } | null;

  // Build the link catalog server-side from public records. Do not fall back to
  // guessed URLs: a failed catalog query must prevent generation.
  let internalLinkCatalog: Array<{ title: string; href: string }>;
  try {
    if ((sug.targetLanguage ?? 'tr') === 'tr') {
      const catalogRows = await db.select({ slug: content.slug, title: content.title, contentType: content.contentType })
        .from(content)
        .where(and(
          or(eq(content.contentType, 'SERVICE'), eq(content.contentType, 'BLOG_POST')),
          eq(content.status, 'PUBLISHED'),
          eq(content.isActive, true),
        ))
        .limit(40);
      internalLinkCatalog = normalizeInternalLinkCatalog(catalogRows.map((row) => ({
        title: row.title,
        href: row.contentType === 'SERVICE' ? `/hizmetler/${row.slug}` : `/blog/${row.slug}`,
      })));
    } else {
      // Only localized blog detail URLs currently exist. Service translations
      // have no localized detail route, so never hand the model a dead URL.
      const catalogRows = await db.select({ slug: contentTranslations.slug, title: contentTranslations.title })
        .from(contentTranslations)
        .innerJoin(content, sql`${contentTranslations.entityId}::uuid = ${content.id}`)
        .where(and(
          eq(contentTranslations.targetLanguageCode, sug.targetLanguage ?? 'tr'),
          eq(contentTranslations.entityType, 'content'),
          eq(contentTranslations.status, 'PUBLISHED'),
          eq(content.contentType, 'BLOG_POST'),
          eq(content.status, 'PUBLISHED'),
          eq(content.isActive, true),
        ))
        .limit(40);
      internalLinkCatalog = normalizeInternalLinkCatalog(catalogRows.map((row) => ({
        title: row.title ?? '',
        href: row.slug ? `/${sug.targetLanguage}/blog/${row.slug}` : '',
      })));
    }
  } catch {
    await db.update(aiContentSuggestions)
      .set({ draftError: 'Yayınlanmış dahili bağlantı kataloğu okunamadı; güvenli taslak üretimi durduruldu.', updatedAt: now } as never)
      .where(eq(aiContentSuggestions.id, sug.id));
    return NextResponse.json({ error: 'Dahili bağlantı kataloğu okunamadı. Taslak üretilmedi.' }, { status: 503 });
  }

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
    internalLinkCatalog,
    selectedQuestionQueries,
    searchResearch: sug.suggestedKeywordsJson?.searchResearch,
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
     author:         draft.truncated ? 'AI Taslak (Kesildi)' : 'AI Taslak',
    status:         'DRAFT',
    indexable:      false,     // not indexed until published
    isActive:       false,
    timeSensitive:  timeSensitive as never,
    createdAt:      now,
    updatedAt:      now,
  } as never).returning();

  // Save research sources
  // Normalize again at the persistence/API boundary so a future generator
  // change cannot turn model output into trusted or clickable source data.
  const safeResearchSources = normalizeModelResearchSources(draft.researchSources);
  draft.researchSources = safeResearchSources;
  if (safeResearchSources.length > 0) {
    await db.insert(researchSources).values(
      safeResearchSources.map(src => ({
        suggestionId:   sug.id,
        contentId:      blogPost.id,
        title:          src.title,
        url:            src.url,
        claimSupported: src.claimSupported,
         // No external validation runs in this flow. Never present model
         // suggestions as verified sources.
         sourceType:     'model_suggested_unverified',
        accessedAt:     now,
        sourceName:     'AI generated',
         provenanceStatus: 'MODEL_SUGGESTED_UNVERIFIED',
      } as never))
    ).catch(() => {});
  }

  // Update suggestion
  await db.update(aiContentSuggestions).set({
     contentDraft:          draft.body,
     draftError:            draft.generationWarning ?? null,
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
       truncated: draft.truncated,
       linkSanitizationDiagnostics: draft.linkSanitizationDiagnostics,
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
     truncated: draft.truncated,
     warning: draft.generationWarning,
     linkSanitizationDiagnostics: draft.linkSanitizationDiagnostics,
  }, { status: 201 });
}
