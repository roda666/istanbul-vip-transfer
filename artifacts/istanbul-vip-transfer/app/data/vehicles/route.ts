/**
 * GET /data/vehicles?lang=tr
 * Public API — returns PUBLISHED vehicles with i18n name/shortDesc/tagline.
 */
export const dynamic = 'force-dynamic';

import { isLocaleCodeSyntax } from '@/lib/i18n/locale-registry';
import { resolvePublishedVehicles } from '@/lib/vehicle-localization';

export async function GET(request: Request) {
  const { NextResponse } = await import('next/server');
  const url = new URL(request.url);
  const requestedLang = url.searchParams.get('lang') ?? 'tr';
  const lang = requestedLang === 'tr' || isLocaleCodeSyntax(requestedLang) ? requestedLang : 'en';

  try {
    const { db } = await import('@/db');
    const { vehicles } = await import('@/db/schema');
     const { and, eq, asc } = await import('drizzle-orm');

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
       .where(and(eq(vehicles.status, 'PUBLISHED'), eq(vehicles.isActive, true)))
      .orderBy(asc(vehicles.displayOrder));

    const resolved = resolvePublishedVehicles(rows, lang);

    return NextResponse.json(
      { vehicles: resolved },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
    );
  } catch (err) {
    console.error('Vehicles GET error:', err);
    return NextResponse.json(
      // An empty catalog is a valid 200 response; a query failure is not. The
      // client needs this distinction to expose its retry control instead of
      // presenting an apparently valid blank fleet.
      { error: 'Vehicle fleet is temporarily unavailable.' },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
