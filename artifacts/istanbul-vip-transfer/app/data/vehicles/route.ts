/**
 * GET /data/vehicles?lang=tr
 * Public API — returns PUBLISHED vehicles with i18n name/shortDesc/tagline.
 */
export const dynamic = 'force-dynamic';

const PUBLIC_LOCALES = new Set(['tr', 'en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl']);
const LOCALIZED_FEATURE_CODES = new Set(['WIFI', 'CLIMATE', 'MEET_GREET', 'LEATHER', 'LUXURY', 'WATER']);

export async function GET(request: Request) {
  const { NextResponse } = await import('next/server');
  const url = new URL(request.url);
  const requestedLang = url.searchParams.get('lang') ?? 'tr';
  const lang = PUBLIC_LOCALES.has(requestedLang) ? requestedLang : 'en';

  try {
    const { db } = await import('@/db');
    const { vehicles } = await import('@/db/schema');
    const { eq, asc } = await import('drizzle-orm');

    const rows = await db
      .select({
        id: vehicles.id,
        name: vehicles.name,
        slug: vehicles.slug,
        shortDescription: vehicles.shortDescription,
        passengerCapacity: vehicles.passengerCapacity,
        luggageCapacity: vehicles.luggageCapacity,
        vehicleType: vehicles.vehicleType,
        features: vehicles.features,
        coverImage: vehicles.coverImage,
        coverImageAlt: vehicles.coverImageAlt,
        isFeatured: vehicles.isFeatured,
        displayOrder: vehicles.displayOrder,
        nameTranslations: vehicles.nameTranslations,
        shortDescTranslations: vehicles.shortDescTranslations,
        taglineTranslations: vehicles.taglineTranslations,
      })
      .from(vehicles)
      .where(eq(vehicles.status, 'PUBLISHED'))
      .orderBy(asc(vehicles.displayOrder));

    // A non-Turkish public request must never expose Turkish source fields as
    // fallback content. Hide incomplete vehicle cards until the requested
    // translation is available instead.
    const resolved = rows.flatMap((v) => {
      const displayName = lang === 'tr'
        ? (v.nameTranslations?.tr ?? v.name)
        : v.nameTranslations?.[lang];
      const displayShortDesc = lang === 'tr'
        ? (v.shortDescTranslations?.tr ?? v.shortDescription ?? '')
        : v.shortDescTranslations?.[lang];
      const displayTagline = lang === 'tr'
        ? (v.taglineTranslations?.tr ?? '')
        : v.taglineTranslations?.[lang];

      if (!displayName || !displayShortDesc || !displayTagline) return [];

      return [{
        id: v.id,
        slug: v.slug,
        passengerCapacity: v.passengerCapacity,
        luggageCapacity: v.luggageCapacity,
        vehicleType: v.vehicleType,
        features: (v.features ?? []).filter((feature) => (
          lang === 'tr' || LOCALIZED_FEATURE_CODES.has(feature)
        )),
        coverImage: v.coverImage,
        // Image alt text has no locale-specific database column. Reuse the
        // verified display name rather than exposing a Turkish source alt.
        coverImageAlt: displayName,
        isFeatured: v.isFeatured,
        displayOrder: v.displayOrder,
        displayName,
        displayShortDesc,
        displayTagline,
      }];
    });

    return NextResponse.json({ vehicles: resolved });
  } catch (err) {
    console.error('Vehicles GET error:', err);
    return NextResponse.json({ vehicles: [] });
  }
}
