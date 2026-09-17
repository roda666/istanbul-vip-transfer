import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { test, expect, assertNoHorizontalOverflow } from './fixtures';
import { db } from '../../db';
import { vehicleFeatureDefaults } from '../../db/schema';
import { PUBLIC_VEHICLE_LOCALES } from '../../lib/vehicle-feature-catalog';

const evidenceDir = path.resolve(process.cwd(), 'reports/vehicle-feature-translation');

test('custom vehicle feature handles malformed errors and translates every blank locale with real OpenAI', async ({
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
  const label = `Eğlence Paketi ${Date.now().toString(36)}`;

  await mkdir(evidenceDir, { recursive: true });
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/admin/araclar', { waitUntil: 'domcontentloaded' });
    await page.locator('button:has-text("Varsayılan Özellikler")').click();
    await page.getByRole('button', { name: 'Özel Özellik Ekle' }).click();
    await page.getByPlaceholder('örn. Bebek koltuğu').last().fill(label);

    // A broken/empty upstream response must never leak Response.json syntax
    // details into the admin UI.
    await page.route('**/admin/api/vehicle-feature-defaults', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({ status: 502, body: '', contentType: 'application/json' });
      } else {
        await route.continue();
      }
    });
    await page.getByRole('button', { name: 'Kaydet ve Çevir' }).click();
    await expect(page.getByText('İşlem tamamlanamadı. Lütfen tekrar deneyin.')).toBeVisible();
    await expect(page.getByText(/Unexpected end of JSON input/i)).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: path.join(evidenceDir, 'error-mobile-390.png'), fullPage: true });
    await page.unroute('**/admin/api/vehicle-feature-defaults');

    await page.setViewportSize({ width: 1440, height: 1000 });
    const saveResponsePromise = page.waitForResponse(
      (response) => response.url() === endpoint && response.request().method() === 'PUT',
      { timeout: 300_000 },
    );
    await page.getByRole('button', { name: 'Kaydet ve Çevir' }).click();
    const saveResponse = await saveResponsePromise;
    const savedBody = await saveResponse.json() as {
      ok?: boolean;
      error?: string;
      customFeatures?: Array<{ code: string; translations: Record<string, string> }>;
    };
    expect(saveResponse.status(), savedBody.error).toBe(200);
    expect(savedBody.ok).toBe(true);
    const created = savedBody.customFeatures?.find((feature) => feature.translations.tr === label);
    expect(created).toBeTruthy();
    for (const locale of PUBLIC_VEHICLE_LOCALES) {
      expect(created?.translations[locale]?.trim(), `${locale.toUpperCase()} translation`).toBeTruthy();
    }
    await expect(page.getByText('Kaydedildi')).toBeVisible();

    const [persisted] = await db.select().from(vehicleFeatureDefaults)
      .where(eq(vehicleFeatureDefaults.id, 1)).limit(1);
    const persistedFeature = persisted?.customFeatures.find((feature) => feature.code === created?.code);
    for (const locale of PUBLIC_VEHICLE_LOCALES) {
      expect(persistedFeature?.translations[locale]?.trim(), `${locale.toUpperCase()} persisted translation`).toBeTruthy();
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('button:has-text("Varsayılan Özellikler")').click();
    expect(await page.locator('input').evaluateAll(
      (inputs, expected) => inputs.some((input) => input instanceof HTMLInputElement && input.value === expected),
      label,
    )).toBe(true);
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