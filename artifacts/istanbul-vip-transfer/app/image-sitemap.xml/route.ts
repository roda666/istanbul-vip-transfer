import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;

// Image inventory changes whenever the CMS or AI Studio publishes new assets.
export const dynamic = 'force-dynamic';

type ImageEntry = { imageUrl: string; alt: string };

/** Collect every /api/storage/objects/... image src + its best alt text from a SERVICE JSON or BLOG_POST markdown body. */
function extractBodyImages(raw: string | null, contentType: string): ImageEntry[] {
  if (!raw) return [];
  const out: ImageEntry[] = [];
  if (contentType === 'SERVICE') {
    let parsed: { contentSections?: { image?: { src?: string; alt?: string } }[]; inlineImages?: { src?: string; alt?: string }[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
    for (const section of parsed.contentSections ?? []) {
      if (section.image?.src) out.push({ imageUrl: section.image.src, alt: section.image.alt ?? '' });
    }
    for (const img of parsed.inlineImages ?? []) {
      if (img.src) out.push({ imageUrl: img.src, alt: img.alt ?? '' });
    }
  } else {
    const re = /!\[([^\]]*)\]\((\/api\/storage\/objects\/[^\s)]+)\)/g;
    for (const m of raw.matchAll(re)) out.push({ imageUrl: m[2], alt: m[1] });
  }
  return out;
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Google Images XML sitemap — one <url> per public page, each carrying the
 * page's <image:image> entries (loc + title from alt text). Next's built-in
 * MetadataRoute.Sitemap has no image extension support, hence a hand-rolled
 * XML route here. Only pages that actually carry an object-storage image are
 * listed; pages with a static/placeholder asset are skipped.
 */
export async function GET() {
  const pages = new Map<string, ImageEntry[]>();
  function add(pageUrl: string, imageUrl: string, alt: string) {
    if (!imageUrl || !imageUrl.startsWith('/api/storage/objects/')) return;
    const list = pages.get(pageUrl) ?? [];
    if (list.some((e) => e.imageUrl === imageUrl)) return;
    list.push({ imageUrl: `${BASE}${imageUrl}`, alt });
    pages.set(pageUrl, list);
  }

  try {
    const { db } = await import('@/db');
    const { content, transferRoutes, vehicles } = await import('@/db/schema');
    const { eq, and } = await import('drizzle-orm');

    // ── Service + blog pages ────────────────────────────────────────────────
    const contentRows = await db
      .select({
        slug: content.slug,
        contentType: content.contentType,
        heroImage: content.heroImage,
        heroImageAlt: content.heroImageAlt,
        ogImage: content.ogImage,
        title: content.title,
        body: content.body,
      })
      .from(content)
      .where(and(eq(content.status, 'PUBLISHED'), eq(content.indexable, true), eq(content.isActive, true)));

    for (const row of contentRows) {
      const pageUrl = row.contentType === 'BLOG_POST' ? `${BASE}/blog/${row.slug}` : `${BASE}/${row.slug}`;
      if (row.heroImage) add(pageUrl, row.heroImage, row.heroImageAlt ?? row.title);
      if (row.ogImage && row.ogImage !== row.heroImage) add(pageUrl, row.ogImage, row.heroImageAlt ?? row.title);
      for (const img of extractBodyImages(row.body, row.contentType)) add(pageUrl, img.imageUrl, img.alt || row.title);
    }

    // ── Transfer-route detail pages ──────────────────────────────────────────
    const routeRows = await db
      .select({ slug: transferRoutes.slug, name: transferRoutes.name, imagePath: transferRoutes.imagePath })
      .from(transferRoutes)
      .where(and(eq(transferRoutes.active, true), eq(transferRoutes.indexable, true)));
    for (const row of routeRows) {
      if (row.imagePath) add(`${BASE}/guzergah/${row.slug}`, row.imagePath, typeof row.name === 'string' ? row.name : row.slug);
    }

    // ── Fleet page (all vehicles share the /araclar listing page) ───────────
    const vehicleRows = await db
      .select({ coverImage: vehicles.coverImage, coverImageAlt: vehicles.coverImageAlt, name: vehicles.name, gallery: vehicles.gallery })
      .from(vehicles)
      .where(eq(vehicles.status, 'PUBLISHED'));
    for (const row of vehicleRows) {
      const name = typeof row.name === 'string' ? row.name : 'Araç';
      if (row.coverImage) add(`${BASE}/araclar`, row.coverImage, row.coverImageAlt ?? name);
      for (const item of (row.gallery as { url?: string; alt?: string }[] | null) ?? []) {
        if (item?.url) add(`${BASE}/araclar`, item.url, item.alt ?? name);
      }
    }
  } catch {
    // Database unavailable — return whatever was already collected (may be empty);
    // an empty-but-valid sitemap is safer than a 500 for crawlers.
  }

  const urlEntries = [...pages.entries()]
    .map(([pageUrl, images]) => {
      const imageTags = images
        .map((img) => `    <image:image>\n      <image:loc>${xmlEscape(img.imageUrl)}</image:loc>\n      <image:title>${xmlEscape(img.alt)}</image:title>\n    </image:image>`)
        .join('\n');
      return `  <url>\n    <loc>${xmlEscape(pageUrl)}</loc>\n${imageTags}\n  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urlEntries}\n</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
