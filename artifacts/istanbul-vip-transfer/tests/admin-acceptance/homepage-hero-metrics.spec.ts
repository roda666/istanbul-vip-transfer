import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { and, eq, inArray, notInArray } from 'drizzle-orm';
import { test, expect, assertNoHorizontalOverflow } from './fixtures';
import { db } from '../../db';
import {
  content,
  contentTranslations,
  translationJobs,
  translationJobTasks,
} from '../../db/schema';
import { parseHomepageSections } from '../../lib/homepage-types';

const locales = ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'];
const exactValues = ['12.000+', '4.9 ★', '%99.7', '1.500+'];
const evidenceDir = path.resolve(process.cwd(), 'reports/homepage-hero-metrics');

test('admin updates the four hero metrics, publishes eight translations, and renders responsively', async ({
  adminPage: page,
}) => {
  test.setTimeout(600_000);
  const [sourceSnapshot] = await db.select().from(content)
    .where(eq(content.slug, 'ana-sayfa')).limit(1);
  expect(sourceSnapshot).toBeTruthy();
  const translationSnapshots = await db.select().from(contentTranslations).where(and(
    eq(contentTranslations.entityType, 'homepage'),
    eq(contentTranslations.entityId, sourceSnapshot!.id),
    inArray(contentTranslations.targetLanguageCode, locales),
  ));
  const existingJobIds = (await db.select({ id: translationJobs.id }).from(translationJobs)
    .where(and(eq(translationJobs.entityType, 'homepage'), eq(translationJobs.entityId, sourceSnapshot!.id))))
    .map(row => row.id);
  let completed = false;

  await mkdir(evidenceDir, { recursive: true });
  try {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto('/admin/sayfalar/ana-sayfa', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'B · Metrikler', exact: true }).click();
    const transfersCard = page.getByText('TRANSFERS', { exact: true }).locator('..');
    const valueInput = transfersCard.locator('input').first();
    await expect(valueInput).toHaveValue('12.000+');
    await valueInput.fill('12.000 +');

    const saveResponse = page.waitForResponse(response =>
      response.url().includes('/admin/api/homepage/tr') && response.request().method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Kaydet ve Tüm Dillerde Yayımla', exact: true }).click();
    expect((await saveResponse).status()).toBe(200);
    await expect(page.getByText('Türkçe ve tüm diller yayımlandı.')).toBeVisible({ timeout: 480_000 });

    const translatedRows = await db.select().from(contentTranslations).where(and(
      eq(contentTranslations.entityType, 'homepage'),
      eq(contentTranslations.entityId, sourceSnapshot!.id),
      inArray(contentTranslations.targetLanguageCode, locales),
    ));
    expect(translatedRows).toHaveLength(8);
    for (const row of translatedRows) {
      expect(row.status, row.targetLanguageCode).toBe('PUBLISHED');
      const sections = parseHomepageSections(row.body, row.targetLanguageCode);
      expect(sections?.heroMetrics.map(metric => metric.valueText)).toEqual([
        '12.000 +', '4.9 ★', '%99.7', '1.500+',
      ]);
      expect(sections?.heroMetrics.every(metric => metric.label.trim().length > 0)).toBe(true);
    }

    const [currentSource] = await db.select({ body: content.body }).from(content)
      .where(eq(content.id, sourceSnapshot!.id)).limit(1);
    const sourceSections = parseHomepageSections(currentSource?.body, 'tr');
    expect(sourceSections).toBeTruthy();
    sourceSections!.heroMetrics[0].valueText = '12.000+';
    await db.update(content).set({ body: JSON.stringify(sourceSections) })
      .where(eq(content.id, sourceSnapshot!.id));
    for (const row of translatedRows) {
      const sections = parseHomepageSections(row.body, row.targetLanguageCode);
      expect(sections).toBeTruthy();
      sections!.heroMetrics[0].valueText = '12.000+';
      await db.update(contentTranslations).set({ body: JSON.stringify(sections) })
        .where(eq(contentTranslations.id, row.id));
    }

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('hero-metrics-strip')).toBeVisible();
    await expect(page.getByTestId('hero-metric-0')).toContainText('12.000+');
    await expect(page.getByTestId('hero-metric-1')).toContainText('4.9 ★');
    for (const viewport of [
      { name: 'desktop-1440', width: 1440, height: 1100 },
      { name: 'tablet-768', width: 768, height: 1024 },
      { name: 'mobile-390', width: 390, height: 844 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await assertNoHorizontalOverflow(page);
      await page.screenshot({
        path: path.join(evidenceDir, `${viewport.name}.png`),
        fullPage: true,
      });
    }
    completed = true;
  } finally {
    if (!completed) {
      await db.update(content).set({
        body: sourceSnapshot!.body,
        status: sourceSnapshot!.status,
        publishedAt: sourceSnapshot!.publishedAt,
        updatedAt: sourceSnapshot!.updatedAt,
      }).where(eq(content.id, sourceSnapshot!.id));
      for (const snapshot of translationSnapshots) {
        await db.update(contentTranslations).set({
          body: snapshot.body,
          status: snapshot.status,
          sourceHash: snapshot.sourceHash,
          isAiGenerated: snapshot.isAiGenerated,
          aiModel: snapshot.aiModel,
          publishedAt: snapshot.publishedAt,
          updatedAt: snapshot.updatedAt,
          updatedBy: snapshot.updatedBy,
          failureReason: snapshot.failureReason,
          failedAt: snapshot.failedAt,
          queuedAt: snapshot.queuedAt,
        }).where(eq(contentTranslations.id, snapshot.id));
      }
    }
    const newJobs = existingJobIds.length > 0
      ? await db.select({ id: translationJobs.id }).from(translationJobs).where(and(
          eq(translationJobs.entityType, 'homepage'),
          eq(translationJobs.entityId, sourceSnapshot!.id),
          notInArray(translationJobs.id, existingJobIds),
        ))
      : await db.select({ id: translationJobs.id }).from(translationJobs).where(and(
          eq(translationJobs.entityType, 'homepage'),
          eq(translationJobs.entityId, sourceSnapshot!.id),
        ));
    const newJobIds = newJobs.map(row => row.id);
    if (newJobIds.length > 0) {
      await db.delete(translationJobTasks).where(inArray(translationJobTasks.jobId, newJobIds));
      await db.delete(translationJobs).where(inArray(translationJobs.id, newJobIds));
    }
  }
});