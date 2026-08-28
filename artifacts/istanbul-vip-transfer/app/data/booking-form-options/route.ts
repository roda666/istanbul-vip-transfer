import { NextRequest, NextResponse } from 'next/server';
import { getBookingFormOptionsStrict } from '@/lib/booking-form-bootstrap';
import { isRegistryLocale } from '@/lib/i18n/locale-registry';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestedLang = request.nextUrl.searchParams.get('lang') ?? 'tr';
  const lang = isRegistryLocale(requestedLang) ? requestedLang : 'tr';
  try {
    const options = await getBookingFormOptionsStrict(lang);

    return NextResponse.json(options, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Booking form options endpoint error:', error);
    return NextResponse.json(
      { error: 'Booking options are temporarily unavailable.' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': '2',
        },
      },
    );
  }
}