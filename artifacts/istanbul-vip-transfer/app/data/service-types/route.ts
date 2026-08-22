import { NextResponse } from 'next/server';

/**
 * Public (no auth) service types endpoint for the booking form.
 * GET /data/service-types
 * Returns only enabled service types, ordered by displayOrder.
 * Uses force-dynamic so admin changes appear immediately.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { db } = await import('@/db');
    const { serviceTypes } = await import('@/db/schema');
    const { eq, asc } = await import('drizzle-orm');

    const items = await db
      .select({
        id: serviceTypes.id,
        key: serviceTypes.key,
        label: serviceTypes.label,
        description: serviceTypes.description,
        quoteEnabled: serviceTypes.quoteEnabled,
        reservationEnabled: serviceTypes.reservationEnabled,
        displayOrder: serviceTypes.displayOrder,
      })
      .from(serviceTypes)
      .where(eq(serviceTypes.enabled, true))
      .orderBy(asc(serviceTypes.displayOrder));

    return NextResponse.json(
      { items },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
    );
  } catch (err) {
    console.error('Public service-types error:', err);
    // Return hardcoded fallback so form always works
    return NextResponse.json(
      {
        items: [
          { id: '1', key: 'AIRPORT_TRANSFER', label: 'Havalimanı / Şehir İçi Transfer', description: null, quoteEnabled: true, reservationEnabled: true, displayOrder: 0 },
          { id: '2', key: 'INTERCITY', label: 'Şehirler Arası Transfer', description: null, quoteEnabled: true, reservationEnabled: true, displayOrder: 1 },
          { id: '3', key: 'ALLOCATION', label: 'Araç Tahsisi', description: null, quoteEnabled: true, reservationEnabled: true, displayOrder: 2 },
          { id: '4', key: 'TOUR', label: 'Özel Tur / Gezi', description: null, quoteEnabled: true, reservationEnabled: true, displayOrder: 3 },
        ],
      },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
    );
  }
}
