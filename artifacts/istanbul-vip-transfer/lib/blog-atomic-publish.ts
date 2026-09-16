import 'server-only';

import {
  CUSTOMER_TRANSLATION_LOCALES,
  computeCustomerContentSourceHash,
  runCustomerTranslationProvider,
} from '@/lib/customer-content-translation';
import {
  normalizeRequiredTranslationFields,
  TranslationOutputSchema,
  type TranslationInput,
  type TranslationOutput,
} from '@/lib/ai/translate';

type BlogSourceSnapshot = {
  title: string;
  slug: string;
  excerpt: string | null;
  body: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  heroImageAlt: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  cta: unknown;
  internalLinks: unknown;
};

export function computeBlogAtomicSourceHash(source: BlogSourceSnapshot): string {
  return computeCustomerContentSourceHash({
    title: source.title,
    slug: source.slug,
    excerpt: source.excerpt,
    body: source.body,
    seoTitle: source.seoTitle,
    seoDescription: source.seoDescription,
    heroImageAlt: source.heroImageAlt,
    ogTitle: source.ogTitle,
    ogDescription: source.ogDescription,
    cta: source.cta,
    internalLinks: source.internalLinks,
  });
}

function validateBlogTranslation(
  value: unknown,
  sourceBody: string | null,
): { ok: true; data: TranslationOutput } | { ok: false; error: string } {
  const parsed = TranslationOutputSchema.safeParse(normalizeRequiredTranslationFields(value));
  if (!parsed.success) {
    return { ok: false, error: 'Çeviri zorunlu alan veya biçim doğrulamasını geçemedi.' };
  }
  if (!/^[a-z0-9-]+$/.test(parsed.data.slug)) {
    return { ok: false, error: 'Çeviri slug alanı güvenli URL biçiminde değil.' };
  }
  const requiredLinks = [...(sourceBody ?? '').matchAll(/\[[^\]]+\]\((\/[^)\s]+)\)/g)]
    .map(match => match[1]);
  const missingLink = requiredLinks.find(href => !parsed.data.body.includes(`](${href})`));
  if (missingLink) {
    return { ok: false, error: `Çeviri zorunlu dahili bağlantıyı korumadı: ${missingLink}` };
  }
  return { ok: true, data: parsed.data };
}

export async function runBlogAtomicTranslationTask(input: {
  jobId: string;
  taskId: string;
  entityId: string;
  targetLang: string;
  sourceHash: string | null;
  force: boolean;
  adminId: string;
  attempt: number;
}) {
  const { db } = await import('@/db');
  const { content, contentTranslations, translationJobTasks } = await import('@/db/schema');
  const { and, eq } = await import('drizzle-orm');

  if (!(CUSTOMER_TRANSLATION_LOCALES as readonly string[]).includes(input.targetLang)) {
    return { status: 'failed' as const, error: 'Bu dil Blog toplu yayın kapsamına dahil değil.' };
  }

  const [source] = await db.select().from(content).where(and(
    eq(content.id, input.entityId),
    eq(content.contentType, 'BLOG_POST'),
  )).limit(1);
  if (!source) return { status: 'failed' as const, error: 'Blog kaynağı bulunamadı.' };
  if (!source.title.trim() || !source.body?.trim()) {
    return { status: 'failed' as const, error: 'Blog başlığı ve gövdesi yayımlama için dolu olmalıdır.' };
  }
  if (!['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED'].includes(source.status)) {
    return { status: 'failed' as const, error: `Blog "${source.status}" durumundayken toplu yayımlanamaz.` };
  }
  if (!input.sourceHash || computeBlogAtomicSourceHash(source) !== input.sourceHash) {
    return { status: 'failed' as const, error: 'Türkçe kaynak çeviri sırasında değişti. Yeniden başlatın.' };
  }

  const [existing] = await db.select({
    id: contentTranslations.id,
    isManuallyLocked: contentTranslations.isManuallyLocked,
    isAiGenerated: contentTranslations.isAiGenerated,
    status: contentTranslations.status,
  }).from(contentTranslations).where(and(
    eq(contentTranslations.entityType, 'content'),
    eq(contentTranslations.entityId, input.entityId),
    eq(contentTranslations.targetLanguageCode, input.targetLang),
  )).limit(1);
  if (
    existing &&
    !input.force &&
    (existing.isManuallyLocked ||
      (!existing.isAiGenerated && !['NOT_STARTED', 'FAILED'].includes(existing.status)))
  ) {
    return {
      status: 'needs_confirmation' as const,
      translationId: existing.id,
      error: 'Elle düzenlenmiş çeviri — toplu yayın için üzerine yazma onayı gerekli.',
    };
  }

  const sourceInput: TranslationInput = {
    title: source.title,
    slug: source.slug,
    excerpt: source.excerpt,
    body: source.body,
    metaTitle: source.seoTitle,
    metaDescription: source.seoDescription,
    imageAlt: source.heroImageAlt,
  };

  let raw: unknown;
  let model: string | null = null;
  if (process.env.NODE_ENV === 'test') {
    const fake = await runCustomerTranslationProvider({
      entityType: 'content',
      entityId: input.entityId,
      targetLanguageCode: input.targetLang as (typeof CUSTOMER_TRANSLATION_LOCALES)[number],
      sourceHash: input.sourceHash,
    });
    if (!fake.ok) {
      return { status: 'failed' as const, translationId: existing?.id, error: fake.error ?? 'Sahte çeviri sağlayıcısı başarısız oldu.' };
    }
    raw = fake.fields;
  } else {
    const { resolveIntegrationSecret } = await import('@/lib/integration-secrets');
    if (!await resolveIntegrationSecret('OPENAI_API_KEY')) {
      return { status: 'failed' as const, translationId: existing?.id, error: 'OpenAI çeviri servisi yapılandırılmamış.' };
    }
    const { translateContent } = await import('@/lib/ai/translate');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    try {
      const result = await translateContent(sourceInput, input.targetLang, controller.signal);
      if (!result.ok) {
        const retryable = input.attempt < 2 && result.reason === 'parse_error';
        return {
          status: 'failed' as const,
          translationId: existing?.id,
          error: retryable
            ? `AI yanıtı doğrulanamadı (deneme ${input.attempt}/2). Yeniden deneniyor.`
            : (result.message ?? 'Yapay zeka çeviriyi tamamlayamadı.'),
        };
      }
      raw = result.data;
      model = result.model;
    } finally {
      clearTimeout(timer);
    }
  }

  const validated = validateBlogTranslation(raw, source.body);
  if (!validated.ok) {
    return { status: 'failed' as const, translationId: existing?.id, error: validated.error };
  }
  await db.update(translationJobTasks).set({
    resultPayload: { ...validated.data, aiModel: model },
    updatedAt: new Date(),
  }).where(and(
    eq(translationJobTasks.id, input.taskId),
    eq(translationJobTasks.jobId, input.jobId),
  ));
  return { status: 'completed' as const, translationId: existing?.id };
}

export async function finalizeBlogAtomicPublish(jobId: string, adminId: string) {
  const { db } = await import('@/db');
  const {
    auditLogs,
    content,
    contentTranslations,
    translationJobs,
    translationJobTasks,
  } = await import('@/db/schema');
  const { and, eq, inArray, sql } = await import('drizzle-orm');

  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`blog-publish:${jobId}`}))`);
    const [job] = await tx.select().from(translationJobs)
      .where(eq(translationJobs.id, jobId)).limit(1);
    if (!job?.publishOnComplete) return { finalized: false, reason: 'not_atomic_blog_job' as const };

    const tasks = await tx.select().from(translationJobTasks)
      .where(eq(translationJobTasks.jobId, jobId));
    const expected = new Set<string>(CUSTOMER_TRANSLATION_LOCALES);
    if (
      tasks.length !== expected.size ||
      tasks.some(task => task.status !== 'COMPLETED' || !expected.delete(task.targetLanguageCode))
    ) {
      return { finalized: false, reason: 'tasks_incomplete' as const };
    }

    const [source] = await tx.select().from(content).where(and(
      eq(content.id, job.entityId),
      eq(content.contentType, 'BLOG_POST'),
    )).limit(1);
    if (!source) throw new Error('Blog kaynağı bulunamadı.');
    if (!job.sourceHash || computeBlogAtomicSourceHash(source) !== job.sourceHash) {
      throw new Error('Türkçe kaynak çeviri sırasında değişti. Yayın tamamlanmadı.');
    }
    if (!['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED'].includes(source.status)) {
      throw new Error(`Blog "${source.status}" durumundayken yayımlanamaz.`);
    }

    const existing = await tx.select({
      locale: contentTranslations.targetLanguageCode,
      slug: contentTranslations.slug,
      isManuallyLocked: contentTranslations.isManuallyLocked,
    }).from(contentTranslations).where(and(
      eq(contentTranslations.entityType, 'content'),
      eq(contentTranslations.entityId, source.id),
      inArray(contentTranslations.targetLanguageCode, [...CUSTOMER_TRANSLATION_LOCALES]),
    ));
    if (!job.force && existing.some(row => row.isManuallyLocked)) {
      throw new Error('Elle kilitlenmiş çeviri değişti. Yayın tamamlanmadı.');
    }

    const now = new Date();
    for (const task of tasks) {
      const validated = validateBlogTranslation(task.resultPayload, source.body);
      if (!validated.ok) throw new Error(`${task.targetLanguageCode.toUpperCase()}: ${validated.error}`);
      const data = validated.data;
      await tx.insert(contentTranslations).values({
        entityType: 'content',
        entityId: source.id,
        targetLanguageCode: task.targetLanguageCode,
        sourceLanguageCode: 'tr',
        status: 'PUBLISHED',
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt,
        body: data.body,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        focusKeyword: data.focusKeyword || null,
        supportingKeywords: data.supportingKeywords.length ? data.supportingKeywords : null,
        imageAlt: data.imageAlt || null,
        imageTitle: data.imageTitle || null,
        imageCaption: data.imageCaption || null,
        sourceHash: job.sourceHash,
        isAiGenerated: true,
        aiModel: typeof task.resultPayload?.aiModel === 'string' ? task.resultPayload.aiModel : null,
        publishedAt: now,
        approvedAt: now,
        approvedBy: adminId,
        failureReason: null,
        updatedBy: adminId,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: [
          contentTranslations.entityType,
          contentTranslations.entityId,
          contentTranslations.targetLanguageCode,
        ],
        set: {
          status: 'PUBLISHED',
          title: data.title,
          slug: data.slug,
          excerpt: data.excerpt,
          body: data.body,
          metaTitle: data.metaTitle,
          metaDescription: data.metaDescription,
          focusKeyword: data.focusKeyword || null,
          supportingKeywords: data.supportingKeywords.length ? data.supportingKeywords : null,
          imageAlt: data.imageAlt || null,
          imageTitle: data.imageTitle || null,
          imageCaption: data.imageCaption || null,
          sourceHash: job.sourceHash,
          isAiGenerated: true,
          aiModel: typeof task.resultPayload?.aiModel === 'string' ? task.resultPayload.aiModel : null,
          publishedAt: now,
          approvedAt: now,
          approvedBy: adminId,
          failureReason: null,
          updatedBy: adminId,
          updatedAt: now,
        },
      });
    }

    await tx.update(content).set({
      status: 'PUBLISHED',
      publishedAt: source.publishedAt ?? now,
      approvedAt: source.approvedAt ?? now,
      approvedBy: source.approvedBy ?? adminId,
      scheduledAt: null,
      updatedAt: now,
    } as never).where(eq(content.id, source.id));
    await tx.insert(auditLogs).values({
      adminUserId: adminId,
      action: 'blog.publish_all_languages',
      entityType: 'blog_post',
      entityId: source.id,
      metadata: { jobId, sourceHash: job.sourceHash, locales: [...CUSTOMER_TRANSLATION_LOCALES] },
      createdAt: now,
    } as never);
    await tx.update(translationJobs).set({
      publishOnComplete: false,
      updatedAt: now,
    }).where(eq(translationJobs.id, jobId));

    return {
      finalized: true,
      blogId: source.id,
      slug: source.slug,
      previousLocalizedSlugs: existing.map(row => ({ locale: row.locale, slug: row.slug })),
    };
  });
}