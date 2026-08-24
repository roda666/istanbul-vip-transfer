import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { locations, transferRoutes, transferRouteTranslations, vehicles } from '@/db/schema';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
const DISTANCE_SOURCES = new Set(['LEGACY_UNVERIFIED', 'COORDINATE_ESTIMATE', 'ADMIN_VERIFIED']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function transportOptions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      name: optionalText(item.name) ?? '',
      summary: optionalText(item.summary) ?? '',
      downside: optionalText(item.downside) ?? '',
    }))
    .filter((item) => item.name && item.summary && item.downside)
    .slice(0, 8);
}

function routeNotes(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && !!item.trim()).map((item) => item.trim()).slice(0, 12)
    : [];
}

function faqItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({ question: optionalText(item.question) ?? '', answer: optionalText(item.answer) ?? '' }))
    .filter((item) => item.question && item.answer)
    .slice(0, 12);
}

function positiveInteger(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function optionalUuid(value: unknown): string | null | undefined {
  if (value == null || value === '') return null;
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : undefined;
}

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
  let session;
  try { session = await requireAdminSession(); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 }); }

  const { name, origin, destination, distanceKm, durationMinutes,
    priceVitoMinEur, priceVitoMaxEur, priceSprinterMinEur, priceSprinterMaxEur,
    imagePath, displayOrder, active, description, seoTitle, seoDescription,
     ogTitle, ogDescription, relatedServiceSlug, indexable, introParagraph, transportOptions: rawTransportOptions,
     routeNotes: rawRouteNotes, faqItems: rawFaqItems, normalDurationMinMinutes, normalDurationMaxMinutes,
     peakDurationMinMinutes, peakDurationMaxMinutes, hasCrossContinentPassage,
    originLocationId, destinationLocationId, defaultVehicleId, distanceSource } = body;

  if (!name || !origin || !destination) {
    return NextResponse.json({ error: 'Güzergah adı, kalkış ve varış zorunludur.' }, { status: 400 });
  }
  if ((originLocationId == null) !== (destinationLocationId == null)) {
    return NextResponse.json({ error: 'Kalkış ve varış lokasyon kimlikleri birlikte seçilmelidir.' }, { status: 422 });
  }

  const normalizedOriginLocationId = optionalUuid(originLocationId);
  const normalizedDestinationLocationId = optionalUuid(destinationLocationId);
  const normalizedDefaultVehicleId = optionalUuid(defaultVehicleId);
  if (normalizedOriginLocationId === undefined || normalizedDestinationLocationId === undefined || normalizedDefaultVehicleId === undefined) {
    return NextResponse.json({ error: 'Lokasyon ve varsayılan araç kimlikleri geçerli UUID olmalıdır.' }, { status: 422 });
  }
  const locationIds = normalizedOriginLocationId && normalizedDestinationLocationId
    ? [normalizedOriginLocationId, normalizedDestinationLocationId]
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
  const distanceKmValue = positiveInteger(distanceKm);
  const durationMinutesValue = positiveInteger(durationMinutes);
  if (locationIds.length && (!distanceKmValue || !durationMinutesValue)) {
    return NextResponse.json({ error: 'Yönetilen rota için pozitif mesafe ve süre gereklidir.' }, { status: 422 });
  }
  const normalizedDistanceSource = typeof distanceSource === 'string' && DISTANCE_SOURCES.has(distanceSource)
    ? distanceSource
    : 'LEGACY_UNVERIFIED';
  if (normalizedDistanceSource !== 'LEGACY_UNVERIFIED' && (!locationIds.length || !distanceKmValue)) {
    return NextResponse.json({ error: 'Tahmini veya doğrulanmış mesafe için iki kayıtlı lokasyon ve pozitif mesafe gereklidir.' }, { status: 422 });
  }
  if (normalizedDefaultVehicleId) {
    const [vehicle] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, normalizedDefaultVehicleId)).limit(1);
    if (!vehicle) return NextResponse.json({ error: 'Varsayılan araç bulunamadı.' }, { status: 422 });
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
      distanceKm: distanceKmValue ?? 0,
      distanceSource: normalizedDistanceSource,
      distanceVerifiedAt: normalizedDistanceSource === 'ADMIN_VERIFIED' ? new Date() : null,
      distanceVerifiedBy: normalizedDistanceSource === 'ADMIN_VERIFIED' ? session.adminId : null,
      defaultVehicleId: normalizedDefaultVehicleId,
      durationMinutes: durationMinutesValue ?? 0,
      normalDurationMinMinutes: positiveInteger(normalDurationMinMinutes),
      normalDurationMaxMinutes: positiveInteger(normalDurationMaxMinutes),
      peakDurationMinMinutes: positiveInteger(peakDurationMinMinutes),
      peakDurationMaxMinutes: positiveInteger(peakDurationMaxMinutes),
      hasCrossContinentPassage: hasCrossContinentPassage === true,
      priceVitoMinEur: Number(priceVitoMinEur ?? 0),
      priceVitoMaxEur: Number(priceVitoMaxEur ?? 0),
      priceSprinterMinEur: Number(priceSprinterMinEur ?? 0),
      priceSprinterMaxEur: Number(priceSprinterMaxEur ?? 0),
      imagePath: imagePath ? String(imagePath) : null,
      displayOrder: Number(displayOrder ?? 0),
      active: active !== false,
      description: description ? String(description) : null,
      introParagraph: optionalText(introParagraph),
      transportOptions: transportOptions(rawTransportOptions),
      routeNotes: routeNotes(rawRouteNotes),
      faqItems: faqItems(rawFaqItems),
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
