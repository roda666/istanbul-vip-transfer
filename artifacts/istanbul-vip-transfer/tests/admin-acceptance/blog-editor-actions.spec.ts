import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { content, contentTranslations, translationJobs, translationJobTasks } from '../../db/schema';
import {
  assertNoHorizontalOverflow,
  assertTouchTargets,
  expect,
  test,
  waitForSettledAdminPage,
} from './fixtures';

test.describe('Blog editor action safety', () => {
  test('guards dirty navigation, avoids archived duplicates and safely deletes a temporary post', async ({
    adminIdentity,
    adminPage,
  }) => {
    const blogId = crypto.randomUUID();
    const title = `Playwright Blog ${blogId}`;
    await db.insert(content).values({
      id: blogId,
      title,
      slug: `playwright-blog-${blogId}`,
      excerpt: 'Geçici kabul testi yazısı',
      body: 'Geçici kabul testi gövdesi',
      contentType: 'BLOG_POST',
      status: 'DRAFT',
      createdBy: adminIdentity.id,
      updatedBy: adminIdentity.id,
    } as never);

    try {
      await adminPage.setViewportSize({ width: 390, height: 844 });
      const consoleErrors: string[] = [];
      adminPage.on('console', message => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      await adminPage.goto(`/admin/blog/${blogId}`);
      await waitForSettledAdminPage(adminPage);
      await expect(adminPage.getByRole('button', { name: '8 Dile Çevir ve Yayınla' })).toBeVisible();
      await expect(adminPage.getByRole('button', { name: 'İptal', exact: true })).toBeVisible();
      await expect(adminPage.getByRole('button', { name: 'Sil', exact: true })).toBeVisible();
      await assertNoHorizontalOverflow(adminPage);
      await assertTouchTargets(adminPage, 44, 'button[data-admin-action]');

      const titleInput = adminPage.locator('main input[type="text"]').first();
      await titleInput.fill(`${title} düzenlendi`);
      adminPage.once('dialog', async dialog => {
        expect(dialog.message()).toContain('Kaydedilmemiş değişiklikler');
        await dialog.dismiss();
      });
      await adminPage.getByRole('button', { name: 'İptal', exact: true }).click();
      await expect(adminPage).toHaveURL(new RegExp(`/admin/blog/${blogId}$`));

      await db.update(content).set({ status: 'ARCHIVED' }).where(eq(content.id, blogId));
      await adminPage.reload();
      await waitForSettledAdminPage(adminPage);
      await expect(adminPage.getByRole('button', { name: 'Taslağa Döndür', exact: true })).toHaveCount(1);
      expect(consoleErrors.filter(message => message.includes('same key'))).toEqual([]);

      await adminPage.getByRole('button', { name: 'Taslağa Döndür', exact: true }).click();
      await expect(adminPage.getByText('Taslak', { exact: true }).first()).toBeVisible();

      const confirmations: string[] = [];
      adminPage.on('dialog', async dialog => {
        confirmations.push(dialog.message());
        await dialog.accept();
      });
      await adminPage.getByRole('button', { name: 'Sil', exact: true }).click();
      await expect(adminPage).toHaveURL(/\/admin\/blog$/);
      expect(confirmations).toHaveLength(2);
      expect(confirmations[1]).toContain(title);
      const [deleted] = await db.select({ id: content.id }).from(content).where(eq(content.id, blogId));
      expect(deleted).toBeUndefined();
    } finally {
      const jobs = await db.select({ id: translationJobs.id }).from(translationJobs)
        .where(eq(translationJobs.entityId, blogId));
      for (const job of jobs) {
        await db.delete(translationJobTasks).where(eq(translationJobTasks.jobId, job.id));
      }
      await db.delete(translationJobs).where(eq(translationJobs.entityId, blogId));
      await db.delete(contentTranslations).where(eq(contentTranslations.entityId, blogId));
      await db.delete(content).where(eq(content.id, blogId));
    }
  });
});