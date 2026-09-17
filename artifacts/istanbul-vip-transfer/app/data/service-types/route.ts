import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { localizeServiceType } from '@/lib/service-type-localization';

/**
 * Public (no auth) service types endpoint for the booking form.
 * GET /data/service-types
 * Returns only enabled service types, ordered by displayOrder.
 * Uses force-dynamic so admin changes appear immediately.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { db } = await import('@/db');
    const { serviceTypes } = await import('@/db/schema');
    const { eq, asc } = await import('drizzle-orm');
    const lang = request.nextUrl.searchParams.get('lang')?.trim().toLowerCase() || 'tr';

    const items = await db
      .select({
        id: serviceTypes.id,
        key: serviceTypes.key,
        label: serviceTypes.label,
        description: serviceTypes.description,
        translations: serviceTypes.translations,
        quoteEnabled: serviceTypes.quoteEnabled,
        reservationEnabled: serviceTypes.reservationEnabled,
        displayOrder: serviceTypes.displayOrder,
      })
      .from(serviceTypes)
      .where(eq(serviceTypes.enabled, true))
      .orderBy(asc(serviceTypes.displayOrder));

    return NextResponse.json(
      { items: items.map((item) => localizeServiceType(item, lang)) },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } },
    );
  } catch (err) {
    console.error('Public service-types error:', err);
    return NextResponse.json(
      { error: 'Hizmet türleri şu anda alınamıyor.' },
      { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  }
}
