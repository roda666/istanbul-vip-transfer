import { NextRequest, NextResponse } from 'next/server';
import {
  computeCustomerContentSourceHash,
  enqueueCustomerContentTranslations,
} from '@/lib/customer-content-translation';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { locations, transferRoutes, transferRouteTranslations, vehicles } from '@/db/schema';
import type { NewTransferRoute } from '@/db/schema';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { revalidateAllHomepages } from '@/lib/homepage-revalidation';
import {
  deleteTransferRouteImageObject,
  isStrictTransferRouteImagePath,
  isValidTransferRouteImagePath,
  normalizeRouteImageAltText,
} from '@/lib/transfer-route-media';
import { transferRouteDisplayOrder } from '@/lib/inventory-order';
import { getPublishedTransferServices, resolvePublishedServiceSlug } from '@/lib/transfer-route-services';

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
     imagePath, imageAltText, imageAlt, displayOrder, active, description, seoTitle, seoDescription,
     ogTitle, ogDescription, relatedServiceSlug, indexable, introParagraph, transportOptions: rawTransportOptions,
     routeNotes: rawRouteNotes, faqItems: rawFaqItems, normalDurationMinMinutes, normalDurationMaxMinutes,
     peakDurationMinMinutes, peakDurationMaxMinutes, hasCrossContinentPassage,
    originLocationId, destinationLocationId, defaultVehicleId, distanceSource } = body;

  if (!name || !origin || !destination) {
    return NextResponse.json({ error: 'Güzergah adı, kalkış ve varış zorunludur.' }, { status: 400 });
  }
  if (imagePath != null && imagePath !== '' && !isValidTransferRouteImagePath(imagePath)) {
    return NextResponse.json({ error: 'Görsel yolu güvenli bir dahili depolama yolu olmalıdır.' }, { status: 422 });
  }
  let relatedServiceSlugValue: string | null;
  try {
    const services = await getPublishedTransferServices();
    const relatedService = resolvePublishedServiceSlug(relatedServiceSlug, new Set(services.map((service) => service.slug)));
    if (!relatedService.ok) return NextResponse.json({ error: relatedService.error }, { status: 422 });
    relatedServiceSlugValue = relatedService.slug;
  } catch {
    return NextResponse.json({ error: 'Yayınlanmış hizmetler doğrulanamadı.' }, { status: 503 });
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
    const [before] = await db.select({
      imagePath: transferRoutes.imagePath,
    }).from(transferRoutes).where(eq(transferRoutes.id, id)).limit(1);
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
       imageAltText: imagePath ? normalizeRouteImageAltText(imageAltText ?? imageAlt, `${String(origin)} - ${String(destination)} VIP transfer`) : null,
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
      relatedServiceSlug: relatedServiceSlugValue,
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
    // The route row has been mutated, so it is now safe to remove the previous
    // object when no other route still points at it. Translation work below
    // must not leave an otherwise unreferenced old asset behind.
    if (
      before?.imagePath
      && before.imagePath !== row.imagePath
      && isStrictTransferRouteImagePath(before.imagePath)
    ) {
      const stillReferenced = await db.select({ id: transferRoutes.id })
        .from(transferRoutes)
        .where(eq(transferRoutes.imagePath, before.imagePath))
        .limit(1);
      if (!stillReferenced.length) await deleteTransferRouteImageObject(before.imagePath);
    }
    const payloadTranslations = Array.isArray(body.translations) ? body.translations as TranslationPayload[] : [];
    const existingBeforePayload = await db.select().from(transferRouteTranslations)
      .where(eq(transferRouteTranslations.routeId, row.id));
    const existingByLocale = new Map(existingBeforePayload.map((translation) => [translation.languageCode, translation]));
    for (const candidate of payloadTranslations) {
      const languageCode = text(candidate.languageCode);
      const title = text(candidate.title);
      const translatedDescription = text(candidate.description);
      if (!languageCode || languageCode === 'tr' || !title || !translatedDescription) continue;
      const existing = existingByLocale.get(languageCode);
      // A manual lock is durable: neither translated fields nor the lock
      // itself may be changed by a normal route PUT payload.
      if (existing?.isManuallyLocked) continue;
      const status = typeof candidate.status === 'string' && VALID_TRANSLATION_STATUSES.has(candidate.status)
        ? candidate.status as 'NOT_STARTED' | 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'OUTDATED' | 'FAILED'
        : 'DRAFT';
      const values = {
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
      };
      if (existing) {
        await db.update(transferRouteTranslations).set(values).where(and(
          eq(transferRouteTranslations.id, existing.id),
          eq(transferRouteTranslations.isManuallyLocked, false),
        ));
      } else {
        await db.insert(transferRouteTranslations).values({
          routeId: row.id,
          languageCode,
          ...values,
        }).onConflictDoNothing({
          target: [transferRouteTranslations.routeId, transferRouteTranslations.languageCode],
        });
      }
    }

    /* Legacy inline translation is intentionally disabled: route writes must
       return after durable queue creation, never after provider calls. */
    if (false) {
    const { fillMissingTranslations, AUTO_TRANSLATION_LOCALES } = await import('@/lib/ai/fill-missing-translations');
    const existingRows = await db.select().from(transferRouteTranslations)
      .where(eq(transferRouteTranslations.routeId, row.id));
    const lockedLocales = new Set(existingRows
      .filter((translation) => translation.isManuallyLocked)
      .map((translation) => translation.languageCode));
    const existingMap = Object.fromEntries(existingRows.map((translation) => [
      translation.languageCode,
      translation.isManuallyLocked ? {
        title: String(name), description: text(description) ?? String(name),
        seoTitle: text(seoTitle) ?? '', seoDescription: text(seoDescription) ?? '',
        ogTitle: text(ogTitle) ?? '', ogDescription: text(ogDescription) ?? '',
        introParagraph: text(introParagraph) ?? '',
        origin: String(origin), destination: String(destination),
      } : {
        title: translation.title,
        description: translation.description,
        seoTitle: translation.seoTitle,
        seoDescription: translation.seoDescription,
        ogTitle: translation.ogTitle,
        ogDescription: translation.ogDescription,
        introParagraph: translation.introParagraph,
        origin: row.originTranslations?.[translation.languageCode],
        destination: row.destinationTranslations?.[translation.languageCode],
      },
    ]));
    const completed = await fillMissingTranslations({
      title: String(name),
      description: text(description) ?? String(name),
      seoTitle: text(seoTitle),
      seoDescription: text(seoDescription),
      ogTitle: text(ogTitle),
      ogDescription: text(ogDescription),
      introParagraph: text(introParagraph),
      origin: String(origin),
      destination: String(destination),
    }, existingMap, { lockedLocales });
    const nameTranslations = { ...(row.nameTranslations ?? {}) };
    const originTranslations = { ...(row.originTranslations ?? {}) };
    const destinationTranslations = { ...(row.destinationTranslations ?? {}) };

    for (const locale of AUTO_TRANSLATION_LOCALES) {
      const current = existingRows.find((translation) => translation.languageCode === locale);
      if (current?.isManuallyLocked) continue;
      const fields = completed[locale];
      if (!fields?.title || !fields.description) continue;
       if (!nameTranslations[locale]) nameTranslations[locale] = fields.title!;
       if (!originTranslations[locale] && fields.origin) originTranslations[locale] = fields.origin!;
       if (!destinationTranslations[locale] && fields.destination) destinationTranslations[locale] = fields.destination!;
      const values = {
         title: current?.title || fields.title!,
         description: current?.description || fields.description!,
        seoTitle: current?.seoTitle || fields.seoTitle || null,
        seoDescription: current?.seoDescription || fields.seoDescription || null,
        ogTitle: current?.ogTitle || fields.ogTitle || null,
        ogDescription: current?.ogDescription || fields.ogDescription || null,
        introParagraph: current?.introParagraph || fields.introParagraph || null,
        updatedAt: new Date(),
      };
      if (current) {
         await db.update(transferRouteTranslations).set(values as never).where(eq(transferRouteTranslations.id, current!.id));
      } else {
        await db.insert(transferRouteTranslations).values({
          routeId: row.id,
          languageCode: locale,
          status: 'DRAFT',
          isManuallyLocked: false,
          ...values,
        } as never);
      }
    }
    await db.update(transferRoutes).set({
      nameTranslations,
      originTranslations,
      destinationTranslations,
      updatedAt: new Date(),
    }).where(eq(transferRoutes.id, row.id));
    }

    await enqueueCustomerContentTranslations({
      entityType: 'transfer_route',
      entityId: row.id,
      sourceHash: computeCustomerContentSourceHash({
        name: row.name, slug: row.slug, origin: row.origin, destination: row.destination,
        description: row.description, introParagraph: row.introParagraph,
        transportOptions: row.transportOptions, routeNotes: row.routeNotes, faqItems: row.faqItems,
        seoTitle: row.seoTitle, seoDescription: row.seoDescription,
        ogTitle: row.ogTitle, ogDescription: row.ogDescription,
        imageAltText: row.imageAltText,
      }),
      adminId: session.adminId,
    });

    revalidatePath(`/guzergah/${row.slug}`);
    for (const locale of ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl']) {
      revalidatePath(`/${locale}/guzergah/${row.slug}`);
    }
    revalidateAllHomepages();
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

/** PATCH /admin/api/transfer-routes/[id] — lightweight list controls. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAdminSession(); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { id } = await params;
  let body: { action?: 'up' | 'down' | 'toggle-active' };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 }); }
  if (!body.action || !['up', 'down', 'toggle-active'].includes(body.action)) {
    return NextResponse.json({ error: 'Geçersiz action.' }, { status: 422 });
  }
  try {
    const result = await db.transaction(async (tx) => {
      const rows = await tx.select({
        id: transferRoutes.id,
        displayOrder: transferRoutes.displayOrder,
        active: transferRoutes.active,
      }).from(transferRoutes).orderBy(...transferRouteDisplayOrder()).for('update');
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) return { error: 'Güzergah bulunamadı.', status: 404 as const };
      if (body.action === 'toggle-active') {
        const [updated] = await tx.update(transferRoutes)
          .set({ active: !rows[index].active, updatedAt: new Date() })
          .where(eq(transferRoutes.id, id)).returning();
        return { route: updated };
      }
      const peerIndex = body.action === 'up' ? index - 1 : index + 1;
      if (peerIndex < 0 || peerIndex >= rows.length) return { error: 'Daha fazla hareket ettirilemiyor.', status: 400 as const };
      const reordered = [...rows];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(peerIndex, 0, moved);
      // Normalize only ordering metadata. This makes duplicate legacy values
      // deterministic and guarantees an inverse move restores the exact IDs.
      for (const [position, item] of reordered.entries()) {
        await tx.update(transferRoutes)
          .set({ displayOrder: position, updatedAt: new Date() })
          .where(eq(transferRoutes.id, item.id));
      }
      return {
        routes: reordered.map((item, position) => ({ ...item, displayOrder: position })),
        route: { ...moved, displayOrder: reordered.indexOf(moved) },
      };
    });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    revalidateAllHomepages();
    return NextResponse.json(result);
  } catch (err) {
    console.error('admin transfer-routes PATCH error:', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

/** DELETE /admin/api/transfer-routes/[id] — delete a route */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireAdminSession(); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  if (!session.capabilities.fleet_pricing.canManage) {
    return NextResponse.json({ error: 'Bu güzergâh için yönetim yetkisi gerekli.' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const [existing] = await db.select({
      slug: transferRoutes.slug,
      imagePath: transferRoutes.imagePath,
      active: transferRoutes.active,
    }).from(transferRoutes).where(eq(transferRoutes.id, id));
    if (existing?.active) {
      return NextResponse.json({
        error: 'Aktif güzergâh doğrudan silinemez. Önce pasifleştirin; bağlı fiyat ve geçiş ücreti kayıtları korunur.',
        dependencies: [{ type: 'publication', label: 'Aktif güzergâh', count: 1 }],
      }, { status: 409 });
    }
    const dependencies = await db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM route_price_rules WHERE route_id = ${id}) AS price_rules,
        (SELECT COUNT(*)::int FROM fixed_price_overrides WHERE route_id = ${id}) AS fixed_overrides,
        (SELECT COUNT(*)::int FROM route_toll_alternatives WHERE route_id = ${id}) AS toll_alternatives
    `);
    const dependencyCounts = (Array.from(dependencies)[0] ?? {}) as Record<string, number | string>;
    const dependencyLabels = [
      ['price_rules', 'Fiyat kuralları'],
      ['fixed_overrides', 'Sabit fiyat kayıtları'],
      ['toll_alternatives', 'Geçiş ücreti alternatifleri'],
    ].flatMap(([key, label]) => {
      const count = Number(dependencyCounts[key] ?? 0);
      return count > 0 ? [{ type: key, label, count }] : [];
    });
    if (dependencyLabels.length > 0) {
      return NextResponse.json({
        error: 'Bu güzergâh bağlı fiyat veya geçiş ücreti kayıtları içeriyor; önce bunları taşıyın veya pasifleştirin.',
        dependencies: dependencyLabels,
      }, { status: 409 });
    }
    await db.delete(transferRoutes).where(eq(transferRoutes.id, id));
    if (existing?.imagePath && isStrictTransferRouteImagePath(existing.imagePath)) {
      const stillReferenced = await db.select({ id: transferRoutes.id })
        .from(transferRoutes)
        .where(eq(transferRoutes.imagePath, existing.imagePath))
        .limit(1);
      if (!stillReferenced.length) await deleteTransferRouteImageObject(existing.imagePath);
    }
    if (existing) {
      revalidatePath(`/guzergah/${existing.slug}`);
      for (const locale of ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl']) {
        revalidatePath(`/${locale}/guzergah/${existing.slug}`);
      }
    }
    const { auditLogs } = await import('@/db/schema');
    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'DELETE',
      entityType: 'TransferRoute',
      entityId: id,
      metadata: { slug: existing?.slug ?? null },
    }).catch(() => {});
    revalidateAllHomepages();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('admin transfer-routes DELETE error:', err);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
