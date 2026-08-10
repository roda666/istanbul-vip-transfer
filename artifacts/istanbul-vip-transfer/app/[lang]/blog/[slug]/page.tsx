/**
 * Translated blog post page: /en/blog/[slug], /de/blog/[slug], etc.
 * Looks up a published translation by slug or by source content slug.
 * Falls back to 404 if no published translation exists.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/db';
import { contentTranslations, content } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { isValidLang, getDictionary, getLangDir } from '@/lib/i18n';
import { buildAlternates, getOgLocale } from '@/lib/i18n/seo';
import { SITE } from '@/lib/site-config';

interface Props {
  params: Promise<{ lang: string; slug: string }>;
}

async function getTranslation(lang: string, slug: string) {
  try {
    // Try to find by translated slug first, then by source slug
    const rows = await db
      .select({
        id: contentTranslations.id,
        title: contentTranslations.title,
        slug: contentTranslations.slug,
        excerpt: contentTranslations.excerpt,
        body: contentTranslations.body,
        metaTitle: contentTranslations.metaTitle,
        metaDescription: contentTranslations.metaDescription,
        publishedAt: contentTranslations.publishedAt,
        status: contentTranslations.status,
        sourceSlug: content.slug,
        sourceTitle: content.title,
      })
      .from(contentTranslations)
      .innerJoin(content, eq(contentTranslations.entityId, content.id))
      .where(
        and(
          eq(contentTranslations.targetLanguageCode, lang),
          eq(contentTranslations.status, 'PUBLISHED'),
          eq(content.contentType, 'BLOG_POST'),
          or(
            eq(contentTranslations.slug, slug),
            eq(content.slug, slug),
          ),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isValidLang(lang)) return {};

  const translation = await getTranslation(lang, slug);
  if (!translation) return { robots: { index: false } };

  const title = translation.metaTitle ?? translation.title ?? translation.sourceTitle;
  const description = translation.metaDescription ?? translation.excerpt ?? undefined;
  const path = `/blog/${translation.slug ?? slug}`;
  const alternates = await buildAlternates(path, [lang]);

  const canonicalUrl = `${SITE.siteUrl}/${lang}/blog/${translation.slug ?? slug}`;
  return {
    title: `${title} | VIP Transfer Istanbul`,
    description,
    alternates: { canonical: alternates.canonical, languages: alternates.languages },
    openGraph: {
      title: title ?? undefined,
      description: description,
      url: canonicalUrl,
      siteName: 'VIP Transfer Istanbul',
      locale: getOgLocale(lang),
      type: 'article',
      images: [SITE.ogImage],
    },
    robots: { index: true, follow: true },
  };
}

export default async function TranslatedBlogPost({ params }: Props) {
  const { lang, slug } = await params;
  if (!isValidLang(lang)) notFound();

  const translation = await getTranslation(lang, slug);
  if (!translation) notFound();

  const dict = getDictionary(lang);
  const dir = getLangDir(lang);

  return (
    <article
      className="py-20 min-h-screen"
      style={{ background: '#F7F8FC' }}
      dir={dir}
    >
      <div className="max-w-3xl mx-auto px-5 md:px-8">
        <Link
          href={`/${lang}/blog`}
          className="inline-flex items-center gap-1.5 mb-8 text-sm transition-colors focus:outline-none focus-visible:underline"
          style={{ color: '#50677A', fontFamily: 'Inter, sans-serif', textDecoration: 'none' }}
        >
          <ArrowLeft size={14} aria-hidden="true" style={{ transform: dir === 'rtl' ? 'scaleX(-1)' : undefined }} />
          {dict.common.back}
        </Link>

        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #D9E2EC', boxShadow: '0 4px 24px rgba(16,42,67,0.06)' }}
        >
          <div className="p-8 md:p-12">
            {translation.publishedAt && (
              <p className="text-xs mb-4 tracking-wider uppercase" style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}>
                {new Date(translation.publishedAt).toLocaleDateString(
                  lang === 'ar' ? 'ar-SA' : lang === 'ru' ? 'ru-RU' : lang === 'de' ? 'de-DE' : 'en-GB',
                  { year: 'numeric', month: 'long', day: 'numeric' }
                )}
              </p>
            )}

            <h1
              className="text-3xl md:text-4xl font-bold mb-6 leading-snug"
              style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}
            >
              {translation.title ?? translation.sourceTitle}
            </h1>

            {translation.excerpt && (
              <p
                className="text-lg mb-8 leading-relaxed"
                style={{ color: '#50677A', fontFamily: 'Inter, sans-serif', borderLeft: dir === 'rtl' ? undefined : '3px solid #C79A35', borderRight: dir === 'rtl' ? '3px solid #C79A35' : undefined, paddingLeft: dir === 'rtl' ? undefined : '16px', paddingRight: dir === 'rtl' ? '16px' : undefined }}
              >
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
              <p style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
                {dict.common.loading}
              </p>
            )}
          </div>
        </div>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: translation.title ?? translation.sourceTitle,
            description: translation.excerpt ?? undefined,
            url: `${SITE.siteUrl}/${lang}/blog/${translation.slug ?? slug}`,
            inLanguage: lang,
            datePublished: translation.publishedAt?.toISOString(),
            author: {
              '@type': 'Organization',
              name: 'VIP Transfer Istanbul',
              url: SITE.siteUrl,
            },
            publisher: {
              '@type': 'Organization',
              name: 'VIP Transfer Istanbul',
              url: SITE.siteUrl,
              telephone: SITE.phoneE164,
              email: SITE.email,
            },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.siteUrl },
              { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE.siteUrl}/${lang}/blog` },
              { '@type': 'ListItem', position: 3, name: translation.title ?? translation.sourceTitle, item: `${SITE.siteUrl}/${lang}/blog/${translation.slug ?? slug}` },
            ],
          }),
        }}
      />
    </article>
  );
}
