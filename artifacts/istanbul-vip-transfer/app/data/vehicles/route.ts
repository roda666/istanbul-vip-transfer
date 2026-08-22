/**
 * GET /data/vehicles?lang=tr
 * Public API — returns PUBLISHED vehicles with i18n name/shortDesc/tagline.
 */
export const dynamic = 'force-dynamic';

import { isLocaleCodeSyntax } from '@/lib/i18n/locale-registry';
import { resolvePublicVehicle } from '@/lib/vehicle-localization';

export async function GET(request: Request) {
  const { NextResponse } = await import('next/server');
  const url = new URL(request.url);
  const requestedLang = url.searchParams.get('lang') ?? 'tr';
  const lang = requestedLang === 'tr' || isLocaleCodeSyntax(requestedLang) ? requestedLang : 'en';

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

    const resolved = rows.flatMap((vehicle) => {
      const localized = resolvePublicVehicle(vehicle, lang);
      return localized ? [localized] : [];
    });

    return NextResponse.json(
      { vehicles: resolved },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
    );
  } catch (err) {
    console.error('Vehicles GET error:', err);
    return NextResponse.json(
      { vehicles: [] },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
    );
  }
}
