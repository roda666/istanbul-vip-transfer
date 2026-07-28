import { NextRequest, NextResponse } from 'next/server';

/**
 * Public (no auth) locations endpoint for the booking form.
 * GET /data/locations?for=pickup|dropoff&scope=local|intercity
 * Returns active, non-archived locations ordered by displayOrder then name.
 * Uses force-dynamic so admin changes appear immediately.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const forParam = searchParams.get('for'); // 'pickup' | 'dropoff' | null
  const scopeParam = searchParams.get('scope'); // 'local' | 'intercity' | null

  try {
    const { db } = await import('@/db');
    const { locations } = await import('@/db/schema');
    const { eq, and, isNull, asc, or } = await import('drizzle-orm');

    const conditions = [
      isNull(locations.archivedAt),
      eq(locations.isActive, true),
    ];

    if (forParam === 'pickup') conditions.push(eq(locations.pickupEnabled, true));
    else if (forParam === 'dropoff') conditions.push(eq(locations.dropoffEnabled, true));

    // Scope filter: local → LOCAL + BOTH, intercity → INTERCITY + BOTH
    if (scopeParam === 'local') {
      conditions.push(
        or(eq(locations.scope, 'LOCAL'), eq(locations.scope, 'BOTH'))!,
      );
    } else if (scopeParam === 'intercity') {
      conditions.push(
        or(eq(locations.scope, 'INTERCITY'), eq(locations.scope, 'BOTH'))!,
      );
    }

    const rows = await db
      .select({
        id: locations.id,
        name: locations.name,
        slug: locations.slug,
        type: locations.type,
        scope: locations.scope,
        city: locations.city,
        district: locations.district,
      })
      .from(locations)
      .where(and(...conditions))
      .orderBy(asc(locations.displayOrder), asc(locations.name));

    return NextResponse.json({ locations: rows });
  } catch (err) {
    console.error('Public locations error:', err);
    return NextResponse.json({ locations: [] }, { status: 200 });
  }
}
