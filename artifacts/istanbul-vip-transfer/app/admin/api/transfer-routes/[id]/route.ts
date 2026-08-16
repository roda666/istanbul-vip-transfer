import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { transferRoutes } from '@/db/schema';
import type { NewTransferRoute } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/** Normalize text to a URL-safe slug */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** PUT /admin/api/transfer-routes/[id] — update a route */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdminSession(); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 }); }

  const { name, origin, destination, distanceKm, durationMinutes,
    priceVitoMinEur, priceVitoMaxEur, priceSprinterMinEur, priceSprinterMaxEur,
    imagePath, displayOrder, active } = body;

  if (!name || !origin || !destination) {
    return NextResponse.json({ error: 'Güzergah adı, kalkış ve varış zorunludur.' }, { status: 400 });
  }

  // Only update slug if caller explicitly supplies a new one
  const newSlug = (body.slug as string | undefined)?.trim()
    ? slugify(String(body.slug))
    : undefined;

  try {
    const updatePayload: Partial<NewTransferRoute> = {
      name: String(name),
      origin: String(origin),
      destination: String(destination),
      distanceKm: Number(distanceKm ?? 0),
      durationMinutes: Number(durationMinutes ?? 0),
      priceVitoMinEur: Number(priceVitoMinEur ?? 0),
      priceVitoMaxEur: Number(priceVitoMaxEur ?? 0),
      priceSprinterMinEur: Number(priceSprinterMinEur ?? 0),
      priceSprinterMaxEur: Number(priceSprinterMaxEur ?? 0),
      imagePath: imagePath ? String(imagePath) : null,
      displayOrder: Number(displayOrder ?? 0),
      active: active !== false,
      updatedAt: new Date(),
    };
    if (newSlug) updatePayload.slug = newSlug;

    const [row] = await db
      .update(transferRoutes)
      .set(updatePayload)
      .where(eq(transferRoutes.id, id))
      .returning();

    if (!row) return NextResponse.json({ error: 'Güzergah bulunamadı.' }, { status: 404 });
    return NextResponse.json({ route: row });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('transfer_routes_slug_unique')) {
      return NextResponse.json({ error: 'Bu slug zaten kullanılıyor.' }, { status: 409 });
    }
    console.error('admin transfer-routes PUT error:', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

/** DELETE /admin/api/transfer-routes/[id] — delete a route */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdminSession(); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;

  try {
    await db.delete(transferRoutes).where(eq(transferRoutes.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('admin transfer-routes DELETE error:', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
