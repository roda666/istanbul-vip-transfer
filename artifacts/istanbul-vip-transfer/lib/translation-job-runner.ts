/**
 * Translation job runner — core logic for executing a single per-language task.
 *
 * Called from POST /admin/api/translations/jobs/[jobId]/tasks/[taskId]/run.
 * Handles:
 *  - 45-second AbortController timeout per language
 *  - Retry detection (up to 2 attempts per task, tracked in DB)
 *  - AI JSON validation — uses 'parse_error' reason from translate modules
 *  - Manually-locked translation guard (skip unless force=true)
 *  - Saving result as DRAFT in contentTranslations
 *  - Audit log entry on success
 */

import type { TranslationInput } from '@/lib/ai/translate';

export type RunTaskEntityType = 'content' | 'service_page' | 'faq' | 'vehicle' | 'navigation';

export interface RunTaskParams {
  jobId:      string;
  taskId:     string;
  entityType: RunTaskEntityType;
  entityId:   string;
  targetLang: string;
  force:      boolean;
  adminId:    string;
  /** Current attempt number (1-based). Max 2 attempts. */
  attempt:    number;
}

export type RunTaskStatus = 'completed' | 'failed' | 'needs_confirmation';

export interface RunTaskResult {
  status:         RunTaskStatus;
  translationId?: string;
  /** Turkish-safe error message. */
  error?:         string;
}

/**
 * Core runner — fetches entity, calls AI, validates output, saves as DRAFT.
 * Does NOT update the task row or job counters; the route handler does that.
 */
export async function runTranslationTask(params: RunTaskParams): Promise<RunTaskResult> {
  const { entityType, entityId, targetLang, force, adminId, attempt } = params;

  const { db }           = await import('@/db');
  const schema           = await import('@/db/schema');
  const { eq, and, sql } = await import('drizzle-orm');

  const { content, contentTranslations, auditLogs, faqs, vehicles, navigationItems } = schema;

  // ── Validate AI config ────────────────────────────────────────────────────
  if (!process.env.OPENAI_API_KEY) {
    return {
      status: 'failed',
      error: 'OpenAI çeviri servisi yapılandırılmamış (OPENAI_API_KEY eksik).',
    };
  }

  // ── Check for manually-locked existing translation ────────────────────────
  const [existing] = await db
    .select({
      id:               contentTranslations.id,
      isManuallyLocked: contentTranslations.isManuallyLocked,
      isAiGenerated:    contentTranslations.isAiGenerated,
      status:           contentTranslations.status,
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

  if (
    existing &&
    !force &&
    (existing.isManuallyLocked ||
      (!existing.isAiGenerated && !['NOT_STARTED', 'FAILED'].includes(existing.status)))
  ) {
    return {
      status: 'needs_confirmation',
      translationId: existing.id,
      error: 'Elle düzenlenmiş çeviri — onay gerekli. Zorla yazmak için "Zorla Üzerine Yaz" butonunu kullanın.',
    };
  }

  // ── Upsert contentTranslations row to TRANSLATING ─────────────────────────
  let jobRowId: string;

  if (existing) {
    await db
      .update(contentTranslations)
      .set({
        status: 'TRANSLATING',
        isAiGenerated: true,
        queuedAt: sql`now()`,
        updatedAt: sql`now()`,
        updatedBy: adminId,
        failureReason: null,
      })
      .where(eq(contentTranslations.id, existing.id));
    jobRowId = existing.id;
  } else {
    const [inserted] = await db
      .insert(contentTranslations)
      .values({
        entityType,
        entityId,
        targetLanguageCode: targetLang,
        sourceLanguageCode: 'tr',
        status: 'TRANSLATING',
        isAiGenerated: true,
        queuedAt: sql`now()`,
        createdBy: adminId,
        updatedBy: adminId,
      })
      .returning({ id: contentTranslations.id });

    if (!inserted) {
      return { status: 'failed', error: 'contentTranslations satırı oluşturulamadı.' };
    }
    jobRowId = inserted.id;
  }

  // ── Fetch source entity ───────────────────────────────────────────────────
  let sourceInput: TranslationInput | null = null;
  let spFields:    Record<string, string> | null = null;
  let spRawBody:   string | null = null;
  let spAuxRow:    { seoTitle: string | null; seoDescription: string | null; heroImageAlt: string | null } | null = null;

  if (entityType === 'content') {
    const [row] = await db.select().from(content).where(eq(content.id, entityId)).limit(1);
    if (row) {
      sourceInput = {
        title: row.title, slug: row.slug, excerpt: row.excerpt, body: row.body,
        metaTitle: row.seoTitle, metaDescription: row.seoDescription, imageAlt: row.heroImageAlt,
      };
    }
  } else if (entityType === 'service_page') {
    const [row] = await db
      .select({ id: content.id, seoTitle: content.seoTitle, seoDescription: content.seoDescription, heroImageAlt: content.heroImageAlt, body: content.body })
      .from(content).where(eq(content.id, entityId)).limit(1);
    if (row) {
      const { parseServicePageBody, extractTranslatableFields } = await import('@/lib/service-page-types');
      const parsed = parseServicePageBody(row.body);
      if (!parsed) {
        await db.update(contentTranslations)
          .set({ status: 'FAILED', failureReason: 'Body yapısı geçersiz', updatedAt: sql`now()` })
          .where(eq(contentTranslations.id, jobRowId));
        return { status: 'failed', translationId: jobRowId, error: 'Hizmet sayfası body yapısı geçersiz veya eksik. Editörden kaydedip tekrar deneyin.' };
      }
      spFields  = extractTranslatableFields(parsed);
      spRawBody = row.body;
      spAuxRow  = { seoTitle: row.seoTitle, seoDescription: row.seoDescription, heroImageAlt: row.heroImageAlt };
    }
  } else if (entityType === 'faq') {
    const [row] = await db.select({ id: faqs.id, question: faqs.question, answer: faqs.answer })
      .from(faqs).where(eq(faqs.id, entityId)).limit(1);
    if (row) {
      sourceInput = { title: row.question, slug: '', excerpt: null, body: row.answer,
        metaTitle: null, metaDescription: null, imageAlt: null };
    }
  } else if (entityType === 'vehicle') {
    const [row] = await db.select().from(vehicles).where(eq(vehicles.id, entityId)).limit(1);
    if (row) {
      sourceInput = {
        title: row.name, slug: row.slug, excerpt: row.shortDescription, body: row.fullDescription,
        metaTitle: row.metaTitle, metaDescription: row.metaDescription, imageAlt: row.coverImageAlt,
      };
    }
  } else if (entityType === 'navigation') {
    const [row] = await db.select({ id: navigationItems.id, label: navigationItems.label })
      .from(navigationItems).where(eq(navigationItems.id, entityId)).limit(1);
    if (row) {
      sourceInput = { title: row.label, slug: '', excerpt: null, body: null,
        metaTitle: null, metaDescription: null, imageAlt: null };
    }
  }

  const entityFound = entityType === 'service_page' ? spFields !== null : sourceInput !== null;
  if (!entityFound) {
    await db.update(contentTranslations)
      .set({ status: 'FAILED', failureReason: 'Kaynak içerik bulunamadı', updatedAt: sql`now()` })
      .where(eq(contentTranslations.id, jobRowId));
    return { status: 'failed', translationId: jobRowId, error: 'Kaynak içerik bulunamadı.' };
  }

  // ── Run AI with 45-second timeout ─────────────────────────────────────────
  const TIMEOUT_MS = 45_000;

  try {
    if (entityType === 'service_page' && spFields && spRawBody && spAuxRow) {
      const { translateServicePageFields } = await import('@/lib/ai/translate-service-page');
      const { parseServicePageBody, applyTranslatedFields, isServicePageBody, computeTranslatableHash }
        = await import('@/lib/service-page-types');

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let spResult: Awaited<ReturnType<typeof translateServicePageFields>>;
      try {
        spResult = await translateServicePageFields(spFields, targetLang, controller.signal);
      } finally {
        clearTimeout(timer);
      }

      if (!spResult.ok) {
        // Allow one parse-error retry
        if (attempt < 2 && spResult.reason === 'parse_error') {
          return { status: 'failed', translationId: jobRowId,
            error: `AI yanıtı JSON ayrıştırılamadı (deneme ${attempt}/2). Yeniden deneniyor.` };
        }
        await db.update(contentTranslations)
          .set({ status: 'FAILED', failureReason: spResult.message ?? spResult.reason, updatedAt: sql`now()` })
          .where(eq(contentTranslations.id, jobRowId));
        return { status: 'failed', translationId: jobRowId, error: spResult.message ?? 'Yapay zeka çeviriyi tamamlayamadı.' };
      }

      const sourceBodyParsed = parseServicePageBody(spRawBody)!;
      const translatedBody   = applyTranslatedFields(sourceBodyParsed, spResult.translated);

      if (!isServicePageBody(translatedBody)) {
        await db.update(contentTranslations)
          .set({ status: 'FAILED', failureReason: 'AI yanıtı geçerli ServicePageBody yapısı döndürmedi', updatedAt: sql`now()` })
          .where(eq(contentTranslations.id, jobRowId));
        return { status: 'failed', translationId: jobRowId, error: 'AI yanıtı geçerli hizmet sayfası yapısı değil.' };
      }

      const sourceHash = computeTranslatableHash(sourceBodyParsed);
      await db.update(contentTranslations)
        .set({
          status: 'DRAFT', updatedAt: sql`now()`,
          body: JSON.stringify(translatedBody),
          title: translatedBody.hero.title || null,
          excerpt: null, slug: null,
          metaTitle: translatedBody.seo?.ogTitle || spAuxRow.seoTitle || null,
          metaDescription: translatedBody.seo?.ogDescription || spAuxRow.seoDescription || null,
          imageAlt: spAuxRow.heroImageAlt ?? null,
          focusKeyword: null, supportingKeywords: null, imageTitle: null, imageCaption: null,
          sourceHash, isAiGenerated: true, aiModel: spResult.model, aiPromptVersion: 'sp-1.1',
        })
        .where(eq(contentTranslations.id, jobRowId));

    } else if (sourceInput) {
      const { translateContent, PROMPT_VERSION } = await import('@/lib/ai/translate');

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let aiResult: Awaited<ReturnType<typeof translateContent>>;
      try {
        aiResult = await translateContent(sourceInput, targetLang, controller.signal);
      } finally {
        clearTimeout(timer);
      }

      if (!aiResult.ok) {
        // Allow one parse-error retry
        if (attempt < 2 && aiResult.reason === 'parse_error') {
          return { status: 'failed', translationId: jobRowId,
            error: `AI yanıtı doğrulanamadı (deneme ${attempt}/2). Yeniden deneniyor.` };
        }
        await db.update(contentTranslations)
          .set({ status: 'FAILED', failureReason: aiResult.message ?? aiResult.reason, updatedAt: sql`now()` })
          .where(eq(contentTranslations.id, jobRowId));
        return { status: 'failed', translationId: jobRowId, error: aiResult.message ?? 'Yapay zeka çeviriyi tamamlayamadı.' };
      }

      await db.update(contentTranslations)
        .set({
          status: 'DRAFT', updatedAt: sql`now()`,
          title: aiResult.data.title,
          slug:  aiResult.data.slug  || null,
          excerpt: aiResult.data.excerpt || null,
          body: aiResult.data.body || null,
          metaTitle: aiResult.data.metaTitle || null,
          metaDescription: aiResult.data.metaDescription || null,
          focusKeyword: aiResult.data.focusKeyword || null,
          supportingKeywords: aiResult.data.supportingKeywords?.length ? aiResult.data.supportingKeywords : null,
          imageAlt: aiResult.data.imageAlt || null,
          imageTitle: aiResult.data.imageTitle || null,
          imageCaption: aiResult.data.imageCaption || null,
          aiModel: aiResult.model, aiPromptVersion: PROMPT_VERSION,
        })
        .where(eq(contentTranslations.id, jobRowId));
    }

    // ── Audit log ───────────────────────────────────────────────────────────
    await db.insert(auditLogs).values({
      adminUserId: adminId,
      action: 'translation.ai_complete',
      entityType: 'content_translation',
      entityId: jobRowId,
      metadata: { targetLang, entityType, entityId, status: 'DRAFT' },
    });

    return { status: 'completed', translationId: jobRowId };

  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const msg = isAbort
      ? 'Çeviri zaman aşımına uğradı (45 sn). Yeniden deneyebilirsiniz.'
      : `Beklenmedik hata: ${err instanceof Error ? err.message : String(err)}`;

    await db.update(contentTranslations)
      .set({ status: 'FAILED', failureReason: msg, updatedAt: sql`now()` })
      .where(eq(contentTranslations.id, jobRowId));

    console.error(`[translation-job-runner] ${targetLang} attempt ${attempt}:`, err);
    return { status: 'failed', translationId: jobRowId, error: msg };
  }
}
