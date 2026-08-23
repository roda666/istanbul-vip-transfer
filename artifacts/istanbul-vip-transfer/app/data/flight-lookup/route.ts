import { NextRequest, NextResponse } from 'next/server';
import { flightLookupInputSchema } from '@/lib/flight-meet-greet-contract';
import { lookupFlightInformation } from '@/lib/flight-meet-greet-server';

export const dynamic = 'force-dynamic';

/**
 * Reserved public lookup endpoint. No public form calls this while the feature
 * is closed. A valid request receives no provider contact or flight data unless
 * the server-side feature flag and a future provider adapter are both ready.
 */
export async function POST(request: NextRequest) {
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return NextResponse.json({ error: 'JSON required' }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = flightLookupInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz uçuş bilgisi.', code: 'INVALID_FLIGHT_INPUT' }, { status: 422 });
  }

  try {
    const result = await lookupFlightInformation(parsed.data);
    if (result.state === 'DISABLED') {
      return NextResponse.json({ error: 'Bu özellik henüz aktif değil.', code: 'FEATURE_DISABLED' }, { status: 404 });
    }
    if (result.state === 'PROVIDER_NOT_CONFIGURED') {
      return NextResponse.json({ error: 'Uçuş bilgisi şu anda kullanılamıyor.', code: 'PROVIDER_UNAVAILABLE' }, { status: 503 });
    }
    if (result.state === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Uçuş bilgisi bulunamadı.', code: 'FLIGHT_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ flight: result.flight });
  } catch (error) {
    console.error('Flight lookup failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Uçuş bilgisi şu anda kullanılamıyor.', code: 'PROVIDER_UNAVAILABLE' }, { status: 503 });
  }
}