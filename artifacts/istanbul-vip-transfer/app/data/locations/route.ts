import { NextRequest, NextResponse } from 'next/server';

/**
 * Public (no auth) locations endpoint for the booking form.
 * GET /data/locations?for=pickup|dropoff
 * Returns active, non-archived locations ordered by displayOrder then name.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const forParam = searchParams.get('for'); // 'pickup' | 'dropoff' | null (= all)

  try {
    const { db } = await import('@/db');
    const { locations } = await import('@/db/schema');
    const { eq, and, isNull, asc } = await import('drizzle-orm');

    const conditions = [
      isNull(locations.archivedAt),
      eq(locations.isActive, true),
    ];

    if (forParam === 'pickup') conditions.push(eq(locations.pickupEnabled, true));
    else if (forParam === 'dropoff') conditions.push(eq(locations.dropoffEnabled, true));

    const rows = await db
      .select({
        id: locations.id,
        name: locations.name,
        slug: locations.slug,
        type: locations.type,
        city: locations.city,
        district: locations.district,
      })
      .from(locations)
      .where(and(...conditions))
      .orderBy(asc(locations.displayOrder), asc(locations.name));

    return NextResponse.json(
      { locations: rows },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      },
    );
  } catch (err) {
    console.error('Public locations error:', err);
    return NextResponse.json({ locations: [] }, { status: 200 });
  }
}
