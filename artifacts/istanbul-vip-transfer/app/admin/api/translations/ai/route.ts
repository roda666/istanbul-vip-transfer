/**
 * POST /admin/api/translations/ai
 *
 * Triggers AI translation for one entity across one or more languages.
 * Creates or resets jobs to QUEUED, processes them, stores results as DRAFT.
 * AI translations NEVER advance past DRAFT automatically.
 *
 * Supported entity types:
 *  • content       — generic content rows (PAGE, BLOG_POST); uses translateContent()
 *  • service_page  — structured JSON body (ServicePageBody); uses translateServicePageFields()
 *                    with field extraction, translation, reconstruction, and validation.
 *  • faq           — question/answer pairs; uses translateContent()
 *  • vehicle       — name/description/meta; uses translateContent()
 *  • navigation    — label text; uses translateContent()
 *
 * Rate limit: 10 requests per minute per admin (in-memory, resets on server restart).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';

const requestSchema = z.object({
  entityType: z.enum(['content', 'service_page', 'faq', 'vehicle', 'navigation']),
  entityId: z.string().uuid(),
  targetLanguageCodes: z.array(z.string().min(2).max(10)).min(1).max(80),
  /** When true, manually edited / locked translations may be overwritten. */
  force: z.boolean().default(false),
});

// Simple in-memory rate limiting (resets on server restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;

function checkRateLimit(adminId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(adminId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(adminId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  let session: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!checkRateLimit(session.adminId)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Maksimum dakikada 10 çeviri isteği yapılabilir.' },
      { status: 429 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI çeviri servisi yapılandırılmamış. OPENAI_API_KEY gereklidir.' },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
  }

  const { entityType, entityId, targetLanguageCodes, force } = parsed.data;

  const { db } = await import('@/db');
  const { content, contentTranslations, auditLogs, languages, faqs, vehicles, navigationItems } = await import('@/db/schema');
  const { eq, and, inArray } = await import('drizzle-orm');
  const { sql } = await import('drizzle-orm');
  const { translateContent, PROMPT_VERSION } = await import('@/lib/ai/translate');

  // ── Catalog validation ────────────────────────────────────────────────────
  const catalogRows = await db
    .select({ code: languages.code, providerSupported: languages.providerSupported })
    .from(languages)
    .where(inArray(languages.code, targetLanguageCodes));
  const catalog = new Map(catalogRows.map((r) => [r.code, r]));
  const invalid = targetLanguageCodes.filter((c) => c === 'tr' || !catalog.has(c));
  const unsupported = targetLanguageCodes.filter((c) => catalog.get(c)?.providerSupported === false);
  if (invalid.length > 0 || unsupported.length > 0) {
    return NextResponse.json(
      {
        error: [
          invalid.length > 0 ? `Katalogda olmayan/geçersiz diller: ${invalid.join(', ')}` : null,
          unsupported.length > 0 ? `Sağlayıcının desteklemediği diller: ${unsupported.join(', ')}` : null,
        ].filter(Boolean).join(' — '),
      },
      { status: 400 },
    );
  }

  // ── Entity-type-specific source fetching ─────────────────────────────────
  type TranslateInput = Parameters<typeof translateContent>[0];

  // Generic content input (used for content / faq / vehicle / navigation)
  let sourceInput: TranslateInput | null = null;

  // Service-page specific (structured JSON body, translated separately)
  let spFields: Record<string, string> | null = null;
  let spRawBody: string | null = null; // Turkish source body JSON for hash + reconstruction
  let spAuxRow: { seoTitle: string | null; seoDescription: string | null; heroImageAlt: string | null } | null = null;

  if (entityType === 'content') {
    const [row] = await db.select().from(content).where(eq(content.id, entityId)).limit(1);
    if (row) {
      sourceInput = {
        title: row.title,
        slug: row.slug,
        excerpt: row.excerpt,
        body: row.body,
        metaTitle: row.seoTitle,
        metaDescription: row.seoDescription,
        imageAlt: row.heroImageAlt,
      };
    }

  } else if (entityType === 'service_page') {
    // Service pages use a structured JSON body — must not be fed to the generic HTML translator.
    const [row] = await db
      .select({
        id: content.id,
        seoTitle: content.seoTitle,
        seoDescription: content.seoDescription,
        heroImageAlt: content.heroImageAlt,
        body: content.body,
      })
      .from(content)
      .where(eq(content.id, entityId))
      .limit(1);

    if (row) {
      const { parseServicePageBody, extractTranslatableFields } = await import('@/lib/service-page-types');
      const parsedBody = parseServicePageBody(row.body);
      if (!parsedBody) {
        return NextResponse.json(
          {
            error:
              'Hizmet sayfası body yapısı geçersiz ya da eksik. Hizmet sayfası editöründen kaydedip tekrar deneyin.',
          },
          { status: 422 },
        );
      }
      spFields = extractTranslatableFields(parsedBody);
      spRawBody = row.body;
      spAuxRow = { seoTitle: row.seoTitle, seoDescription: row.seoDescription, heroImageAlt: row.heroImageAlt };
    }

  } else if (entityType === 'faq') {
    const [row] = await db
      .select({ id: faqs.id, question: faqs.question, answer: faqs.answer })
      .from(faqs)
      .where(eq(faqs.id, entityId))
      .limit(1);
    if (row) {
      sourceInput = { title: row.question, slug: '', excerpt: null, body: row.answer, metaTitle: null, metaDescription: null, imageAlt: null };
    }

  } else if (entityType === 'vehicle') {
    const [row] = await db.select().from(vehicles).where(eq(vehicles.id, entityId)).limit(1);
    if (row) {
      sourceInput = {
        title: row.name,
        slug: row.slug,
        excerpt: row.shortDescription,
        body: row.fullDescription,
        metaTitle: row.metaTitle,
        metaDescription: row.metaDescription,
        imageAlt: row.coverImageAlt,
      };
    }

  } else if (entityType === 'navigation') {
    const [row] = await db
      .select({ id: navigationItems.id, label: navigationItems.label })
      .from(navigationItems)
      .where(eq(navigationItems.id, entityId))
      .limit(1);
    if (row) {
      sourceInput = { title: row.label, slug: '', excerpt: null, body: null, metaTitle: null, metaDescription: null, imageAlt: null };
    }
  }

  // Not-found guard
  const entityFound = entityType === 'service_page' ? spFields !== null : sourceInput !== null;
  if (!entityFound) {
    return NextResponse.json({ error: 'Source entity not found' }, { status: 404 });
  }

  // ── Pre-load service-page utilities (outside loop for module cache efficiency) ─
  const spUtils = entityType === 'service_page'
    ? await import('@/lib/service-page-types').then(async (types) => ({
        types,
        translator: await import('@/lib/ai/translate-service-page'),
      }))
    : null;

  // ── Per-language translation loop ────────────────────────────────────────
  const results: Array<{ lang: string; status: string; jobId?: string; error?: string }> = [];

  for (const targetLang of targetLanguageCodes) {
    try {
      // Check if a job already exists
      const [existing] = await db
        .select({
          id: contentTranslations.id,
          isAiGenerated: contentTranslations.isAiGenerated,
          isManuallyLocked: contentTranslations.isManuallyLocked,
          status: contentTranslations.status,
        })
        .from(contentTranslations)
        .where(
          and(
            eq(contentTranslations.entityType, entityType),
            eq(contentTranslations.entityId, entityId),
            eq(contentTranslations.targetLanguageCode, targetLang),
          ),
        )
        .limit(1);

      // Manually edited or locked translations are never overwritten silently
      if (
        existing &&
        !force &&
        (existing.isManuallyLocked ||
          (!existing.isAiGenerated && !['NOT_STARTED', 'FAILED'].includes(existing.status)))
      ) {
        results.push({
          lang: targetLang,
          status: 'needs_confirmation',
          jobId: existing.id,
          error: 'Elle düzenlenmiş çeviri — üzerine yazmak için onay gerekli.',
        });
        continue;
      }

      let jobId: string;

      if (existing) {
        await db
          .update(contentTranslations)
          .set({ status: 'QUEUED', isAiGenerated: true, queuedAt: sql`now()`, updatedAt: sql`now()`, updatedBy: session.adminId, failureReason: null })
          .where(eq(contentTranslations.id, existing.id));
        jobId = existing.id;
      } else {
        const [inserted] = await db
          .insert(contentTranslations)
          .values({ entityType, entityId, targetLanguageCode: targetLang, sourceLanguageCode: 'tr', status: 'QUEUED', isAiGenerated: true, queuedAt: sql`now()`, createdBy: session.adminId, updatedBy: session.adminId })
          .returning({ id: contentTranslations.id });
        if (!inserted) {
          results.push({ lang: targetLang, status: 'error', error: 'Failed to create job' });
          continue;
        }
        jobId = inserted.id;
      }

      await db.update(contentTranslations).set({ status: 'TRANSLATING', updatedAt: sql`now()` }).where(eq(contentTranslations.id, jobId));

      // ── SERVICE PAGE: structured JSON body translation ──────────────────
      if (entityType === 'service_page' && spUtils && spFields && spRawBody && spAuxRow) {
        const { parseServicePageBody, applyTranslatedFields, isServicePageBody, computeTranslatableHash } = spUtils.types;
        const { translateServicePageFields } = spUtils.translator;

        const spResult = await translateServicePageFields(spFields, targetLang);

        if (!spResult.ok) {
          await db.update(contentTranslations)
            .set({ status: 'FAILED', failureReason: spResult.message ?? spResult.reason, updatedAt: sql`now()` })
            .where(eq(contentTranslations.id, jobId));
          results.push({ lang: targetLang, status: 'failed', jobId, error: spResult.message });
          continue;
        }

        // Reconstruct and validate the structured body
        const sourceBodyParsed = parseServicePageBody(spRawBody)!;
        const translatedBody = applyTranslatedFields(sourceBodyParsed, spResult.translated);

        if (!isServicePageBody(translatedBody)) {
          await db.update(contentTranslations)
            .set({ status: 'FAILED', failureReason: 'AI yanıtı geçerli ServicePageBody yapısı döndürmedi', updatedAt: sql`now()` })
            .where(eq(contentTranslations.id, jobId));
          results.push({ lang: targetLang, status: 'failed', jobId, error: 'Invalid body structure from AI' });
          continue;
        }

        const sourceHash = computeTranslatableHash(sourceBodyParsed);

        await db.update(contentTranslations)
          .set({
            status: 'DRAFT',
            updatedAt: sql`now()`,
            // Structured body stored as JSON string (consistent with service-page-cms.ts)
            body: JSON.stringify(translatedBody),
            title: translatedBody.hero.title || null,
            // Service pages don't have a standalone excerpt or slug in translations
            excerpt: null,
            slug: null,
            // seo.ogTitle / seo.ogDescription are translated inside ServicePageBody
            // and must be mirrored into metaTitle / metaDescription so that
            // getPublishedServicePage() serves translated SEO metadata.
            metaTitle: translatedBody.seo.ogTitle || spAuxRow.seoTitle || null,
            metaDescription: translatedBody.seo.ogDescription || spAuxRow.seoDescription || null,
            imageAlt: spAuxRow.heroImageAlt ?? null,
            focusKeyword: null,
            supportingKeywords: null,
            imageTitle: null,
            imageCaption: null,
            sourceHash,
            isAiGenerated: true,
            aiModel: spResult.model,
            aiPromptVersion: 'sp-1.1',
          })
          .where(eq(contentTranslations.id, jobId));

        await db.insert(auditLogs).values({
          adminUserId: session.adminId,
          action: 'translation.ai_complete',
          entityType: 'content_translation',
          entityId: jobId,
          metadata: { targetLang, entityType, entityId, model: spResult.model, status: 'DRAFT' },
        });

        results.push({ lang: targetLang, status: 'draft', jobId });
        continue;
      }

      // ── GENERIC path: content / faq / vehicle / navigation ───────────────
      const aiResult = await translateContent(sourceInput!, targetLang);

      if (!aiResult.ok) {
        await db.update(contentTranslations)
          .set({ status: 'FAILED', failureReason: aiResult.message ?? aiResult.reason, updatedAt: sql`now()` })
          .where(eq(contentTranslations.id, jobId));
        results.push({ lang: targetLang, status: 'failed', jobId, error: aiResult.message });
        continue;
      }

      // Save as DRAFT — NEVER APPROVED or PUBLISHED
      await db.update(contentTranslations)
        .set({
          status: 'DRAFT',
          updatedAt: sql`now()`,
          title: aiResult.data.title,
          slug: aiResult.data.slug || null,
          excerpt: aiResult.data.excerpt || null,
          body: aiResult.data.body || null,
          metaTitle: aiResult.data.metaTitle || null,
          metaDescription: aiResult.data.metaDescription || null,
          focusKeyword: aiResult.data.focusKeyword || null,
          supportingKeywords: aiResult.data.supportingKeywords?.length ? aiResult.data.supportingKeywords : null,
          imageAlt: aiResult.data.imageAlt || null,
          imageTitle: aiResult.data.imageTitle || null,
          imageCaption: aiResult.data.imageCaption || null,
          aiModel: aiResult.model,
          aiPromptVersion: PROMPT_VERSION,
        })
        .where(eq(contentTranslations.id, jobId));

      await db.insert(auditLogs).values({
        adminUserId: session.adminId,
        action: 'translation.ai_complete',
        entityType: 'content_translation',
        entityId: jobId,
        metadata: { targetLang, entityType, entityId, model: aiResult.model, status: 'DRAFT' },
      });

      results.push({ lang: targetLang, status: 'draft', jobId });
    } catch (err) {
      console.error(`AI translation failed for ${targetLang}:`, err);
      results.push({ lang: targetLang, status: 'error', error: String(err) });
    }
  }

  const allOk = results.every((r) => r.status === 'draft');
  const anyFailed = results.some((r) => ['error', 'failed'].includes(r.status));
  const needsConfirmation = results.filter((r) => r.status === 'needs_confirmation').map((r) => r.lang);

  return NextResponse.json(
    {
      results,
      needsConfirmation,
      summary: allOk ? 'all_ok' : anyFailed ? 'partial_failure' : needsConfirmation.length > 0 ? 'needs_confirmation' : 'processing',
    },
    { status: anyFailed ? 207 : 200 },
  );
}
