import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { getRouteTollAlternatives } from '@/lib/toll-management';

export const dynamic = 'force-dynamic';

/** GET /admin/api/pricing/tolls/route-alternatives/[routeId] — quote-safe route choices with live tariff coverage. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ routeId: string }> }) {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { routeId } = await params;
  const parsed = z.string().uuid().safeParse(routeId);
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz güzergâh.' }, { status: 422 });
  const vehicleId = request.nextUrl.searchParams.get('vehicleId');
  if (vehicleId && !z.string().uuid().safeParse(vehicleId).success) {
    return NextResponse.json({ error: 'Geçersiz araç.' }, { status: 422 });
  }
  try {
    return NextResponse.json(await getRouteTollAlternatives(routeId, vehicleId ?? undefined));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Geçiş alternatifleri alınamadı.' }, { status: 422 });
  }
}