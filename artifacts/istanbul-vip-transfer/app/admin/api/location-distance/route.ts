import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  originLocationId: z.string().uuid(),
  destinationLocationId: z.string().uuid(),
});

/** Admin-only distance contract for the future fast quote flow. */
export async function POST(request: NextRequest) {
  try {
    await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
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
    return NextResponse.json({ error: 'Geçersiz lokasyon seçimi.' }, { status: 422 });
  }

  const { resolveLocationDistance } = await import('@/lib/location-distance');
  const result = await resolveLocationDistance(parsed.data);
  return NextResponse.json({ result }, { status: result.state === 'UNAVAILABLE' ? 422 : 200 });
}