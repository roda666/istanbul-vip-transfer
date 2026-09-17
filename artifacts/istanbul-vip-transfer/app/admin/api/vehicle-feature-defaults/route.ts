import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PUBLIC_VEHICLE_LOCALES, VEHICLE_FEATURE_CODES, type PublicVehicleLocale } from '@/lib/vehicle-feature-catalog';

const translationsSchema = z.object({
  tr: z.string().trim().min(1),
  en: z.string().trim().default(''),
  de: z.string().trim().default(''),
  ru: z.string().trim().default(''),
  ar: z.string().trim().default(''),
  fr: z.string().trim().default(''),
  es: z.string().trim().default(''),
  it: z.string().trim().default(''),
  nl: z.string().trim().default(''),
});

const settingsSchema = z.object({
  codes: z.array(z.enum(VEHICLE_FEATURE_CODES as [string, ...string[]])).max(VEHICLE_FEATURE_CODES.length),
  customFeatures: z.array(z.object({
    code: z.string().regex(/^CUSTOM_[A-Za-z0-9_-]+$/),
    translations: translationsSchema,
  })).max(50).default([]),
});

type CustomFeature = z.infer<typeof settingsSchema>['customFeatures'][number];

function jsonError(message: string, code: string, status: number) {
  return NextResponse.json({ ok: false, error: message, code }, { status });
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

/** GET /admin/api/vehicle-feature-defaults */
export async function GET() {
  try {
    await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { db } = await import('@/db');
  const { vehicleFeatureDefaults } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');
  const { DEFAULT_VEHICLE_FEATURE_CODES } = await import('@/lib/vehicle-feature-catalog');

  const rows = await db
    .select()
    .from(vehicleFeatureDefaults)
    .where(eq(vehicleFeatureDefaults.id, 1))
    .limit(1)
    .catch(() => []);

  return NextResponse.json({
    codes: rows[0]?.codes ?? DEFAULT_VEHICLE_FEATURE_CODES,
    customFeatures: rows[0]?.customFeatures ?? [],
    isSeeded: rows.length > 0,
  });
}

/** PUT /admin/api/vehicle-feature-defaults */
export async function PUT(request: NextRequest) {
  let session;
  try {
    session = await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return jsonError('Gönderilen bilgiler okunamadı. Lütfen sayfayı yenileyip tekrar deneyin.', 'INVALID_JSON', 400);
  }
  const parsed = settingsSchema.safeParse(requestBody);
  if (!parsed.success) {
    return jsonError('Özel özellik bilgileri geçersiz. Türkçe alanın dolu olduğundan emin olun.', 'VALIDATION_ERROR', 422);
  }

  const { db } = await import('@/db');
  const { vehicleFeatureDefaults } = await import('@/db/schema');
  const { invalidateVehicleFeatureDefaults } = await import('@/lib/vehicle-feature-defaults-server');
  const { translateServicePageFields } = await import('@/lib/ai/translate-service-page');
  const now = new Date();
  let customFeatures: CustomFeature[];
  try {
    customFeatures = await Promise.all(parsed.data.customFeatures.map(async (feature) => {
      const translations = { ...feature.translations } as Record<PublicVehicleLocale, string>;
      const missingLocales = PUBLIC_VEHICLE_LOCALES.filter(
        (locale): locale is Exclude<PublicVehicleLocale, 'tr'> =>
          locale !== 'tr' && !translations[locale]?.trim(),
      );

      const generated = await mapWithConcurrency(missingLocales, 2, async (locale) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45_000);
        try {
          const result = await translateServicePageFields(
            { label: translations.tr.trim() },
            locale,
            controller.signal,
          );
          if (!result.ok || !result.translated.label?.trim()) {
            throw new Error(`${locale.toUpperCase()}:${result.ok ? 'empty' : result.reason}`);
          }
          return [locale, result.translated.label.trim()] as const;
        } finally {
          clearTimeout(timeout);
        }
      });

      for (const [locale, value] of generated) translations[locale] = value;
      return { code: feature.code, translations };
    }));
  } catch (error: unknown) {
    console.error('[vehicle-feature-defaults] AI translation failed:', error);
    return jsonError(
      'Çeviri sırasında hata oluştu, lütfen tekrar deneyin.',
      'TRANSLATION_FAILED',
      502,
    );
  }

  try {
    const [row] = await db
      .insert(vehicleFeatureDefaults)
      .values({ id: 1, codes: parsed.data.codes, customFeatures, updatedAt: now, updatedBy: session.adminId })
      .onConflictDoUpdate({
        target: vehicleFeatureDefaults.id,
        set: { codes: parsed.data.codes, customFeatures, updatedAt: now, updatedBy: session.adminId },
      })
      .returning();

    invalidateVehicleFeatureDefaults();

    return NextResponse.json({ ok: true, codes: row.codes, customFeatures: row.customFeatures });
  } catch (error) {
    console.error('[vehicle-feature-defaults] Persistence failed:', error);
    return jsonError('Özel özellikler kaydedilemedi. Lütfen tekrar deneyin.', 'SAVE_FAILED', 500);
  }
}
