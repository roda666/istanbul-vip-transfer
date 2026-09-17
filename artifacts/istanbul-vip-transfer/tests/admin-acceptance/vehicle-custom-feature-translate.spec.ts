import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { test, expect, assertNoHorizontalOverflow } from './fixtures';
import { db } from '../../db';
import { vehicleFeatureDefaults } from '../../db/schema';
import { PUBLIC_VEHICLE_LOCALES } from '../../lib/vehicle-feature-catalog';

const evidenceDir = path.resolve(process.cwd(), 'reports/vehicle-feature-translation');

test('custom vehicle feature replaces stale locale values from Turkish with real OpenAI', async ({
  adminPage: page,
  adminContext,
  baseURL,
}) => {
  test.setTimeout(600_000);
  const origin = baseURL!;
  const endpoint = new URL('/admin/api/vehicle-feature-defaults', origin).toString();
  const [snapshot] = await db.select().from(vehicleFeatureDefaults)
    .where(eq(vehicleFeatureDefaults.id, 1)).limit(1);
  const originalCodes = snapshot?.codes ?? [];
  const originalCustomFeatures = snapshot?.customFeatures ?? [];
  const existingFeature = originalCustomFeatures.find(
    (feature) => feature.translations.tr.trim().toLocaleLowerCase('tr-TR') === 'denemedir',
  );
  expect(existingFeature, 'Owner-reported "denemedir" custom feature must exist').toBeTruthy();
  const label = existingFeature!.translations.tr;

  await mkdir(evidenceDir, { recursive: true });
  try {
    const submittedStaleValues = Object.fromEntries(
      PUBLIC_VEHICLE_LOCALES
        .filter((locale) => locale !== 'tr')
        .map((locale) => [locale, `BU_ESKI_CEVIRI_KORUNMAMALI_${locale.toUpperCase()}`]),
    );
    const requestCustomFeatures = originalCustomFeatures.map((feature) => feature.code === existingFeature!.code
      ? { ...feature, translations: { ...feature.translations, ...submittedStaleValues } }
      : feature);
    const saveResponse = await page.request.put(endpoint, {
      data: { codes: originalCodes, customFeatures: requestCustomFeatures },
      headers: { Origin: origin },
      timeout: 300_000,
    });
    const savedBody = await saveResponse.json() as {
      ok?: boolean;
      error?: string;
      customFeatures?: Array<{ code: string; translations: Record<string, string> }>;
    };
    expect(saveResponse.status(), savedBody.error).toBe(200);
    expect(savedBody.ok).toBe(true);
    const created = savedBody.customFeatures?.find((feature) => feature.code === existingFeature!.code);
    expect(created).toBeTruthy();
    for (const locale of PUBLIC_VEHICLE_LOCALES) {
      expect(created?.translations[locale]?.trim(), `${locale.toUpperCase()} translation`).toBeTruthy();
      if (locale !== 'tr') {
        expect(created?.translations[locale]).not.toBe(submittedStaleValues[locale]);
      }
    }

    const [persisted] = await db.select().from(vehicleFeatureDefaults)
      .where(eq(vehicleFeatureDefaults.id, 1)).limit(1);
    const persistedFeature = persisted?.customFeatures.find((feature) => feature.code === created?.code);
    for (const locale of PUBLIC_VEHICLE_LOCALES) {
      expect(persistedFeature?.translations[locale]?.trim(), `${locale.toUpperCase()} persisted translation`).toBeTruthy();
    }

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/admin/araclar', { waitUntil: 'domcontentloaded' });
    await page.locator('button:has-text("Varsayılan Özellikler")').click();
    const featureCard = page.getByText(existingFeature!.code, { exact: true }).locator('..').locator('..');
    await expect(featureCard).toBeVisible({ timeout: 30_000 });
    for (const viewport of [
      { name: 'desktop-1440', width: 1440, height: 1000 },
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
  } finally {
    if (snapshot) {
      await db.update(vehicleFeatureDefaults).set({
        codes: snapshot.codes,
        customFeatures: snapshot.customFeatures,
        updatedAt: snapshot.updatedAt,
        updatedBy: snapshot.updatedBy,
      }).where(eq(vehicleFeatureDefaults.id, 1));
    } else {
      await db.delete(vehicleFeatureDefaults).where(eq(vehicleFeatureDefaults.id, 1));
    }
  }
});