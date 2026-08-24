import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { locations, transferRoutes, transferRouteTranslations, vehicles } from '@/db/schema';
import type { NewTransferRoute } from '@/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';
const VALID_TRANSLATION_STATUSES = new Set(['NOT_STARTED', 'DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'OUTDATED', 'FAILED']);
const DISTANCE_SOURCES = new Set(['LEGACY_UNVERIFIED', 'COORDINATE_ESTIMATE', 'ADMIN_VERIFIED']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function positiveInteger(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function optionalUuid(value: unknown): string | null | undefined {
  if (value == null || value === '') return null;
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : undefined;
}

type TranslationPayload = {
  languageCode?: unknown;
  title?: unknown;
  description?: unknown;
  seoTitle?: unknown;
  seoDescription?: unknown;
  ogTitle?: unknown;
  ogDescription?: unknown;
  introParagraph?: unknown;
  transportOptions?: unknown;
  routeNotes?: unknown;
  faqItems?: unknown;
  status?: unknown;
  isManuallyLocked?: unknown;
};

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function transportOptions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      name: text(item.name) ?? '',
      summary: text(item.summary) ?? '',
      downside: text(item.downside) ?? '',
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
    .map((item) => ({ question: text(item.question) ?? '', answer: text(item.answer) ?? '' }))
    .filter((item) => item.question && item.answer)
    .slice(0, 12);
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

/** PUT /admin/api/transfer-routes/[id] — update a route */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireAdminSession(); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;

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

  // Only update slug if caller explicitly supplies a new one
  const newSlug = (body.slug as string | undefined)?.trim()
    ? slugify(String(body.slug))
    : undefined;

  try {
    const updatePayload: Partial<NewTransferRoute> = {
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
      description: text(description),
      introParagraph: text(introParagraph),
      transportOptions: transportOptions(rawTransportOptions),
      routeNotes: routeNotes(rawRouteNotes),
      faqItems: faqItems(rawFaqItems),
      seoTitle: text(seoTitle),
      seoDescription: text(seoDescription),
      ogTitle: text(ogTitle),
      ogDescription: text(ogDescription),
      relatedServiceSlug: text(relatedServiceSlug) ? slugify(String(relatedServiceSlug)) : 'vip-transfer',
      indexable: indexable !== false,
      updatedAt: new Date(),
    };
    if (newSlug) updatePayload.slug = newSlug;

    const [row] = await db
      .update(transferRoutes)
      .set(updatePayload)
      .where(eq(transferRoutes.id, id))
      .returning();

    if (!row) return NextResponse.json({ error: 'Güzergah bulunamadı.' }, { status: 404 });
    const payloadTranslations = Array.isArray(body.translations) ? body.translations as TranslationPayload[] : [];
    for (const candidate of payloadTranslations) {
      const languageCode = text(candidate.languageCode);
      const title = text(candidate.title);
      const translatedDescription = text(candidate.description);
      if (!languageCode || languageCode === 'tr' || !title || !translatedDescription) continue;
      const status = typeof candidate.status === 'string' && VALID_TRANSLATION_STATUSES.has(candidate.status)
        ? candidate.status as 'NOT_STARTED' | 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'OUTDATED' | 'FAILED'
        : 'DRAFT';
      await db.insert(transferRouteTranslations).values({
        routeId: row.id,
        languageCode,
        title,
        description: translatedDescription,
        seoTitle: text(candidate.seoTitle),
        seoDescription: text(candidate.seoDescription),
        ogTitle: text(candidate.ogTitle),
        ogDescription: text(candidate.ogDescription),
        introParagraph: text(candidate.introParagraph),
        transportOptions: transportOptions(candidate.transportOptions),
        routeNotes: routeNotes(candidate.routeNotes),
        faqItems: faqItems(candidate.faqItems),
        status,
        isManuallyLocked: candidate.isManuallyLocked === true,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: [transferRouteTranslations.routeId, transferRouteTranslations.languageCode],
        set: {
          title,
          description: translatedDescription,
          seoTitle: text(candidate.seoTitle),
          seoDescription: text(candidate.seoDescription),
          ogTitle: text(candidate.ogTitle),
          ogDescription: text(candidate.ogDescription),
          introParagraph: text(candidate.introParagraph),
          transportOptions: transportOptions(candidate.transportOptions),
          routeNotes: routeNotes(candidate.routeNotes),
          faqItems: faqItems(candidate.faqItems),
          status,
          isManuallyLocked: candidate.isManuallyLocked === true,
          publishedAt: status === 'PUBLISHED' ? new Date() : null,
          updatedAt: new Date(),
        },
      });
    }
    revalidatePath(`/guzergah/${row.slug}`);
    for (const locale of ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl']) {
      revalidatePath(`/${locale}/guzergah/${row.slug}`);
    }
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
    const [existing] = await db.select({ slug: transferRoutes.slug }).from(transferRoutes).where(eq(transferRoutes.id, id));
    await db.delete(transferRoutes).where(eq(transferRoutes.id, id));
    if (existing) {
      revalidatePath(`/guzergah/${existing.slug}`);
      for (const locale of ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl']) {
        revalidatePath(`/${locale}/guzergah/${existing.slug}`);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('admin transfer-routes DELETE error:', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
