import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const pointSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});
const requestSchema = z.union([
  z.object({ originLocationId: z.string().uuid(), destinationLocationId: z.string().uuid() }),
  z.object({ originCoordinates: pointSchema, destinationCoordinates: pointSchema }),
]);

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

  const { resolveCoordinateDistance, resolveLocationDistance } = await import('@/lib/location-distance');
  const result = 'originCoordinates' in parsed.data
    ? await resolveCoordinateDistance({ origin: parsed.data.originCoordinates, destination: parsed.data.destinationCoordinates })
    : await resolveLocationDistance(parsed.data);
  return NextResponse.json({ result }, { status: result.state === 'UNAVAILABLE' ? 422 : 200 });
}