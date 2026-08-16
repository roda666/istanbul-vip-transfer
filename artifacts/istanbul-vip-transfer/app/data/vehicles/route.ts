/**
 * GET /data/vehicles?lang=tr
 * Public API — returns PUBLISHED vehicles with i18n name/shortDesc/tagline.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { NextResponse } = await import('next/server');
  const url = new URL(request.url);
  const lang = url.searchParams.get('lang') ?? 'tr';

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

    // Resolve locale for each vehicle
    const resolved = rows.map(v => ({
      ...v,
      displayName: (v.nameTranslations?.[lang] ?? v.nameTranslations?.['tr'] ?? v.name),
      displayShortDesc: (v.shortDescTranslations?.[lang] ?? v.shortDescTranslations?.['tr'] ?? v.shortDescription ?? ''),
      displayTagline: (v.taglineTranslations?.[lang] ?? v.taglineTranslations?.['tr'] ?? ''),
    }));

    return NextResponse.json({ vehicles: resolved });
  } catch (err) {
    console.error('Vehicles GET error:', err);
    return NextResponse.json({ vehicles: [] });
  }
}
