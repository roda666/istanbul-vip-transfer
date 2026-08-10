/**
 * Translated blog listing page: /en/blog, /de/blog, /ru/blog, /ar/blog
 * Shows published translations for BLOG_POST content, grouped by lang.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { contentTranslations, content } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { isValidLang, getDictionary } from '@/lib/i18n';
import { buildAlternates, getOgLocale } from '@/lib/i18n/seo';
import { ArrowRight } from 'lucide-react';

interface Props {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isValidLang(lang)) return {};

  const alternates = await buildAlternates('/blog', [lang]);
  const titles: Record<string, string> = {
    en: 'Blog | Istanbul VIP Transfer',
    de: 'Blog | Istanbul VIP Transfer',
    ru: 'Блог | Стамбул VIP Трансфер',
    ar: 'المدونة | إسطنبول VIP ترانسفير',
  };
  return {
    title: titles[lang] ?? titles.en,
    alternates: { canonical: alternates.canonical, languages: alternates.languages },
    openGraph: { locale: getOgLocale(lang) },
    robots: { index: true, follow: true },
  };
}

export default async function TranslatedBlogPage({ params }: Props) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();

  const dict = getDictionary(lang);

  // Fetch published translations for blog posts
  let posts: Array<{
    id: string;
    slug: string | null;
    title: string | null;
    excerpt: string | null;
    publishedAt: Date | null;
    sourceSlug: string;
  }> = [];

  try {
    const rows = await db
      .select({
        id: contentTranslations.id,
        slug: contentTranslations.slug,
        title: contentTranslations.title,
        excerpt: contentTranslations.excerpt,
        publishedAt: contentTranslations.publishedAt,
        sourceSlug: content.slug,
      })
      .from(contentTranslations)
      .innerJoin(content, eq(contentTranslations.entityId, content.id))
      .where(
        and(
          eq(contentTranslations.targetLanguageCode, lang),
          eq(contentTranslations.status, 'PUBLISHED'),
          eq(content.contentType, 'BLOG_POST'),
        ),
      )
      .orderBy(contentTranslations.publishedAt);
    posts = rows;
  } catch {
    // DB unavailable — show empty state
  }

  const isRtl = lang === 'ar';

  return (
    <section
      className="py-20 min-h-screen"
      style={{ background: '#F7F8FC' }}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="max-w-5xl mx-auto px-5 md:px-8">
        <div className="mb-14 text-center">
          <span className="text-xs tracking-[0.3em] uppercase mb-3 block" style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}>
            Blog
          </span>
          <h1 className="text-4xl md:text-5xl font-bold" style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}>
            {lang === 'en' ? 'Articles & Guides'
              : lang === 'de' ? 'Artikel & Ratgeber'
              : lang === 'ru' ? 'Статьи и гиды'
              : 'مقالات وأدلة'}
          </h1>
        </div>

        {posts.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center"
            style={{ background: '#FFFFFF', border: '1px solid #D9E2EC' }}
          >
            <p style={{ color: '#50677A', fontFamily: 'Inter, sans-serif', fontSize: '15px' }}>
              {lang === 'en' ? 'Articles in English are coming soon.'
                : lang === 'de' ? 'Artikel auf Deutsch folgen in Kürze.'
                : lang === 'ru' ? 'Статьи на русском языке скоро появятся.'
                : 'المقالات باللغة العربية ستكون متاحة قريباً.'}
            </p>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 mt-6 text-sm font-medium focus:outline-none focus-visible:underline"
              style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}
            >
              {lang === 'ar' ? '← ' : ''}
              {lang === 'en' ? 'Read in Turkish'
                : lang === 'de' ? 'Auf Türkisch lesen'
                : lang === 'ru' ? 'Читать на турецком'
                : 'اقرأ باللغة التركية'}
              {lang !== 'ar' ? ' →' : ''}
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/${lang}/blog/${post.slug ?? post.sourceSlug}`}
                className="group rounded-2xl overflow-hidden block transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C79A35]"
                style={{ background: '#FFFFFF', border: '1px solid #D9E2EC', textDecoration: 'none' }}
              >
                <div className="p-6">
                  <h2
                    className="text-base font-semibold mb-2 leading-snug"
                    style={{ color: '#102A43', fontFamily: 'Playfair Display, Georgia, serif' }}
                  >
                    {post.title ?? post.sourceSlug}
                  </h2>
                  {post.excerpt && (
                    <p className="text-sm leading-relaxed mb-4 line-clamp-3" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
                      {post.excerpt}
                    </p>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}>
                    {dict.common.readMore}
                    <ArrowRight size={12} aria-hidden="true" style={{ transform: isRtl ? 'scaleX(-1)' : undefined }} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
