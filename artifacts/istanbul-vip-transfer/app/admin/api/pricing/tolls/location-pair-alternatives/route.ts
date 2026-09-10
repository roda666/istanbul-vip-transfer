import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { getLocationPairTollAlternatives } from '@/lib/toll-management';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const originLocationId = params.get('originLocationId');
  const destinationLocationId = params.get('destinationLocationId');
  if (!originLocationId || !z.string().uuid().safeParse(originLocationId).success
    || !destinationLocationId || !z.string().uuid().safeParse(destinationLocationId).success) {
    return NextResponse.json({ error: 'Geçersiz konum.' }, { status: 422 });
  }
  const vehicleId = params.get('vehicleId');
  if (vehicleId && !z.string().uuid().safeParse(vehicleId).success) {
    return NextResponse.json({ error: 'Geçersiz araç.' }, { status: 422 });
  }
  const pickupAtRaw = params.get('pickupAt');
  let pickupAt: Date | undefined;
  if (pickupAtRaw) {
    if (!z.string().datetime().safeParse(pickupAtRaw).success) {
      return NextResponse.json({ error: 'Geçersiz geçiş zamanı.' }, { status: 422 });
    }
    const parsed = new Date(pickupAtRaw);
    if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: 'Geçersiz geçiş zamanı.' }, { status: 422 });
    pickupAt = parsed;
  }
  try {
    return NextResponse.json(await getLocationPairTollAlternatives(
      originLocationId, destinationLocationId, vehicleId ?? undefined, pickupAt,
    ));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Geçiş alternatifleri alınamadı.' }, { status: 422 });
  }
}