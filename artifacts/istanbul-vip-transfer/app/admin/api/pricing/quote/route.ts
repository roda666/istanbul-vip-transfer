import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const quoteSchema = z.object({
  routeId: z.string().uuid().optional(),
  originLocationId: z.string().uuid().optional(),
  destinationLocationId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  mode: z.enum(['DISTANCE', 'HOURLY']),
  requestedHours: z.number().int().min(1).max(720).optional(),
  tripType: z.enum(['ONE_WAY', 'ROUND_TRIP']),
  tollAlternativeId: z.string().uuid().optional(),
  serviceQuantities: z.array(z.object({ serviceId: z.string().uuid(), quantity: z.number().int().min(1).max(99) })).max(20).optional(),
  reservationRequestId: z.string().uuid().optional(),
}).superRefine((value, ctx) => {
  if (value.mode === 'HOURLY' && !value.requestedHours) ctx.addIssue({ code: 'custom', path: ['requestedHours'], message: 'Tahsis için süre gereklidir.' });
  if (value.tollAlternativeId && !value.routeId) ctx.addIssue({ code: 'custom', path: ['tollAlternativeId'], message: 'Geçiş seçimi için güzergâh gereklidir.' });
  if (!value.routeId && (!value.originLocationId || !value.destinationLocationId)) {
    ctx.addIssue({ code: 'custom', path: ['originLocationId'], message: 'Fiyat için iki kayıtlı lokasyon seçilmelidir.' });
  }
  if ((value.originLocationId == null) !== (value.destinationLocationId == null)) {
    ctx.addIssue({ code: 'custom', path: ['destinationLocationId'], message: 'Kalkış ve varış birlikte seçilmelidir.' });
  }
});

/** POST /admin/api/pricing/quote — admin-only calculation; no public price route uses it. */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  const payload = quoteSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) return NextResponse.json({ error: payload.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });
  try {
    const { createAdminQuote } = await import('@/lib/admin-pricing-service');
    const quote = await createAdminQuote({ ...payload.data, adminId: session.adminId });
    return NextResponse.json(quote, { status: quote.result.state === 'AVAILABLE' ? 200 : 422 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fiyat hesaplanamadı.';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}