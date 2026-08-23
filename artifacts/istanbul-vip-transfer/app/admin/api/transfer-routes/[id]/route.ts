import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import { db } from '@/db';
import { locations, transferRoutes, transferRouteTranslations } from '@/db/schema';
import type { NewTransferRoute } from '@/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';
const VALID_TRANSLATION_STATUSES = new Set(['NOT_STARTED', 'DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'OUTDATED', 'FAILED']);

type TranslationPayload = {
  languageCode?: unknown;
  title?: unknown;
  description?: unknown;
  seoTitle?: unknown;
  seoDescription?: unknown;
  ogTitle?: unknown;
  ogDescription?: unknown;
  status?: unknown;
  isManuallyLocked?: unknown;
};

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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
  try { await requireAdminSession(); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;

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
      distanceKm: Number(distanceKm ?? 0),
      durationMinutes: Number(durationMinutes ?? 0),
      priceVitoMinEur: Number(priceVitoMinEur ?? 0),
      priceVitoMaxEur: Number(priceVitoMaxEur ?? 0),
      priceSprinterMinEur: Number(priceSprinterMinEur ?? 0),
      priceSprinterMaxEur: Number(priceSprinterMaxEur ?? 0),
      imagePath: imagePath ? String(imagePath) : null,
      displayOrder: Number(displayOrder ?? 0),
      active: active !== false,
      description: text(description),
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
