import type { Page } from '@playwright/test';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  adminSectionGrants,
  adminUsers,
  auditLogs,
  content,
  contentTranslations,
  translationJobs,
  translationJobTasks,
} from '../../db/schema';
import { hashPassword } from '../../lib/auth/password';
import {
  finalizeBlogAtomicPublish,
  runBlogAtomicTranslationTask,
} from '../../lib/blog-atomic-publish';
import {
  CUSTOMER_TRANSLATION_LOCALES,
  installCustomerTranslationTestProvider,
} from '../../lib/customer-content-translation';
import {
  assertNoHorizontalOverflow,
  expect,
  screenshotEvidence,
  test,
  waitForSettledAdminPage,
} from './fixtures';

type Baseline = { blogs: number; translations: number; jobs: number };
type FakeMode = { failingLocale: string | null };

async function getBaseline(): Promise<Baseline> {
  const [blogs] = await db.select({ count: sql<number>`count(*)::int` }).from(content)
    .where(eq(content.contentType, 'BLOG_POST'));
  const [translations] = await db.select({ count: sql<number>`count(*)::int` })
    .from(contentTranslations).innerJoin(content, eq(content.id, sql`${contentTranslations.entityId}::uuid`))
    .where(and(eq(content.contentType, 'BLOG_POST'), eq(contentTranslations.entityType, 'content')));
  const [jobs] = await db.select({ count: sql<number>`count(*)::int` })
    .from(translationJobs).innerJoin(content, eq(content.id, translationJobs.entityId))
    .where(eq(content.contentType, 'BLOG_POST'));
  return { blogs: blogs.count, translations: translations.count, jobs: jobs.count };
}

function fakeFields(locale: string) {
  return {
    title: `Acceptance ${locale}`,
    slug: `acceptance-${locale}`,
    excerpt: `Acceptance excerpt ${locale}`,
    body: `Acceptance body ${locale} [internal](/internal-link)`,
    metaTitle: `Acceptance meta ${locale}`,
    metaDescription: `Acceptance description ${locale}`,
    focusKeyword: `keyword-${locale}`,
    supportingKeywords: JSON.stringify([`support-${locale}`]),
    imageAlt: '',
    imageTitle: '',
    imageCaption: '',
  };
}

async function syncFakeJob(jobId: string) {
  const tasks = await db.select().from(translationJobTasks).where(eq(translationJobTasks.jobId, jobId));
  const completed = tasks.filter(task => task.status === 'COMPLETED').length;
  const failed = tasks.filter(task => task.status === 'FAILED').length;
  const pending = tasks.filter(task => ['QUEUED', 'RUNNING', 'RETRYING'].includes(task.status)).length;
  const status = pending > 0 ? 'RUNNING' : failed === 0 ? 'COMPLETED' : completed === 0 ? 'FAILED' : 'PARTIAL';
  await db.update(translationJobs).set({
    status,
    completedTasks: completed,
    failedTasks: failed,
    completedAt: pending === 0 ? new Date() : null,
    updatedAt: new Date(),
  }).where(eq(translationJobs.id, jobId));
}

async function installFakeTaskRunner(page: Page, mode: FakeMode, calls: Map<string, number>) {
  let queue = Promise.resolve();
  await page.route(/\/admin\/api\/translations\/jobs\/[^/]+\/tasks\/[^/]+\/run$/, async route => {
    const response = queue.then(async () => {
      const match = new URL(route.request().url()).pathname.match(/\/jobs\/([^/]+)\/tasks\/([^/]+)\/run$/);
      if (!match) return { status: 404, body: { status: 'failed', error: 'Test task path invalid.' } };
      const [, jobId, taskId] = match;
      const [job] = await db.select().from(translationJobs).where(eq(translationJobs.id, jobId)).limit(1);
      const [task] = await db.select().from(translationJobTasks).where(and(
        eq(translationJobTasks.id, taskId),
        eq(translationJobTasks.jobId, jobId),
      )).limit(1);
      if (!job || !task) return { status: 404, body: { status: 'failed', error: 'Test task missing.' } };
      if (task.status === 'COMPLETED') return { status: 200, body: { status: 'completed', taskId, skipped: true } };

      const attempt = task.attempts + 1;
      calls.set(task.targetLanguageCode, (calls.get(task.targetLanguageCode) ?? 0) + 1);
      await db.update(translationJobTasks).set({
        status: 'RUNNING',
        attempts: attempt,
        startedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(translationJobTasks.id, taskId));
      const result = await runBlogAtomicTranslationTask({
        jobId,
        taskId,
        entityId: job.entityId,
        targetLang: task.targetLanguageCode,
        sourceHash: job.sourceHash,
        force: job.force,
        adminId: job.createdBy!,
        attempt,
      });
      const nextStatus = result.status === 'completed'
        ? 'COMPLETED'
        : attempt < 2 ? 'RETRYING' : 'FAILED';
      await db.update(translationJobTasks).set({
        status: nextStatus,
        completedAt: nextStatus === 'COMPLETED' ? new Date() : null,
        errorMessage: result.error ?? null,
        updatedAt: new Date(),
      }).where(eq(translationJobTasks.id, taskId));
      await syncFakeJob(jobId);
      if (nextStatus === 'COMPLETED') await finalizeBlogAtomicPublish(jobId, job.createdBy!);
      return {
        status: 200,
        body: { status: result.status, taskId, error: result.error },
      };
    });
    queue = response.then(() => undefined, () => undefined);
    const result = await response;
    await route.fulfill({
      status: result.status,
      contentType: 'application/json',
      body: JSON.stringify(result.body),
    });
  });

  installCustomerTranslationTestProvider(async ({ targetLanguageCode }) =>
    mode.failingLocale === targetLanguageCode
      ? { ok: false, error: `controlled ${targetLanguageCode} failure` }
      : { ok: true, fields: fakeFields(targetLanguageCode) });
}

test.describe.serial('Blog editor missing acceptance evidence', () => {
  test.setTimeout(180_000);

  test('covers tablet/desktop, cancel, safe delete and fake-provider atomic publication', async ({
    adminIdentity,
    adminPage,
    baseURL,
    browser,
  }) => {
    const baseline = await getBaseline();
    const contentIds: string[] = [];
    const adminIds: string[] = [];

    const createBlog = async (status: string, suffix: string) => {
      const id = crypto.randomUUID();
      contentIds.push(id);
      await db.insert(content).values({
        id,
        title: `Acceptance Blog ${suffix} ${id}`,
        slug: `acceptance-blog-${suffix}-${id}`,
        excerpt: 'Acceptance test excerpt',
        body: 'Acceptance body [internal](/internal-link)',
        contentType: 'BLOG_POST',
        status,
        createdBy: adminIdentity.id,
        updatedBy: adminIdentity.id,
      } as never);
      return id;
    };

    try {
      // 768px tablet and 1440px desktop: actions are visible, named and do not overflow.
      for (const viewport of [{ width: 768, height: 1024, name: 'tablet' }, { width: 1440, height: 1000, name: 'desktop' }]) {
        const id = await createBlog('DRAFT', viewport.name);
        const consoleErrors: string[] = [];
        const listener = (message: { type(): string; text(): string }) => {
          if (message.type() === 'error') consoleErrors.push(message.text());
        };
        adminPage.on('console', listener);
        await adminPage.setViewportSize(viewport);
        await adminPage.goto(`/admin/blog/${id}`);
        await waitForSettledAdminPage(adminPage);
        for (const name of ['Kaydet', '8 Dile Çevir ve Yayınla', 'Arşivle', 'İptal', 'Sil']) {
          const button = adminPage.getByRole('button', { name, exact: true });
          await expect(button).toBeVisible();
          expect(await button.evaluate(element => {
            const rect = element.getBoundingClientRect();
            return rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0;
          })).toBe(true);
        }
        await assertNoHorizontalOverflow(adminPage);
        await screenshotEvidence(adminPage, `blog-editor-${viewport.name}`);
        await adminPage.getByRole('button', { name: 'Arşivle', exact: true }).click();
        await expect(adminPage.getByRole('button', { name: 'Taslağa Döndür', exact: true })).toHaveCount(1);
        await adminPage.getByRole('button', { name: 'Taslağa Döndür', exact: true }).click();
        await expect(adminPage.getByRole('button', { name: 'Arşivle', exact: true })).toBeVisible();
        expect(consoleErrors.filter(message => /same key|toDraft|react/i.test(message))).toEqual([]);
        adminPage.off('console', listener);
      }

      // Cancel: clean returns immediately; dirty dismiss preserves draft; dirty accept discards it.
      const cancelId = await createBlog('DRAFT', 'cancel');
      await adminPage.goto(`/admin/blog/${cancelId}`);
      await adminPage.getByRole('button', { name: 'İptal', exact: true }).click();
      await expect(adminPage).toHaveURL(/\/admin\/blog$/);
      await adminPage.goto(`/admin/blog/${cancelId}`);
      const titleInput = adminPage.locator('main input[type="text"]').first();
      const dirtyTitle = `Unsaved ${crypto.randomUUID()}`;
      await titleInput.fill(dirtyTitle);
      adminPage.once('dialog', dialog => dialog.dismiss());
      await adminPage.getByRole('button', { name: 'İptal', exact: true }).click();
      await expect(adminPage).toHaveURL(new RegExp(`/admin/blog/${cancelId}$`));
      await expect(titleInput).toHaveValue(dirtyTitle);
      adminPage.once('dialog', dialog => dialog.accept());
      await adminPage.getByRole('button', { name: 'İptal', exact: true }).click();
      await expect(adminPage).toHaveURL(/\/admin\/blog$/);
      const [cancelRow] = await db.select({ title: content.title }).from(content).where(eq(content.id, cancelId));
      expect(cancelRow.title).not.toBe(dirtyTitle);

      // 403 for a temporary view-only content user.
      const restrictedId = crypto.randomUUID();
      const restrictedEmail = `blog-view-only-${restrictedId}@example.invalid`;
      const restrictedPassword = crypto.randomUUID();
      adminIds.push(restrictedId);
      await db.insert(adminUsers).values({
        id: restrictedId,
        email: restrictedEmail,
        passwordHash: await hashPassword(restrictedPassword),
        name: 'Blog View Only',
        role: 'ADMIN',
        active: true,
      });
      await db.insert(adminSectionGrants).values({
        adminUserId: restrictedId,
        section: 'content',
        canView: true,
        canManage: false,
      });
      const restrictedContext = await browser.newContext();
      const login = await restrictedContext.request.post(new URL('/admin/api/login', baseURL).toString(), {
        data: { email: restrictedEmail, password: restrictedPassword },
      });
      expect(login.status()).toBe(200);
      const restrictedBlogId = await createBlog('DRAFT', 'restricted');
      const forbidden = await restrictedContext.request.delete(
        new URL(`/admin/api/blog/${restrictedBlogId}`, baseURL).toString(),
      );
      expect(forbidden.status()).toBe(403);
      expect((await forbidden.json()).error).toBe('Forbidden');
      await restrictedContext.close();

      // Structured 409 for published and linked temporary posts.
      const publishedId = await createBlog('PUBLISHED', 'published');
      const publishedDelete = await adminPage.evaluate(async id => {
        const response = await fetch(`/admin/api/blog/${id}`, { method: 'DELETE' });
        return { status: response.status, body: await response.json() };
      }, publishedId);
      expect(publishedDelete.status).toBe(409);
      expect(publishedDelete.body).toMatchObject({
        dependencies: [{ type: 'publication', count: 1 }],
      });
      const linkedId = await createBlog('DRAFT', 'linked');
      const referrerId = await createBlog('DRAFT', 'referrer');
      const [linked] = await db.select({ slug: content.slug }).from(content).where(eq(content.id, linkedId));
      await db.update(content).set({
        internalLinks: [{ href: `/blog/${linked.slug}`, label: 'Temporary reference' }],
      } as never).where(eq(content.id, referrerId));
      const linkedDelete = await adminPage.evaluate(async id => {
        const response = await fetch(`/admin/api/blog/${id}`, { method: 'DELETE' });
        return { status: response.status, body: await response.json() };
      }, linkedId);
      expect(linkedDelete.status).toBe(409);
      const linkedError = linkedDelete.body;
      expect(linkedError.error).toContain('bağlantıları kaldırın');
      expect(linkedError.dependencies[0]).toMatchObject({ type: 'reference', count: 1 });

      // Safe delete: cancel second confirmation, then double-click with one DELETE.
      const deleteId = await createBlog('DRAFT', 'safe-delete');
      await adminPage.goto(`/admin/blog/${deleteId}`);
      let dialogIndex = 0;
      adminPage.on('dialog', async dialog => {
        dialogIndex += 1;
        if (dialogIndex === 1) await dialog.accept();
        else await dialog.dismiss();
      });
      await adminPage.getByRole('button', { name: 'Sil', exact: true }).click();
      expect((await db.select({ id: content.id }).from(content).where(eq(content.id, deleteId)))[0]).toBeDefined();
      adminPage.removeAllListeners('dialog');
      let deleteRequests = 0;
      adminPage.on('request', request => {
        if (request.method() === 'DELETE' && request.url().endsWith(`/admin/api/blog/${deleteId}`)) deleteRequests += 1;
      });
      adminPage.on('dialog', dialog => dialog.accept());
      await adminPage.getByRole('button', { name: 'Sil', exact: true }).dblclick();
      await expect(adminPage).toHaveURL(/\/admin\/blog$/);
      expect(deleteRequests).toBe(1);
      const deletedRows = await db.select({ id: content.id }).from(content).where(eq(content.id, deleteId));
      expect(deletedRows[0]).toBeUndefined();

      // Successful button flow: all eight staged payloads publish atomically.
      const successId = await createBlog('DRAFT', 'publish-success');
      const successMode: FakeMode = { failingLocale: null };
      const successCalls = new Map<string, number>();
      await installFakeTaskRunner(adminPage, successMode, successCalls);
      let publishRequests = 0;
      adminPage.on('request', request => {
        if (
          request.method() === 'POST' &&
          request.url().endsWith(`/admin/api/blog/${successId}`) &&
          request.postData()?.includes('publishAllLanguages')
        ) publishRequests += 1;
      });
      await adminPage.goto(`/admin/blog/${successId}`);
      await adminPage.getByRole('button', { name: '8 Dile Çevir ve Yayınla' }).dblclick();
      await expect(adminPage.getByText('Türkçe ve 8 dil birlikte yayımlandı.')).toBeVisible({ timeout: 60_000 });
      expect(publishRequests).toBe(1);
      const [publishedSource] = await db.select({ status: content.status }).from(content).where(eq(content.id, successId));
      expect(publishedSource.status).toBe('PUBLISHED');
      const publishedTranslations = await db.select().from(contentTranslations)
        .where(eq(contentTranslations.entityId, successId));
      expect(publishedTranslations).toHaveLength(8);
      expect(publishedTranslations.every(row => row.status === 'PUBLISHED')).toBe(true);
      expect([...successCalls.keys()].sort()).toEqual([...CUSTOMER_TRANSLATION_LOCALES].sort());
      await adminPage.unrouteAll({ behavior: 'wait' });
      installCustomerTranslationTestProvider(null);

      // One locale fails twice: no partial release; retry runs only that locale.
      const failureId = await createBlog('DRAFT', 'publish-failure');
      await db.insert(contentTranslations).values({
        entityType: 'content',
        entityId: failureId,
        targetLanguageCode: 'en',
        status: 'PUBLISHED',
        title: 'Safe old English',
        slug: 'safe-old-english',
        body: 'Safe old body',
        isAiGenerated: true,
        publishedAt: new Date(),
      } as never);
      const failureMode: FakeMode = { failingLocale: 'de' };
      const failureCalls = new Map<string, number>();
      await installFakeTaskRunner(adminPage, failureMode, failureCalls);
      await adminPage.goto(`/admin/blog/${failureId}`);
      await adminPage.getByRole('button', { name: '8 Dile Çevir ve Yayınla' }).click();
      await expect(adminPage.getByRole('button', { name: 'Başarısız Dilleri Yeniden Dene' }))
        .toBeVisible({ timeout: 60_000 });
      const [failedSource] = await db.select({ status: content.status }).from(content).where(eq(content.id, failureId));
      expect(failedSource.status).toBe('DRAFT');
      const beforeRetryTranslations = await db.select().from(contentTranslations)
        .where(eq(contentTranslations.entityId, failureId));
      expect(beforeRetryTranslations).toHaveLength(1);
      expect(beforeRetryTranslations[0]).toMatchObject({
        targetLanguageCode: 'en',
        status: 'PUBLISHED',
        title: 'Safe old English',
      });
      const callsBeforeRetry = new Map(failureCalls);
      failureMode.failingLocale = null;
      await adminPage.getByRole('button', { name: 'Başarısız Dilleri Yeniden Dene' }).click();
      await expect(adminPage.getByText('Türkçe ve 8 dil birlikte yayımlandı.')).toBeVisible({ timeout: 60_000 });
      for (const locale of CUSTOMER_TRANSLATION_LOCALES) {
        const delta = (failureCalls.get(locale) ?? 0) - (callsBeforeRetry.get(locale) ?? 0);
        expect(delta, `retry call delta for ${locale}`).toBe(locale === 'de' ? 1 : 0);
      }
      await adminPage.unrouteAll({ behavior: 'wait' });
      installCustomerTranslationTestProvider(null);
    } finally {
      if (process.env.NODE_ENV === 'test') installCustomerTranslationTestProvider(null);
      await adminPage.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
      if (contentIds.length) {
        const jobs = await db.select({ id: translationJobs.id }).from(translationJobs)
          .where(inArray(translationJobs.entityId, contentIds));
        if (jobs.length) {
          await db.delete(translationJobTasks).where(inArray(translationJobTasks.jobId, jobs.map(job => job.id)));
          await db.delete(translationJobs).where(inArray(translationJobs.id, jobs.map(job => job.id)));
        }
        await db.delete(contentTranslations).where(inArray(contentTranslations.entityId, contentIds));
        await db.delete(auditLogs).where(or(
          inArray(auditLogs.entityId, contentIds),
          eq(auditLogs.adminUserId, adminIdentity.id),
        )).catch(() => {});
        await db.delete(content).where(inArray(content.id, contentIds));
      }
      if (adminIds.length) {
        await db.delete(adminSectionGrants).where(inArray(adminSectionGrants.adminUserId, adminIds));
        await db.delete(auditLogs).where(inArray(auditLogs.adminUserId, adminIds)).catch(() => {});
        await db.delete(adminUsers).where(inArray(adminUsers.id, adminIds));
      }
      expect(await getBaseline()).toEqual(baseline);
    }
  });
});