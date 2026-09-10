import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  name: z.string().trim().min(2).max(200),
  city: z.string().trim().max(100).optional(),
  district: z.string().trim().max(200).optional(),
  suggestions: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      error: 'Google Maps’te aramak için lokasyon adı gereklidir. Koordinatları elle girebilirsiniz.',
    }, { status: 422 });
  }

  const query = Array.from(new Set([
    parsed.data.name,
    parsed.data.district,
    parsed.data.city,
    'Türkiye',
  ].filter((value): value is string => Boolean(value?.trim())))).join(', ');

  try {
    const { geocodeLocationAddress, searchLocationAddresses } = await import('@/lib/google-maps-geocoding');
    if (parsed.data.suggestions) {
      const suggestions = await searchLocationAddresses(query);
      return NextResponse.json({ suggestions });
    }
    const result = await geocodeLocationAddress(query);
    return NextResponse.json({ result });
  } catch (error) {
    const { GoogleGeocodingError } = await import('@/lib/google-maps-geocoding');
    if (error instanceof GoogleGeocodingError) {
      return NextResponse.json({
        error: `Google Maps’ten sonuç alınamadı: ${error.message} Koordinatları elle girebilirsiniz.`,
        code: error.code,
      }, { status: error.httpStatus });
    }
    console.error('Location geocoding error:', error);
    return NextResponse.json({
      error: 'Google Maps’ten sonuç alınamadı: Beklenmeyen bir hata oluştu. Koordinatları elle girebilirsiniz.',
    }, { status: 500 });
  }
}