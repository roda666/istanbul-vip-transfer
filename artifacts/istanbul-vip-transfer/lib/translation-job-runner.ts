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

export type RunTaskEntityType = 'content' | 'service_page' | 'faq' | 'vehicle' | 'navigation' | 'optional_service' | 'category' | 'transfer_route' | 'homepage';

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

  const { content, contentTranslations, auditLogs, faqs, vehicles, navigationItems, optionalServices, serviceCategories, transferRoutes, transferRouteTranslations } = schema;

  // ── Validate AI config ────────────────────────────────────────────────────
  const { resolveIntegrationSecret } = await import('@/lib/integration-secrets');
  if (!await resolveIntegrationSecret('OPENAI_API_KEY') && process.env.NODE_ENV !== 'test') {
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

  // A replacement failure must not remove the last valid customer-facing
  // translation. enqueueCustomerContentTranslations marks published rows
  // OUTDATED before work starts; keep that public-safe state (and preserve
  // legacy PUBLISHED rows such as manually locked homepage records) instead of
  // turning the only usable translation into an invisible FAILED row.
  const failedTranslationStatus =
    existing && ['PUBLISHED', 'OUTDATED'].includes(existing.status)
      ? existing.status
      : 'FAILED';

  // ── Upsert contentTranslations row to TRANSLATING ─────────────────────────
  let jobRowId: string;

  if (existing) {
    await db
      .update(contentTranslations)
      .set({
        // Keep the last published homepage payload live while replacement
        // translation is running; a failed task must not blank the public page.
        ...(entityType === 'homepage' && existing.status === 'PUBLISHED' ? {} : { status: 'TRANSLATING' }),
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
  let optionalFields: Record<string, string> | null = null;
  let homepageSections: import('@/lib/homepage-types').HomepageSections | null = null;

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
           .set({ status: failedTranslationStatus, failureReason: 'Body yapısı geçersiz', updatedAt: sql`now()` })
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
  } else if (entityType === 'optional_service') {
    const [row] = await db.select({
      name: optionalServices.name,
      shortDescription: optionalServices.shortDescription,
    }).from(optionalServices).where(eq(optionalServices.id, entityId)).limit(1);
    if (row) optionalFields = { name: row.name, shortDescription: row.shortDescription ?? '' };
  } else if (entityType === 'category') {
    // Categories use a deterministic UUID adapter in the durable job. Resolve
    // it against the small taxonomy table rather than storing a second ID.
    const { customerTranslationEntityId } = await import('@/lib/customer-content-translation');
    const categories = await db.select().from(serviceCategories);
    const row = categories.find(category => customerTranslationEntityId('category', String(category.id)) === entityId);
    if (row) sourceInput = {
      title: String((row.nameTranslations as Record<string, string>)?.tr ?? ''),
      slug: row.slug, excerpt: null, body: null, metaTitle: null, metaDescription: null, imageAlt: null,
    };
  } else if (entityType === 'transfer_route') {
    const [row] = await db.select().from(transferRoutes).where(eq(transferRoutes.id, entityId)).limit(1);
    if (row) sourceInput = {
      title: row.name, slug: row.slug, excerpt: row.introParagraph, body: row.description,
      metaTitle: row.seoTitle, metaDescription: row.seoDescription, imageAlt: row.imageAltText,
    };
  } else if (entityType === 'homepage') {
    const [row] = await db.select({ body: content.body }).from(content).where(eq(content.id, entityId)).limit(1);
    if (row) {
      const { parseHomepageSections } = await import('@/lib/homepage-types');
      homepageSections = parseHomepageSections(row.body);
    }
  }

  const entityFound = entityType === 'service_page'
    ? spFields !== null
    : entityType === 'optional_service' ? optionalFields !== null
      : entityType === 'homepage' ? homepageSections !== null : sourceInput !== null;
  if (!entityFound) {
    await db.update(contentTranslations)
      .set({ status: failedTranslationStatus, failureReason: 'Kaynak içerik bulunamadı', updatedAt: sql`now()` })
      .where(eq(contentTranslations.id, jobRowId));
    return { status: 'failed', translationId: jobRowId, error: 'Kaynak içerik bulunamadı.' };
  }

  // A validated result may be public immediately only when its Turkish source
  // is public. Draft/unpublished sources deliberately remain drafts.
  let publishValidated = false;
  if (entityType === 'content' || entityType === 'service_page') {
    const [row] = await db.select({ status: content.status }).from(content).where(eq(content.id, entityId)).limit(1);
    publishValidated = row?.status === 'PUBLISHED';
  } else if (entityType === 'faq') {
    publishValidated = true;
  } else if (entityType === 'navigation') {
    publishValidated = true;
  } else if (entityType === 'homepage') {
    const [row] = await db.select({ status: content.status }).from(content).where(eq(content.id, entityId)).limit(1);
    publishValidated = row?.status === 'PUBLISHED';
  }

  // ── Run AI with 45-second timeout ─────────────────────────────────────────
  const TIMEOUT_MS = 45_000;

  try {
    // Category and transfer-route records have dedicated destinations. They
    // still use the same validated content prompt, but are committed through
    // their adapters and published atomically with the validated result.
    if (entityType === 'homepage' && homepageSections) {
      const { extractTranslatableFields, syncSharedFields, applyTranslatedFields, buildInitialTargetSections } = await import('@/lib/homepage-sync');
      const { HOMEPAGE_FALLBACK, isHomepageSections } = await import('@/lib/homepage-types');
      const { runCustomerTranslationProvider } = await import('@/lib/customer-content-translation');
      let translatedFields: Record<string, string | null> | null = null;
      let model: string | null = null;
      if (process.env.NODE_ENV === 'test') {
        const fake = await runCustomerTranslationProvider({
          entityType, entityId, targetLanguageCode: targetLang as never, sourceHash: '',
        });
        if (!fake.ok) {
          const error = fake.error ?? 'Sahte homepage çeviri sağlayıcısı başarısız oldu.';
          await db.update(contentTranslations).set({ status: existing?.status === 'PUBLISHED' ? 'PUBLISHED' : 'FAILED', failureReason: error, failedAt: sql`now()`, updatedAt: sql`now()` }).where(eq(contentTranslations.id, jobRowId));
          return { status: 'failed', translationId: jobRowId, error };
        }
        translatedFields = fake.fields ?? {};
      } else {
        const { translateHomepageFields } = await import('@/lib/ai/translate-homepage');
        const ai = await translateHomepageFields(extractTranslatableFields(homepageSections), targetLang);
        if (!ai.ok) {
          const error = ai.message ?? ai.reason;
          await db.update(contentTranslations).set({ status: existing?.status === 'PUBLISHED' ? 'PUBLISHED' : 'FAILED', failureReason: error, failedAt: sql`now()`, updatedAt: sql`now()` }).where(eq(contentTranslations.id, jobRowId));
          return { status: 'failed', translationId: jobRowId, error };
        }
        translatedFields = ai.translated as Record<string, string | null>;
        model = ai.model;
      }
      const [existingHomepage] = await db.select({ body: contentTranslations.body }).from(contentTranslations).where(eq(contentTranslations.id, jobRowId)).limit(1);
      let targetSections = (existingHomepage?.body ? (() => {
        try { return JSON.parse(existingHomepage.body!) as import('@/lib/homepage-types').HomepageSections; } catch { return null; }
      })() : null);
      targetSections = syncSharedFields(
        targetSections ?? buildInitialTargetSections(homepageSections, (HOMEPAGE_FALLBACK[targetLang] ?? HOMEPAGE_FALLBACK.en) as import('@/lib/homepage-types').HomepageSections),
        homepageSections,
      );
      const completedSections = applyTranslatedFields(targetSections, translatedFields as Record<string, string>);
      if (!isHomepageSections(completedSections)) {
        const error = 'Homepage çeviri yapısı doğrulanamadı.';
        await db.update(contentTranslations).set({ status: existing?.status === 'PUBLISHED' ? 'PUBLISHED' : 'FAILED', failureReason: error, failedAt: sql`now()`, updatedAt: sql`now()` }).where(eq(contentTranslations.id, jobRowId));
        return { status: 'failed', translationId: jobRowId, error };
      }
      const [homepageJob] = await db.select({ sourceHash: schema.translationJobs.sourceHash })
        .from(schema.translationJobs).where(eq(schema.translationJobs.id, params.jobId)).limit(1);
      await db.update(contentTranslations).set({
        status: publishValidated || existing?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        body: JSON.stringify(completedSections), sourceHash: homepageJob?.sourceHash ?? null,
        isAiGenerated: true, aiModel: model, ...(publishValidated ? { publishedAt: sql`now()` } : {}),
        updatedAt: sql`now()`,
      }).where(eq(contentTranslations.id, jobRowId));
      const { revalidatePath, revalidateTag } = await import('next/cache');
      const { PUBLIC_CHROME_TAG } = await import('@/lib/public-chrome-cache');
      revalidatePath(`/${targetLang}`);
      revalidateTag(PUBLIC_CHROME_TAG);
      return { status: 'completed', translationId: jobRowId };
    }

    if ((entityType === 'category' || entityType === 'transfer_route') && sourceInput) {
      const { runCustomerTranslationProvider } = await import('@/lib/customer-content-translation');
      let translated: { title?: string | null; body?: string | null; metaTitle?: string | null; metaDescription?: string | null };
      let model: string | null = null;
      if (process.env.NODE_ENV === 'test') {
        const fake = await runCustomerTranslationProvider({
          entityType,
          entityId,
          targetLanguageCode: targetLang as never,
          sourceHash: '',
        });
        if (!fake.ok || !fake.fields?.title) {
          const error = fake.error ?? 'Sahte çeviri sağlayıcısı geçersiz sonuç döndürdü.';
          await db.update(contentTranslations).set({ status: failedTranslationStatus, failureReason: error, failedAt: sql`now()`, updatedAt: sql`now()` }).where(eq(contentTranslations.id, jobRowId));
          return { status: 'failed', translationId: jobRowId, error };
        }
        translated = { title: fake.fields.title, body: fake.fields.body, metaTitle: fake.fields.metaTitle, metaDescription: fake.fields.metaDescription };
      } else {
        const { translateContent } = await import('@/lib/ai/translate');
        const ai = await translateContent(sourceInput, targetLang, undefined);
        if (!ai.ok || !ai.data.title?.trim() || (entityType === 'transfer_route' && !ai.data.body?.trim())) {
          const error = ai.ok ? 'Çeviri zorunlu alanları boş döndürdü.' : (ai.message ?? ai.reason);
          await db.update(contentTranslations).set({ status: failedTranslationStatus, failureReason: error, failedAt: sql`now()`, updatedAt: sql`now()` }).where(eq(contentTranslations.id, jobRowId));
          return { status: 'failed', translationId: jobRowId, error };
        }
        translated = ai.data;
        model = ai.model;
      }
      const [job] = await db.select({ sourceHash: schema.translationJobs.sourceHash })
        .from(schema.translationJobs).where(eq(schema.translationJobs.id, params.jobId)).limit(1);
      const sourceHash = job?.sourceHash ?? null;
      let sourceStatus: { active: boolean } | undefined;
      if (entityType === 'category') {
        const { customerTranslationEntityId } = await import('@/lib/customer-content-translation');
        const categories = await db.select({ id: serviceCategories.id, active: serviceCategories.isActive }).from(serviceCategories);
        sourceStatus = categories.find(item => customerTranslationEntityId('category', String(item.id)) === entityId);
      } else {
        [sourceStatus] = await db.select({ active: transferRoutes.active }).from(transferRoutes).where(eq(transferRoutes.id, entityId)).limit(1);
      }
      const shouldPublish = sourceStatus?.active === true;

      if (entityType === 'category') {
        const { customerTranslationEntityId } = await import('@/lib/customer-content-translation');
        const categories = await db.select().from(serviceCategories);
        const category = categories.find(item => customerTranslationEntityId('category', String(item.id)) === entityId);
        if (!category) throw new Error('Kategori bulunamadı.');
        const names = { ...((category.nameTranslations ?? {}) as Record<string, string>), [targetLang]: translated.title!.trim() };
        await db.transaction(async tx => {
          await tx.update(serviceCategories).set({ nameTranslations: names, updatedAt: new Date() }).where(eq(serviceCategories.id, category.id));
          await tx.update(contentTranslations).set({
            status: shouldPublish ? 'PUBLISHED' : 'DRAFT', title: translated.title!.trim(),
            sourceHash, aiModel: model, isAiGenerated: true, publishedAt: shouldPublish ? new Date() : null, updatedAt: new Date(),
          }).where(eq(contentTranslations.id, jobRowId));
        });
      } else {
        const [existingRoute] = await db.select().from(transferRouteTranslations).where(and(
          eq(transferRouteTranslations.routeId, entityId), eq(transferRouteTranslations.languageCode, targetLang),
        )).limit(1);
        if (existingRoute?.isManuallyLocked && !force) {
          return { status: 'needs_confirmation', translationId: jobRowId, error: 'Elle kilitlenmiş rota çevirisi.' };
        }
        await db.transaction(async tx => {
          const values: Record<string, unknown> = {
            title: translated.title!.trim(), description: translated.body!.trim(),
            seoTitle: translated.metaTitle ?? null, seoDescription: translated.metaDescription ?? null,
            status: shouldPublish ? 'PUBLISHED' : 'DRAFT',
            publishedAt: shouldPublish ? new Date() : null, updatedAt: new Date(),
          } as never;
          if (existingRoute) await tx.update(transferRouteTranslations).set(values).where(eq(transferRouteTranslations.id, existingRoute.id));
          else await tx.insert(transferRouteTranslations).values({ routeId: entityId, languageCode: targetLang, ...values } as never);
          await tx.update(contentTranslations).set({
            status: shouldPublish ? 'PUBLISHED' : 'DRAFT', title: translated.title!.trim(), body: translated.body!.trim(),
            sourceHash, aiModel: model, isAiGenerated: true, publishedAt: shouldPublish ? new Date() : null, updatedAt: new Date(),
          }).where(eq(contentTranslations.id, jobRowId));
        });
      }
      return { status: 'completed', translationId: jobRowId };
    }

    if (entityType === 'optional_service' && optionalFields) {
      const { translateServicePageFields } = await import('@/lib/ai/translate-service-page');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let result: Awaited<ReturnType<typeof translateServicePageFields>>;
      try {
        result = await translateServicePageFields(optionalFields, targetLang, controller.signal);
      } finally {
        clearTimeout(timer);
      }
      if (!result.ok || !result.translated.name?.trim() || !result.translated.shortDescription?.trim()) {
        const error = result.ok ? 'Ek hizmet çevirisi boş alan döndürdü.' : (result.message ?? result.reason);
        await db.update(contentTranslations)
          .set({ status: failedTranslationStatus, failureReason: error, updatedAt: sql`now()` })
          .where(eq(contentTranslations.id, jobRowId));
        return { status: 'failed', translationId: jobRowId, error };
      }
      await db.update(contentTranslations).set({
          status: publishValidated ? 'PUBLISHED' : 'DRAFT',
        serviceName: result.translated.name.trim(),
        serviceShortDescription: result.translated.shortDescription.trim(),
        title: result.translated.name.trim(),
        excerpt: result.translated.shortDescription.trim(),
        aiModel: result.model,
        aiPromptVersion: 'optional-service-1.0',
        updatedAt: sql`now()`,
      }).where(eq(contentTranslations.id, jobRowId));
    } else if (entityType === 'service_page' && spFields && spRawBody && spAuxRow) {
      const { translateServicePageFields } = await import('@/lib/ai/translate-service-page');
      const { parseServicePageBody, applyTranslatedFields, isServicePageBody, computeTranslatableHash }
        = await import('@/lib/service-page-types');

      if (process.env.NODE_ENV === 'test') {
        const { runCustomerTranslationProvider } = await import('@/lib/customer-content-translation');
        const fake = await runCustomerTranslationProvider({
          entityType, entityId, targetLanguageCode: targetLang as never, sourceHash: '',
        });
        if (!fake.ok || !fake.fields) {
          const error = fake.error ?? 'Sahte çeviri sağlayıcısı geçersiz sonuç döndürdü.';
          await db.update(contentTranslations).set({ status: failedTranslationStatus, failureReason: error, failedAt: sql`now()`, updatedAt: sql`now()` }).where(eq(contentTranslations.id, jobRowId));
          return { status: 'failed', translationId: jobRowId, error };
        }
        const sourceBodyParsed = parseServicePageBody(spRawBody)!;
        const translatedBody = applyTranslatedFields(sourceBodyParsed, fake.fields as Record<string, string>);
        if (!isServicePageBody(translatedBody)) {
          const error = 'Sahte çeviri sağlayıcısı geçersiz hizmet gövdesi döndürdü.';
          await db.update(contentTranslations).set({ status: failedTranslationStatus, failureReason: error, failedAt: sql`now()`, updatedAt: sql`now()` }).where(eq(contentTranslations.id, jobRowId));
          return { status: 'failed', translationId: jobRowId, error };
        }
        await db.update(contentTranslations).set({
          status: publishValidated ? 'PUBLISHED' : 'DRAFT', body: JSON.stringify(translatedBody),
          title: translatedBody.hero.title || null, isAiGenerated: true, publishedAt: publishValidated ? sql`now()` : null,
          updatedAt: sql`now()`,
        }).where(eq(contentTranslations.id, jobRowId));
        return { status: 'completed', translationId: jobRowId };
      }

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
          .set({ status: failedTranslationStatus, failureReason: spResult.message ?? spResult.reason, updatedAt: sql`now()` })
          .where(eq(contentTranslations.id, jobRowId));
        return { status: 'failed', translationId: jobRowId, error: spResult.message ?? 'Yapay zeka çeviriyi tamamlayamadı.' };
      }

      const sourceBodyParsed = parseServicePageBody(spRawBody)!;
      const translatedBody   = applyTranslatedFields(sourceBodyParsed, spResult.translated);

      if (!isServicePageBody(translatedBody)) {
        await db.update(contentTranslations)
          .set({ status: failedTranslationStatus, failureReason: 'AI yanıtı geçerli ServicePageBody yapısı döndürmedi', updatedAt: sql`now()` })
          .where(eq(contentTranslations.id, jobRowId));
        return { status: 'failed', translationId: jobRowId, error: 'AI yanıtı geçerli hizmet sayfası yapısı değil.' };
      }

      const sourceHash = computeTranslatableHash(sourceBodyParsed);
      await db.update(contentTranslations)
        .set({
          status: publishValidated ? 'PUBLISHED' : 'DRAFT', publishedAt: publishValidated ? sql`now()` : null, updatedAt: sql`now()`,
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
      if (process.env.NODE_ENV === 'test') {
        const { runCustomerTranslationProvider } = await import('@/lib/customer-content-translation');
        const fake = await runCustomerTranslationProvider({
          entityType: entityType as never,
          entityId,
          targetLanguageCode: targetLang as never,
          sourceHash: '',
        });
        if (!fake.ok || !fake.fields?.title?.trim()) {
          const error = fake.error ?? 'Sahte çeviri sağlayıcısı geçersiz sonuç döndürdü.';
          await db.update(contentTranslations)
            .set({ status: failedTranslationStatus, failureReason: error, failedAt: sql`now()`, updatedAt: sql`now()` })
            .where(eq(contentTranslations.id, jobRowId));
          return { status: 'failed', translationId: jobRowId, error };
        }
        await db.update(contentTranslations).set({
          status: publishValidated ? 'PUBLISHED' : 'DRAFT',
          publishedAt: publishValidated ? sql`now()` : null,
          title: fake.fields.title.trim(),
          body: fake.fields.body ?? null,
          excerpt: fake.fields.excerpt ?? null,
          metaTitle: fake.fields.metaTitle ?? null,
          metaDescription: fake.fields.metaDescription ?? null,
          isAiGenerated: true,
          updatedAt: sql`now()`,
        }).where(eq(contentTranslations.id, jobRowId));
        return { status: 'completed', translationId: jobRowId };
      }
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
          .set({ status: failedTranslationStatus, failureReason: aiResult.message ?? aiResult.reason, updatedAt: sql`now()` })
          .where(eq(contentTranslations.id, jobRowId));
        return { status: 'failed', translationId: jobRowId, error: aiResult.message ?? 'Yapay zeka çeviriyi tamamlayamadı.' };
      }

      await db.update(contentTranslations)
        .set({
           status: publishValidated ? 'PUBLISHED' : 'DRAFT', publishedAt: publishValidated ? sql`now()` : null, updatedAt: sql`now()`,
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
      .set({ status: failedTranslationStatus, failureReason: msg, updatedAt: sql`now()` })
      .where(eq(contentTranslations.id, jobRowId));

    console.error(`[translation-job-runner] ${targetLang} attempt ${attempt}:`, err);
    return { status: 'failed', translationId: jobRowId, error: msg };
  }
}
