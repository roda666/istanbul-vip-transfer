import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { locations, transferRoutes, transferRouteTranslations } from '@/db/schema';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

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

/**
 * Find the first unused slug by querying existing slugs that equal base or
 * match base-N. Handles gaps created by deletions (e.g. if base-2 was deleted
 * while base-3 exists, will still try base-2 first).
 */
async function findAvailableSlug(baseSlug: string): Promise<string> {
  const existing = await db
    .select({ slug: transferRoutes.slug })
    .from(transferRoutes)
    .where(sql`slug = ${baseSlug} OR slug ~ ('^' || ${baseSlug} || '-[0-9]+$')`);

  const taken = new Set(existing.map((r) => r.slug));
  if (!taken.has(baseSlug)) return baseSlug;
  let i = 2;
  while (taken.has(`${baseSlug}-${i}`)) i++;
  return `${baseSlug}-${i}`;
}

/** GET /admin/api/transfer-routes — list all routes */
export async function GET() {
  try { await requireAdminSession(); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  try {
    const rows = await db.select().from(transferRoutes).orderBy(asc(transferRoutes.displayOrder));
    const routeIds = rows.map((route) => route.id);
    const translations = routeIds.length
      ? await db.select().from(transferRouteTranslations).where(inArray(transferRouteTranslations.routeId, routeIds))
      : [];
    const translationsByRoute = new Map<string, typeof translations>();
    for (const translation of translations) {
      const current = translationsByRoute.get(translation.routeId) ?? [];
      current.push(translation);
      translationsByRoute.set(translation.routeId, current);
    }
    return NextResponse.json({
      routes: rows.map((route) => ({ ...route, translations: translationsByRoute.get(route.id) ?? [] })),
    });
  } catch (err) {
    console.error('admin transfer-routes GET error:', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

/** POST /admin/api/transfer-routes — create a new route */
export async function POST(req: NextRequest) {
  try { await requireAdminSession(); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 }); }

  const { name, origin, destination, distanceKm, durationMinutes,
    priceVitoMinEur, priceVitoMaxEur, priceSprinterMinEur, priceSprinterMaxEur,
    imagePath, displayOrder, active, description, seoTitle, seoDescription,
    ogTitle, ogDescription, relatedServiceSlug, indexable,
    originLocationId, destinationLocationId } = body;

  if (!name || !origin || !destination) {
    return NextResponse.json({ error: 'Güzergah adı, kalkış ve varış zorunludur.' }, { status: 400 });
  }
  if ((originLocationId == null) !== (destinationLocationId == null)) {
    return NextResponse.json({ error: 'Kalkış ve varış lokasyon kimlikleri birlikte seçilmelidir.' }, { status: 422 });
  }

  const locationIds = originLocationId && destinationLocationId
    ? [String(originLocationId), String(destinationLocationId)]
    : [];
  if (locationIds.length) {
    const selected = await db.select({ id: locations.id }).from(locations).where(and(
      inArray(locations.id, locationIds),
      eq(locations.isActive, true),
      isNull(locations.archivedAt),
    ));
    if (selected.length !== 2 || selected[0]?.id === selected[1]?.id) {
      return NextResponse.json({ error: 'Geçerli ve farklı iki aktif lokasyon seçilmelidir.' }, { status: 422 });
    }
  }

  const baseSlug = (body.slug as string | undefined)?.trim()
    ? slugify(String(body.slug))
    : slugify(`${String(origin)}-${String(destination)}`);

  try {
    const slug = await findAvailableSlug(baseSlug);

    const [row] = await db.insert(transferRoutes).values({
      slug,
      name: String(name),
      origin: String(origin),
      destination: String(destination),
      originLocationId: locationIds[0] ?? null,
      destinationLocationId: locationIds[1] ?? null,
      distanceKm: Number(distanceKm ?? 0),
      durationMinutes: Number(durationMinutes ?? 0),
      priceVitoMinEur: Number(priceVitoMinEur ?? 0),
      priceVitoMaxEur: Number(priceVitoMaxEur ?? 0),
      priceSprinterMinEur: Number(priceSprinterMinEur ?? 0),
      priceSprinterMaxEur: Number(priceSprinterMaxEur ?? 0),
      imagePath: imagePath ? String(imagePath) : null,
      displayOrder: Number(displayOrder ?? 0),
      active: active !== false,
      description: description ? String(description) : null,
      seoTitle: seoTitle ? String(seoTitle) : null,
      seoDescription: seoDescription ? String(seoDescription) : null,
      ogTitle: ogTitle ? String(ogTitle) : null,
      ogDescription: ogDescription ? String(ogDescription) : null,
      relatedServiceSlug: relatedServiceSlug ? slugify(String(relatedServiceSlug)) : 'vip-transfer',
      indexable: indexable !== false,
    }).returning();

    return NextResponse.json({ route: row }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('transfer_routes_slug_unique')) {
      return NextResponse.json({ error: 'Slug çakışması oluştu, lütfen tekrar deneyin.' }, { status: 409 });
    }
    console.error('admin transfer-routes POST error:', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
