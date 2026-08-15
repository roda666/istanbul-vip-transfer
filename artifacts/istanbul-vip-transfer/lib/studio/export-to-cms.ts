/**
 * Export studio content to Blog or Service CMS as DRAFT.
 * Prevents slug conflicts with existing published pages.
 */
import 'server-only';
import type { StudioContent, StudioConfig } from './types';

type ExportResult =
  | { ok: true; cmsEntityId: string; cmsEntityType: 'blog' | 'service'; slug: string }
  | { ok: false; error: string };

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

export async function exportStudioToCms(opts: {
  contentType: 'blog' | 'service';
  trContent: StudioContent;
  config: StudioConfig;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
}): Promise<ExportResult> {
  const { contentType, trContent, coverImageUrl, coverImageAlt } = opts;
  const { db } = await import('@/db');
  const { content } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const baseSlug = trContent.slug || slugify(trContent.title);

  // ── Slug conflict check ───────────────────────────────────────────────────
  const existing = await db
    .select({ id: content.id, slug: content.slug })
    .from(content)
    .where(eq(content.slug, baseSlug));

  if (existing.length > 0) {
    return { ok: false, error: `"${baseSlug}" slug'u zaten kullanımda (ID: ${existing[0].id}). Farklı bir slug kullanın.` };
  }

  // ── Build the DRAFT record ────────────────────────────────────────────────
  const now = new Date();
  const contentType_ = contentType === 'blog' ? 'BLOG_POST' : 'SERVICE_PAGE';

  // Build body HTML (simple MD→HTML via regex for headings/bold/lists)
  const bodyHtml = trContent.bodyMd
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])(.+)$/gm, '<p>$1</p>');

  // Build FAQ JSON
  const faqJson = trContent.faqs.length > 0
    ? JSON.stringify(trContent.faqs.map((f, i) => ({ id: String(i + 1), question: f.question, answer: f.answer })))
    : null;

  try {
    const [inserted] = await db.insert(content).values({
      contentType: contentType_ as 'BLOG_POST' | 'SERVICE_PAGE',
      title: trContent.title,
      slug: baseSlug,
      status: 'DRAFT' as const,
      indexable: false,           // not indexable until published
      isActive: false,
      displayOrder: 0,
      showOnHomepage: false,
      showInNav: false,
      // SEO fields
      metaTitle: trContent.metaTitle || null,
      metaDescription: trContent.metaDescription || null,
      ogTitle: trContent.ogTitle || null,
      ogDescription: trContent.ogDescription || null,
      // Content
      bodyHtml: bodyHtml || null,
      excerpt: trContent.excerpt || null,
      // Hero image
      heroImageUrl: coverImageUrl || null,
      heroImageAlt: coverImageAlt || trContent.ogImageAlt || null,
      // FAQ
      faqJson: faqJson || null,
      // Timestamps
      createdAt: now,
      updatedAt: now,
    } as never).returning({ id: content.id, slug: content.slug });

    if (!inserted) {
      return { ok: false, error: 'Veritabanı kaydı oluşturulamadı.' };
    }

    return {
      ok: true,
      cmsEntityId: inserted.id,
      cmsEntityType: contentType,
      slug: inserted.slug,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `CMS dışa aktarma hatası: ${msg}` };
  }
}

/**
 * Check if a slug is already in use by a published/draft page.
 */
export async function checkSlugConflict(slug: string): Promise<{
  hasConflict: boolean;
  conflictingId?: string;
  conflictingStatus?: string;
}> {
  const { db } = await import('@/db');
  const { content } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const rows = await db
    .select({ id: content.id, status: content.status })
    .from(content)
    .where(eq(content.slug, slug))
    .limit(1);

  if (rows.length === 0) return { hasConflict: false };
  return { hasConflict: true, conflictingId: rows[0].id, conflictingStatus: rows[0].status };
}
