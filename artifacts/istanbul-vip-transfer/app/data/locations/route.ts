import { NextRequest, NextResponse } from 'next/server';

/**
 * Public (no auth) locations endpoint for the booking form.
 * GET /data/locations?for=pickup|dropoff&scope=local|intercity&q=...
 * Returns a small, server-filtered result set only after the visitor types.
 * Local search is deliberately limited to Istanbul locations. Intercity search
 * only returns province records, never districts outside Istanbul.
 * Uses force-dynamic so admin changes appear immediately.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const forParam = searchParams.get('for'); // 'pickup' | 'dropoff' | null
  const scopeParam = searchParams.get('scope'); // 'local' | 'intercity' | null
  const query = searchParams.get('q')?.trim() ?? '';

  // Do not ship the booking catalog on initial page load. The search field
  // requests its results only after the visitor has started typing.
  if (!query) {
    return NextResponse.json({ locations: [], query: '', limit: 24 });
  }

  try {
    const { db } = await import('@/db');
    const { locations } = await import('@/db/schema');
    const { eq, and, isNull, asc, or, sql } = await import('drizzle-orm');

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
      // District choice is useful only in Istanbul. Keeping the catalog local
      // also avoids returning districts from another city after future admin
      // imports.
      conditions.push(eq(locations.city, 'İstanbul'));
    } else if (scopeParam === 'intercity') {
      conditions.push(
        or(eq(locations.scope, 'INTERCITY'), eq(locations.scope, 'BOTH'))!,
      );
      // A city is sufficient for intercity bookings; the detailed address is
      // collected by the adjacent address field.
      conditions.push(eq(locations.type, 'PROVINCE'));
    }

    const normalizedQuery = query
      .toLocaleLowerCase('tr-TR')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/İ/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c');
    const pattern = `%${normalizedQuery}%`;
    conditions.push(or(
      sql`translate(lower(${locations.name}), 'çğıöşü', 'cgiosu') LIKE ${pattern}`,
      sql`translate(lower(${locations.city}), 'çğıöşü', 'cgiosu') LIKE ${pattern}`,
      sql`translate(lower(${locations.district}), 'çğıöşü', 'cgiosu') LIKE ${pattern}`,
    )!);

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
      .orderBy(asc(locations.displayOrder), asc(locations.name))
      .limit(24);

    return NextResponse.json({ locations: rows, query, limit: 24 });
  } catch (err) {
    console.error('Public locations error:', err);
    return NextResponse.json({ locations: [] }, { status: 200 });
  }
}
