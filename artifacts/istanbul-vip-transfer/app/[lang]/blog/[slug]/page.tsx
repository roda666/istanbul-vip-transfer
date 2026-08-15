/**
 * Translated blog post page: /en/blog/[slug], /de/blog/[slug], etc.
 * Uses getPublishedBlogTranslation() from lib/blog-cms.ts.
 * Falls back to 404 if no published translation exists for this slug+lang.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { isValidLang, getDictionary, getLangDir } from '@/lib/i18n';
import { getOgLocale } from '@/lib/i18n/seo';
import { buildBlogAlternates } from '@/lib/blog-hreflang';
import { getPublishedBlogTranslation } from '@/lib/blog-cms';
import { SITE } from '@/lib/site-config';

interface Props {
  params: Promise<{ lang: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isValidLang(lang)) return {};

  const translation = await getPublishedBlogTranslation(slug, lang);
  if (!translation) return { robots: { index: false } };

  const title = translation.metaTitle ?? translation.title ?? translation.sourceTitle;
  const description = translation.metaDescription ?? translation.excerpt ?? undefined;
  const canonicalUrl = `${SITE.siteUrl}/${lang}/blog/${translation.slug ?? slug}`;
  const { languages } = await buildBlogAlternates(translation.sourceSlug);

  return {
    title: `${title} | VIP Transfer Istanbul`,
    description,
    alternates: { canonical: canonicalUrl, languages },
    openGraph: {
      title: title ?? undefined,
      description,
      url: canonicalUrl,
      siteName: 'VIP Transfer Istanbul',
      locale: getOgLocale(lang),
      type: 'article',
      publishedTime: translation.publishedAt?.toISOString(),
      images: translation.sourceHeroImage
        ? [{ url: translation.sourceHeroImage, alt: translation.sourceHeroImageAlt ?? translation.title ?? translation.sourceTitle }]
        : [SITE.ogImage],
    },
    robots: { index: true, follow: true },
  };
}

export default async function TranslatedBlogPost({ params }: Props) {
  const { lang, slug } = await params;
  if (!isValidLang(lang)) notFound();

  const translation = await getPublishedBlogTranslation(slug, lang);
  if (!translation) notFound();

  const dict = getDictionary(lang);
  const dir  = getLangDir(lang);
  const isRtl = dir === 'rtl';

  // Fetch FAQs from source content (TR source)
  let faqs: Array<{ id: string; question: string; answer: string; sortOrder: number }> = [];
  try {
    const { db }        = await import('@/db');
    const { faqs: ft }  = await import('@/db/schema');
    const { eq, asc }   = await import('drizzle-orm');
    // We need to get contentId from source slug — do a join lookup
    const { content }   = await import('@/db/schema');
    const [src] = await db.select({ id: content.id }).from(content)
      .where(eq(content.slug, translation.sourceSlug)).limit(1);
    if (src) {
      faqs = await db.select().from(ft).where(eq(ft.contentId, src.id)).orderBy(asc(ft.sortOrder));
    }
  } catch { /* no FAQs — continue */ }

  const faqSchema = faqs.length > 0 ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question', name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  } : null;

  const postUrl = `${SITE.siteUrl}/${lang}/blog/${translation.slug ?? slug}`;

  return (
    <article className="py-20 min-h-screen" style={{ background: '#F7F8FC' }} dir={dir}>
      <div className="max-w-3xl mx-auto px-5 md:px-8">
        <Link href={`/${lang}/blog`}
          className="inline-flex items-center gap-1.5 mb-8 text-sm transition-colors focus:outline-none focus-visible:underline"
          style={{ color: '#50677A', fontFamily: 'Inter, sans-serif', textDecoration: 'none' }}>
          <ArrowLeft size={14} aria-hidden="true" style={{ transform: isRtl ? 'scaleX(-1)' : undefined }} />
          {dict.common.back}
        </Link>

        {/* Cover image from source */}
        {translation.sourceHeroImage && (
          <div className="rounded-2xl overflow-hidden mb-8 aspect-video">
            {/* External URL set by admin — domain unknown, served as-is.
                fetchPriority="high" because this is the topmost visual on the page
                (potential LCP candidate). No lazy-loading on detail pages. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={translation.sourceHeroImage}
              alt={translation.sourceHeroImageAlt ?? translation.title ?? translation.sourceTitle}
              className="w-full h-full object-cover"
              decoding="async"
              fetchPriority="high"
              width={800}
              height={450}
            />
          </div>
        )}

        <div className="rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #D9E2EC', boxShadow: '0 4px 24px rgba(16,42,67,0.06)' }}>
          <div className="p-8 md:p-12">
            {/* Category */}
            {translation.sourceCategory && (
              <p className="text-xs mb-3 tracking-wider uppercase" style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}>
                {translation.sourceCategory}
              </p>
            )}

            {/* Date */}
            {translation.publishedAt && (
              <p className="text-xs mb-4 tracking-wider uppercase" style={{ color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>
                {new Date(translation.publishedAt).toLocaleDateString(
                  lang === 'ar' ? 'ar-SA' : lang === 'ru' ? 'ru-RU' : lang === 'de' ? 'de-DE' : 'en-GB',
                  { year: 'numeric', month: 'long', day: 'numeric' }
                )}
              </p>
            )}

            <h1 className="text-3xl md:text-4xl font-bold mb-6 leading-snug"
              style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}>
              {translation.title ?? translation.sourceTitle}
            </h1>

            {translation.excerpt && (
              <p className="text-lg mb-8 leading-relaxed"
                style={{
                  color: '#50677A', fontFamily: 'Inter, sans-serif',
                  borderLeft: isRtl ? undefined : '3px solid #C79A35',
                  borderRight: isRtl ? '3px solid #C79A35' : undefined,
                  paddingLeft: isRtl ? undefined : '16px',
                  paddingRight: isRtl ? '16px' : undefined,
                }}>
                {translation.excerpt}
              </p>
            )}

            {translation.body ? (
              <div
                className="prose prose-slate max-w-none"
                dangerouslySetInnerHTML={{ __html: translation.body }}
                style={{ fontFamily: 'Inter, sans-serif', lineHeight: 1.8, color: '#2D3748' }}
              />
            ) : (
              <p style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>{dict.common.loading}</p>
            )}

            {/* Author */}
            {translation.sourceAuthor && (
              <p className="mt-8 text-sm" style={{ color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>
                {translation.sourceAuthor}
              </p>
            )}
          </div>
        </div>

        {/* FAQs */}
        {faqs.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl font-bold mb-5" style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}>
              FAQ
            </h2>
            <div className="space-y-3">
              {faqs.map(faq => (
                <details key={faq.id} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                  <summary style={{ padding: '13px 15px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600, color: '#1E293B', background: '#F8FAFC' }}>
                    {faq.question}
                  </summary>
                  <div style={{ padding: '13px 15px', fontSize: '14px', lineHeight: 1.7, color: '#374151', fontFamily: 'Inter, sans-serif' }}>
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org', '@type': 'BlogPosting',
          headline: translation.title ?? translation.sourceTitle,
          description: translation.excerpt ?? undefined,
          url: postUrl, inLanguage: lang,
          datePublished: translation.publishedAt?.toISOString(),
          image: translation.sourceHeroImage ?? undefined,
          author: translation.sourceAuthor
            ? { '@type': 'Person', name: translation.sourceAuthor }
            : { '@type': 'Organization', name: 'VIP Transfer Istanbul', url: SITE.siteUrl },
          publisher: { '@type': 'Organization', name: 'VIP Transfer Istanbul', url: SITE.siteUrl, telephone: SITE.phoneE164, email: SITE.email },
        }),
      }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org', '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE.siteUrl}/${lang}/blog` },
            { '@type': 'ListItem', position: 3, name: translation.title ?? translation.sourceTitle, item: postUrl },
          ],
        }),
      }} />
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />}
    </article>
  );
}
