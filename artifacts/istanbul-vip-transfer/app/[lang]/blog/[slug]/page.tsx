/**
 * Translated blog post page: /en/blog/[slug], /de/blog/[slug], etc.
 * Uses getPublishedBlogTranslation() from lib/blog-cms.ts.
 * Falls back to 404 if no published translation exists for this slug+lang.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { isValidLang, getDictionary } from '@/lib/i18n';
import { getOgLocale } from '@/lib/i18n/seo';
import { buildBlogAlternates } from '@/lib/blog-hreflang';
import { getPublishedBlogTranslation } from '@/lib/blog-cms';
import { SITE } from '@/lib/site-config';
import { getContactSettings } from '@/lib/site-settings-server';
import { getPublicLanguage } from '@/lib/i18n/active-locales';
import ArticleBody from '@/components/ArticleBody';
import SafeArticleImage from '@/components/SafeArticleImage';

interface Props {
  params: Promise<{ lang: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug: rawSlug } = await params;
  // Next.js app-router may pass non-ASCII path segments still percent-encoded.
  const slug = decodeURIComponent(rawSlug);
  if (!isValidLang(lang)) return {};

  const translation = await getPublishedBlogTranslation(slug, lang);
  if (!translation) return { robots: { index: false } };

  const title = translation.metaTitle ?? translation.title ?? 'VIP Transfer Istanbul';
  const description = [
    translation.metaDescription,
    translation.excerpt,
  ].find(value => value?.trim()) ?? 'VIP Transfer Istanbul airport transfer and private transportation guide.';
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
        ? [{ url: translation.sourceHeroImage, alt: translation.title ?? 'VIP Transfer Istanbul' }]
        : [SITE.ogImage],
    },
    robots: { index: true, follow: true },
  };
}

export default async function TranslatedBlogPost({ params }: Props) {
  const { lang, slug: rawSlug } = await params;
  // Next.js app-router may pass non-ASCII path segments still percent-encoded.
  const slug = decodeURIComponent(rawSlug);
  if (!isValidLang(lang)) notFound();

  const [translation, cs, language] = await Promise.all([
    getPublishedBlogTranslation(slug, lang),
    getContactSettings(),
    getPublicLanguage(lang),
  ]);
  if (!translation) notFound();

  const dict = getDictionary(lang);
  const dir  = language?.direction ?? 'ltr';
  const isRtl = dir === 'rtl';
  const localizedTitle = translation.title?.trim() || dict.common.notFound;

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
          <div className="relative rounded-2xl overflow-hidden mb-8 aspect-video">
            <SafeArticleImage src={translation.sourceHeroImage} fallbackAlt={localizedTitle} priority quality={60} className="object-cover" sizes="(max-width: 768px) 100vw, 768px" fill />
          </div>
        )}

        <div className="rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #D9E2EC', boxShadow: '0 4px 24px rgba(16,42,67,0.06)' }}>
          <div className="p-8 md:p-12">
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
              {localizedTitle}
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
              <div className="max-w-none">
                <ArticleBody body={translation.body} />
              </div>
            ) : (
              <p style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>{dict.common.loading}</p>
            )}

          </div>
        </div>

      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org', '@type': 'BlogPosting',
          headline: localizedTitle,
          description: translation.excerpt ?? undefined,
          url: postUrl, inLanguage: lang,
          datePublished: translation.publishedAt?.toISOString(),
          image: translation.sourceHeroImage ?? undefined,
          publisher: { '@type': 'Organization', name: 'VIP Transfer Istanbul', url: SITE.siteUrl, telephone: cs.phoneE164, email: cs.email },
        }),
      }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org', '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: dict.nav.home, item: SITE.siteUrl },
            { '@type': 'ListItem', position: 2, name: dict.nav.blog, item: `${SITE.siteUrl}/${lang}/blog` },
            { '@type': 'ListItem', position: 3, name: localizedTitle, item: postUrl },
          ],
        }),
      }} />
    </article>
  );
}
