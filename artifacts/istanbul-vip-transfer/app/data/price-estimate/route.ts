import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPriceEstimate } from '@/lib/price-calculator';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  routeSlug: z.string().trim().min(1).max(200).regex(/^[a-z0-9-]+$/),
  vehicleSlug: z.string().trim().min(1).max(200).regex(/^[a-z0-9-]+$/),
});

/**
 * Future public estimate API. Until an administrator explicitly enables the
 * feature, callers receive no price data and no rule-discovery information.
 */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return NextResponse.json({ error: 'JSON required' }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  }

  try {
    const result = await getPriceEstimate(parsed.data);
    if (result.state === 'DISABLED') {
      return NextResponse.json({ error: 'Bu özellik henüz aktif değil.', code: 'FEATURE_DISABLED' }, { status: 404 });
    }
    if (result.state === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Tahmini fiyat bulunamadı.' }, { status: 404 });
    }
    return NextResponse.json({ estimate: result.estimate });
  } catch (error) {
    console.error('Price estimate error:', error);
    return NextResponse.json({ error: 'Tahmini fiyat şu anda alınamıyor.' }, { status: 503 });
  }
}