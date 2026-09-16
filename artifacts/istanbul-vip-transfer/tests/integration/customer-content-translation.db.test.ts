import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  content,
  contentTranslations,
  translationJobs,
  translationJobTasks,
  adminUsers,
} from '@/db/schema';
import {
  computeCustomerContentSourceHash,
  enqueueCustomerContentTranslations,
  installCustomerTranslationTestProvider,
} from '@/lib/customer-content-translation';
import { CUSTOMER_TRANSLATION_LOCALES } from '@/lib/customer-content-translation';
import { runTranslationTask } from '@/lib/translation-job-runner';

/**
 * These tests deliberately use UUID-scoped rows and remove every row in
 * finally. No production content is selected by a broad delete predicate.
 * The provider seam is active only under NODE_ENV=test.
 */
describe.sequential('customer translation database workflow', () => {
  const adminId = crypto.randomUUID();
  const contentId = crypto.randomUUID();
  const source = {
    title: `DB integration title ${contentId}`,
    slug: `db-integration-${contentId}`,
    excerpt: 'Airport transfer excerpt',
    body: 'Price €100; token {{booking_id}}; [internal](/tr/istanbul); code `VIP-100`.',
  };
  const hash1 = computeCustomerContentSourceHash(source);
  const hash2 = computeCustomerContentSourceHash({ ...source, title: `${source.title} changed` });
  let jobIds: string[] = [];

  beforeAll(async () => {
    await db.insert(adminUsers).values({
      id: adminId,
      email: `${adminId}@integration.invalid`,
      name: 'Translation integration admin',
      passwordHash: 'test-only',
      role: 'SUPER_ADMIN',
      active: true,
    } as never);
    await db.insert(content).values({
      id: contentId,
      title: source.title,
      slug: source.slug,
      excerpt: source.excerpt,
      body: source.body,
      contentType: 'BLOG_POST',
      status: 'PUBLISHED',
      createdBy: adminId,
      updatedBy: adminId,
    } as never);
  });

  afterAll(async () => {
    installCustomerTranslationTestProvider(null);
    if (jobIds.length) {
      await db.delete(translationJobTasks).where(inArray(translationJobTasks.jobId, jobIds));
      await db.delete(translationJobs).where(inArray(translationJobs.id, jobIds));
    }
    await db.delete(contentTranslations).where(eq(contentTranslations.entityId, contentId));
    await db.delete(content).where(eq(content.id, contentId));
    await db.delete(adminUsers).where(eq(adminUsers.id, adminId));
  });

  it('creates one job and exactly eight tasks, then deduplicates the same hash', async () => {
    const first = await enqueueCustomerContentTranslations({
      entityType: 'content',
      entityId: contentId,
      sourceHash: hash1,
      adminId,
    });
    const duplicate = await enqueueCustomerContentTranslations({
      entityType: 'content',
      entityId: contentId,
      sourceHash: hash1,
      adminId,
    });
    jobIds.push(first.jobId);
    expect(first.created).toBe(true);
    expect(first.taskCount).toBe(8);
    expect(duplicate).toMatchObject({ created: false, jobId: first.jobId, taskCount: 8 });
    const tasks = await db.select().from(translationJobTasks).where(eq(translationJobTasks.jobId, first.jobId));
    expect(tasks.map((task) => task.targetLanguageCode).sort()).toEqual([...CUSTOMER_TRANSLATION_LOCALES].sort());
  });

  it('marks the old translation outdated, publishes validated fake output, and preserves tokens', async () => {
    const [oldTranslation] = await db.insert(contentTranslations).values({
      entityType: 'content',
      entityId: contentId,
      targetLanguageCode: 'en',
      sourceLanguageCode: 'tr',
      status: 'PUBLISHED',
      title: 'Old published title',
      body: 'Old body with {{booking_id}} and €100',
      slug: 'old-published-slug',
      isAiGenerated: true,
      publishedAt: new Date(),
    } as never).returning();

    const next = await enqueueCustomerContentTranslations({
      entityType: 'content',
      entityId: contentId,
      sourceHash: hash2,
      adminId,
    });
    jobIds.push(next.jobId);
    const [outdated] = await db.select().from(contentTranslations).where(eq(contentTranslations.id, oldTranslation.id));
    expect(outdated.status).toBe('OUTDATED');
    expect(outdated.title).toBe('Old published title');
    expect(outdated.body).toContain('{{booking_id}}');
    expect(outdated.slug).toBe('old-published-slug');

    installCustomerTranslationTestProvider(async ({ targetLanguageCode }) => ({
      ok: true,
      fields: {
        title: `Translated ${targetLanguageCode}`,
        body: `Translated body {{booking_id}} €100 [internal](/tr/istanbul)`,
        slug: `translated-${targetLanguageCode}`,
      },
    }));
    const [task] = await db.select().from(translationJobTasks).where(eq(translationJobTasks.jobId, next.jobId));
    const result = await runTranslationTask({
      jobId: next.jobId,
      taskId: task.id,
      entityType: 'content',
      entityId: contentId,
      targetLang: 'en',
      force: false,
      adminId,
      attempt: 1,
    });
    expect(result.status).toBe('completed');
    const [translated] = await db.select().from(contentTranslations).where(eq(contentTranslations.id, oldTranslation.id));
    expect(translated.status).toBe('PUBLISHED');
    expect(translated.title).toBe('Translated en');
    expect(translated.body).toContain('{{booking_id}}');
    expect(translated.body).toContain('€100');
    expect(translated.slug).toBe('old-published-slug');
  });

  it('keeps the previous customer-facing payload when the replacement provider fails', async () => {
    const [oldTranslation] = await db.select().from(contentTranslations).where(eq(contentTranslations.entityId, contentId));
    const before = { title: oldTranslation.title, body: oldTranslation.body, slug: oldTranslation.slug };
    const next = await enqueueCustomerContentTranslations({
      entityType: 'content',
      entityId: contentId,
      sourceHash: computeCustomerContentSourceHash({ ...source, title: `${source.title} failure` }),
      adminId,
    });
    jobIds.push(next.jobId);
    installCustomerTranslationTestProvider(async () => ({ ok: false, error: 'fake provider failure' }));
    const task = (await db.select().from(translationJobTasks).where(eq(translationJobTasks.jobId, next.jobId)))[0];
    const result = await runTranslationTask({
      jobId: next.jobId,
      taskId: task.id,
      entityType: 'content',
      entityId: contentId,
      targetLang: 'en',
      force: false,
      adminId,
      attempt: 1,
    });
    expect(result.status).toBe('failed');
    const [after] = await db.select().from(contentTranslations).where(eq(contentTranslations.id, oldTranslation.id));
    expect(after.status).toBe('OUTDATED');
    expect({ title: after.title, body: after.body, slug: after.slug }).toEqual(before);
  });
});