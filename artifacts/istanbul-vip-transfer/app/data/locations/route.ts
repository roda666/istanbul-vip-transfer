import { NextRequest, NextResponse } from 'next/server';
import { PUBLICLY_UNAVAILABLE_BOOKING_LOCATION_SLUGS } from '@/lib/booking-location-policy';

/**
 * Public (no auth) locations endpoint for the booking form.
 * GET /data/locations?for=pickup|dropoff&scope=local|intercity&q=...
 *
 * With no `q`, this returns a full "browse" list (grouped by category, then
 * Turkish-alphabetized) so the combobox has something to show the moment a
 * visitor opens it — before, an empty `q` short-circuited to `[]` and the
 * dropdown looked empty/broken until the visitor started typing.
 *
 * Local search is limited to Istanbul locations. Intercity search returns
 * every province, plus Istanbul's own airports/districts (scope BOTH) so
 * they can appear ahead of the generic province list.
 * Uses force-dynamic so admin changes appear immediately.
 */
export const dynamic = 'force-dynamic';

const BROWSE_LIMIT = 200;
const SEARCH_LIMIT = 24;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const forParam = searchParams.get('for'); // 'pickup' | 'dropoff' | null
  const scopeParam = searchParams.get('scope'); // 'local' | 'intercity' | null
  const query = searchParams.get('q')?.trim() ?? '';
  const isBrowse = !query;

  try {
    const { db } = await import('@/db');
    const { locations } = await import('@/db/schema');
    const { eq, and, isNull, asc, or, sql, notInArray } = await import('drizzle-orm');

    const conditions = [
      isNull(locations.archivedAt),
      eq(locations.isActive, true),
      notInArray(locations.slug, [...PUBLICLY_UNAVAILABLE_BOOKING_LOCATION_SLUGS]),
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
      // Every other city is only ever represented at the PROVINCE level, but
      // Istanbul's own airports/districts (scope BOTH) should also surface
      // here — a previous hard `type = 'PROVINCE'` filter blocked that
      // granularity from ever appearing in intercity search.
      conditions.push(
        or(eq(locations.type, 'PROVINCE'), eq(locations.city, 'İstanbul'))!,
      );
    }

    if (query) {
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
    }

    const limit = isBrowse ? BROWSE_LIMIT : SEARCH_LIMIT;
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
      .limit(limit);

    // Category-rank first, then Turkish alphabetical, so the ordering rules
    // hold regardless of displayOrder: for intercity, Istanbul's own
    // locations must lead the generic province list; for local, airports
    // lead districts lead landmark/region points.
    const collator = new Intl.Collator('tr-TR', { sensitivity: 'base' });
    const categoryRank = (row: (typeof rows)[number]): number => {
      if (scopeParam === 'intercity') {
        return row.type === 'PROVINCE' ? 1 : 0;
      }
      switch (row.type) {
        case 'AIRPORT':  return 0;
        case 'DISTRICT': return 1;
        case 'REGION':   return 2;
        default:         return 3;
      }
    };
    rows.sort((a, b) => {
      const rankDiff = categoryRank(a) - categoryRank(b);
      return rankDiff !== 0 ? rankDiff : collator.compare(a.name, b.name);
    });

    return NextResponse.json({ locations: rows, query, limit });
  } catch (err) {
    console.error('Public locations error:', err);
    return NextResponse.json({ locations: [] }, { status: 200 });
  }
}
