import { asc, and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { content } from '@/db/schema';

export type PublishedTransferService = {
  slug: string;
  title: string;
  excerpt: string | null;
};

export async function getPublishedTransferServices(): Promise<PublishedTransferService[]> {
  return db.select({
    slug: content.slug,
    title: content.title,
    excerpt: content.excerpt,
  }).from(content).where(and(
    eq(content.contentType, 'SERVICE'),
    eq(content.status, 'PUBLISHED'),
    eq(content.isActive, true),
  )).orderBy(asc(content.title), asc(content.slug));
}

/**
 * `undefined` means the legacy omitted-value default. Explicit null remains
 * null; every non-null slug must be an actual published service slug.
 */
export function resolvePublishedServiceSlug(
  value: unknown,
  serviceSlugs: ReadonlySet<string>,
): { ok: true; slug: string | null } | { ok: false; error: string } {
  if (value === null) return { ok: true, slug: null };
  if (value === undefined || value === '') {
    return serviceSlugs.has('vip-transfer')
      ? { ok: true, slug: 'vip-transfer' }
      : { ok: true, slug: null };
  }
  if (typeof value !== 'string' || !serviceSlugs.has(value.trim())) {
    return { ok: false, error: 'İlişkili hizmet slug değeri yayınlanmış bir SERVICE kaydıyla eşleşmelidir.' };
  }
  return { ok: true, slug: value.trim() };
}
