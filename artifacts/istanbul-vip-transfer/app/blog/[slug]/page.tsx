import type { Metadata } from 'next';
import { buildBlogAlternates } from '@/lib/blog-hreflang';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import PageHero from '@/components/PageHero';
import ArticleBody from '@/components/ArticleBody';
import SafeArticleImage from '@/components/SafeArticleImage';
import { getPublishedBlogPost, getPublishedBlogSlugs, getRelatedPublishedBlogPosts } from '@/lib/blog-cms';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getPublishedBlogSlugs();
  return slugs.map(slug => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  if (!post) return { title: 'Sayfa Bulunamadı', robots: { index: false, follow: false } };

  const PAGE = `${BASE}/blog/${post.slug}`;
  const title = post.seoTitle ?? post.ogTitle ?? post.title;
  const description = [
    post.seoDescription,
    post.ogDescription,
    post.excerpt,
  ].find(value => value?.trim()) ?? 'İstanbul havalimanı transferi ve VIP ulaşım hakkında güvenilir rehber.';
  const { trCanonical, languages } = await buildBlogAlternates(post.slug);

  return {
    title,
    description,
    alternates: { canonical: trCanonical, languages },
    openGraph: {
      title: post.ogTitle ?? title,
      description: post.ogDescription ?? description,
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'article',
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      images: post.heroImage
        ? [{ url: post.heroImage, alt: post.heroImageAlt ?? post.title }]
        : [SITE.ogImage],
    },
    robots: { index: true, follow: true },
  };
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  if (!post) notFound();

  const PAGE = `${BASE}/blog/${post.slug}`;

  // Fetch FAQs and other posts in parallel
  const [faqs, otherPosts] = await Promise.all([
    (async () => {
      try {
        const { db }      = await import('@/db');
        const { faqs: faqsTable } = await import('@/db/schema');
        const { eq, asc } = await import('drizzle-orm');
        return await db.select().from(faqsTable)
          .where(eq(faqsTable.contentId, post.id))
          .orderBy(asc(faqsTable.sortOrder));
      } catch { return []; }
    })(),
    getRelatedPublishedBlogPosts(post.slug),
  ]);

  const blogPostingSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt ?? undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    image: post.heroImage ?? undefined,
    url: PAGE,
    author: { '@type': 'Organization', name: 'İstanbul VIP Transfer', url: BASE },
    publisher: { '@type': 'Organization', name: 'İstanbul VIP Transfer', url: BASE },
    keywords: post.tags.join(', ') || undefined,
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: PAGE },
    ],
  };

  const faqSchema = faqs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  } : null;

  return (
    <>
      <PageHero
        breadcrumbs={[
          { label: 'Ana Sayfa', href: '/' },
          { label: 'Blog', href: '/blog' },
          { label: post.title },
        ]}
        title={post.title}
        subtitle={[
          post.category,
          post.readTimeMinutes ? `${post.readTimeMinutes} dk okuma` : null,
          post.publishedAt ? post.publishedAt.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' }) : null,
        ].filter(Boolean).join(' · ')}
      />

      {/* Article image */}
      {post.heroImage && (
        <div className="max-w-4xl mx-auto px-5 md:px-8 pt-10">
          <div className="relative aspect-video rounded-sm overflow-hidden">
            <SafeArticleImage src={post.heroImage} alt={post.heroImageAlt} fallbackAlt={post.title} priority quality={60} className="object-cover" sizes="(max-width: 1024px) 100vw, 896px" fill />
          </div>
        </div>
      )}

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="max-w-3xl mx-auto px-5 md:px-8 pt-6 flex flex-wrap gap-2">
          {post.tags.map(tag => (
            <span key={tag} style={{ padding: '3px 10px', background: '#EFF6FF', color: '#1D4ED8', borderRadius: '4px', fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Article body */}
      <article className="max-w-3xl mx-auto px-5 md:px-8 py-12 md:py-16" aria-label={post.title}>
        <ArticleBody body={post.body ?? ''} />

        {/* Updated date */}
        {post.updatedAt && (
          <p className="mt-10 text-xs" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
            Son güncelleme:{' '}
            <time dateTime={post.updatedAt.toISOString()}>
              {post.updatedAt.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </time>
          </p>
        )}

        <div className="mt-8">
          <Link href="/blog" className="text-sm tracking-wider uppercase transition-colors hover:text-[#755700]" style={{ color: '#755700', fontFamily: 'Inter, sans-serif' }}>
            ← Tüm Yazılar
          </Link>
        </div>
      </article>

      {/* FAQ section */}
      {faqs.length > 0 && (
        <section className="py-12 max-w-3xl mx-auto px-5 md:px-8">
          <h2 className="text-xl font-bold mb-6" style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}>
            Sık Sorulan Sorular
          </h2>
          <div className="space-y-4">
            {faqs.map(faq => (
              <details key={faq.id} className="group" style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                <summary style={{ padding: '14px 16px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600, color: '#1E293B', background: '#F8FAFC' }}>
                  {faq.question}
                </summary>
                <div style={{ padding: '14px 16px', fontSize: '14px', lineHeight: 1.7, color: '#374151', fontFamily: 'Inter, sans-serif' }}>
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Diğer Yazılar */}
      {otherPosts.length > 0 && (
        <section className="py-14 md:py-16" style={{ background: '#EDF3F7' }}>
          <div className="max-w-5xl mx-auto px-5 md:px-8">
            <p className="text-xs tracking-[0.25em] uppercase mb-8 text-center" style={{ color: '#755700', fontFamily: 'Inter, sans-serif' }}>
              Diğer Yazılar
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {otherPosts.map((other) => (
                <Link key={other.slug} href={`/blog/${other.slug}`}
                  className="group flex gap-4 p-5 rounded transition-colors duration-200"
                  style={{ border: '1px solid #D8E1E8', background: '#FFFFFF', textDecoration: 'none' }}>
                  {other.heroImage && (
                    <div className="flex-shrink-0 rounded overflow-hidden" style={{ width: '80px', height: '60px' }}>
                      <SafeArticleImage
                        src={other.heroImage}
                        alt={other.heroImageAlt}
                        fallbackAlt={other.title}
                        className="w-full h-full object-cover"
                        sizes="80px"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    {other.category && (
                      <p className="text-[10px] tracking-[0.15em] uppercase mb-1" style={{ color: '#755700', fontFamily: 'Inter, sans-serif' }}>
                        {other.category}
                      </p>
                    )}
                    <p className="text-sm font-medium leading-snug transition-colors duration-200 group-hover:text-[#755700]"
                      style={{ color: '#263F55', fontFamily: 'Playfair Display, Georgia, serif' }}>
                      {other.title}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />}
    </>
  );
}
