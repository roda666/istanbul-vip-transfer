import { afterEach, describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  adminUsers,
  content,
  contentTranslations,
  translationJobs,
  translationJobTasks,
} from '@/db/schema';
import {
  CUSTOMER_TRANSLATION_LOCALES,
  enqueueCustomerContentTranslations,
  installCustomerTranslationTestProvider,
} from '@/lib/customer-content-translation';
import {
  computeBlogAtomicSourceHash,
  finalizeBlogAtomicPublish,
  runBlogAtomicTranslationTask,
} from '@/lib/blog-atomic-publish';

function translatedFields(locale: string) {
  return {
    title: `Translated ${locale}`,
    slug: `translated-${locale}`,
    excerpt: `Translated excerpt ${locale}`,
    body: `Translated body ${locale} [internal](/internal-link)`,
    metaTitle: `Translated meta ${locale}`,
    metaDescription: `Translated meta description ${locale}`,
    focusKeyword: `keyword-${locale}`,
    supportingKeywords: [`support-${locale}`],
    imageAlt: '',
    imageTitle: '',
    imageCaption: '',
  };
}

describe.sequential('Blog atomic all-language publish', () => {
  afterEach(() => installCustomerTranslationTestProvider(null));

  async function fixture() {
    const adminId = crypto.randomUUID();
    const contentId = crypto.randomUUID();
    await db.insert(adminUsers).values({
      id: adminId,
      email: `${adminId}@blog-atomic.invalid`,
      name: 'Blog atomic test admin',
      passwordHash: 'test-only',
      role: 'SUPER_ADMIN',
      active: true,
    } as never);
    const [source] = await db.insert(content).values({
      id: contentId,
      title: `Atomic Blog ${contentId}`,
      slug: `atomic-blog-${contentId}`,
      excerpt: 'Kaynak özet',
      body: 'Kaynak gövde [internal](/internal-link)',
      contentType: 'BLOG_POST',
      status: 'DRAFT',
      createdBy: adminId,
      updatedBy: adminId,
    } as never).returning();
    return { adminId, contentId, source };
  }

  async function cleanup(adminId: string, contentId: string, jobIds: string[]) {
    if (jobIds.length) {
      await db.delete(translationJobTasks).where(inArray(translationJobTasks.jobId, jobIds));
      await db.delete(translationJobs).where(inArray(translationJobs.id, jobIds));
    }
    await db.delete(contentTranslations).where(eq(contentTranslations.entityId, contentId));
    await db.delete(content).where(eq(content.id, contentId));
    await db.delete(adminUsers).where(eq(adminUsers.id, adminId));
  }

  it('publishes Turkish and exactly eight validated translations in one final transaction', async () => {
    const { adminId, contentId, source } = await fixture();
    const jobIds: string[] = [];
    try {
      const queued = await enqueueCustomerContentTranslations({
        entityType: 'content',
        entityId: contentId,
        sourceHash: computeBlogAtomicSourceHash(source),
        adminId,
        publishOnComplete: true,
        preservePublishedWhileRunning: true,
      });
      jobIds.push(queued.jobId);
      installCustomerTranslationTestProvider(async ({ targetLanguageCode }) => ({
        ok: true,
        fields: translatedFields(targetLanguageCode),
      }));
      const tasks = await db.select().from(translationJobTasks)
        .where(eq(translationJobTasks.jobId, queued.jobId));
      for (const task of tasks) {
        const result = await runBlogAtomicTranslationTask({
          jobId: queued.jobId,
          taskId: task.id,
          entityId: contentId,
          targetLang: task.targetLanguageCode,
          sourceHash: computeBlogAtomicSourceHash(source),
          force: false,
          adminId,
          attempt: 1,
        });
        expect(result.status).toBe('completed');
        await db.update(translationJobTasks).set({ status: 'COMPLETED' })
          .where(eq(translationJobTasks.id, task.id));
      }

      const finalized = await finalizeBlogAtomicPublish(queued.jobId, adminId);
      expect(finalized.finalized).toBe(true);
      const [publishedSource] = await db.select({ status: content.status }).from(content)
        .where(eq(content.id, contentId));
      expect(publishedSource.status).toBe('PUBLISHED');
      const translations = await db.select().from(contentTranslations).where(and(
        eq(contentTranslations.entityType, 'content'),
        eq(contentTranslations.entityId, contentId),
      ));
      expect(translations).toHaveLength(8);
      expect(translations.map(row => row.targetLanguageCode).sort())
        .toEqual([...CUSTOMER_TRANSLATION_LOCALES].sort());
      expect(translations.every(row => row.status === 'PUBLISHED')).toBe(true);
    } finally {
      await cleanup(adminId, contentId, jobIds);
    }
  });

  it('keeps the source and previous public translation unchanged when one locale fails', async () => {
    const { adminId, contentId, source } = await fixture();
    const jobIds: string[] = [];
    try {
      const [oldEnglish] = await db.insert(contentTranslations).values({
        entityType: 'content',
        entityId: contentId,
        targetLanguageCode: 'en',
        status: 'PUBLISHED',
        title: 'Old public English',
        slug: 'old-public-english',
        body: 'Old public body',
        isAiGenerated: true,
        publishedAt: new Date(),
      } as never).returning();
      const queued = await enqueueCustomerContentTranslations({
        entityType: 'content',
        entityId: contentId,
        sourceHash: computeBlogAtomicSourceHash(source),
        adminId,
        publishOnComplete: true,
        preservePublishedWhileRunning: true,
      });
      jobIds.push(queued.jobId);
      installCustomerTranslationTestProvider(async ({ targetLanguageCode }) =>
        targetLanguageCode === 'de'
          ? { ok: false, error: 'fake locale failure' }
          : { ok: true, fields: translatedFields(targetLanguageCode) });
      const tasks = await db.select().from(translationJobTasks)
        .where(eq(translationJobTasks.jobId, queued.jobId));
      for (const task of tasks) {
        const result = await runBlogAtomicTranslationTask({
          jobId: queued.jobId,
          taskId: task.id,
          entityId: contentId,
          targetLang: task.targetLanguageCode,
          sourceHash: computeBlogAtomicSourceHash(source),
          force: false,
          adminId,
          attempt: 1,
        });
        await db.update(translationJobTasks).set({
          status: result.status === 'completed' ? 'COMPLETED' : 'FAILED',
          errorMessage: result.error ?? null,
        }).where(eq(translationJobTasks.id, task.id));
      }

      const finalized = await finalizeBlogAtomicPublish(queued.jobId, adminId);
      expect(finalized).toMatchObject({ finalized: false, reason: 'tasks_incomplete' });
      const [unchangedSource] = await db.select({ status: content.status }).from(content)
        .where(eq(content.id, contentId));
      expect(unchangedSource.status).toBe('DRAFT');
      const [unchangedEnglish] = await db.select().from(contentTranslations)
        .where(eq(contentTranslations.id, oldEnglish.id));
      expect(unchangedEnglish).toMatchObject({
        status: 'PUBLISHED',
        title: 'Old public English',
        slug: 'old-public-english',
        body: 'Old public body',
      });
      expect(await db.select().from(contentTranslations).where(eq(contentTranslations.entityId, contentId)))
        .toHaveLength(1);
    } finally {
      await cleanup(adminId, contentId, jobIds);
    }
  });
});