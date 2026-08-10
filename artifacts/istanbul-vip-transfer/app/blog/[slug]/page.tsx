import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import PageHero from '@/components/PageHero';
import BookingForm from '@/components/BookingForm';
import ArticleBody from '@/components/ArticleBody';
import { getBlogPost, getAllSlugs, blogPosts } from '@/lib/blog-data';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;

interface Props {
  params: Promise<{ slug: string }>;
}

/** Static export compatibility: pre-render all published article slugs. */
export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return { title: 'Sayfa Bulunamadı', robots: { index: false, follow: false } };

  const PAGE = `${BASE}/blog/${post.slug}`;
  const title = post.metaTitle ?? post.title;
  return {
    title,
    description: post.description,
    alternates: { canonical: PAGE },
    openGraph: {
      title,
      description: post.description,
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      images:
        post.image
          ? [{ url: post.image, alt: post.imageAlt ?? post.title }]
          : [SITE.ogImage],
    },
    robots: { index: true, follow: true },
  };
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const PAGE = `${BASE}/blog/${post.slug}`;

  /** Other published articles, excluding the current one */
  const otherPosts = blogPosts.filter((p) => p.slug !== post.slug);

  const blogPostingSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    image: post.image ?? undefined,
    url: PAGE,
    author: {
      '@type': 'Organization',
      name: 'İstanbul VIP Transfer',
      url: BASE,
    },
    publisher: {
      '@type': 'Organization',
      name: 'İstanbul VIP Transfer',
      url: BASE,
    },
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

  return (
    <>
      <PageHero
        breadcrumbs={[
          { label: 'Ana Sayfa', href: '/' },
          { label: 'Blog', href: '/blog' },
          { label: post.title },
        ]}
        title={post.title}
        subtitle={`${post.category} · ${new Date(post.publishedAt).toLocaleDateString('tr-TR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}`}
      />

      {/* Article image */}
      {post.image && (
        <div className="max-w-4xl mx-auto px-5 md:px-8 pt-10">
          <div className="aspect-video rounded-sm overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.image}
              alt={post.imageAlt ?? post.title}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Article body */}
      <article
        className="max-w-3xl mx-auto px-5 md:px-8 py-12 md:py-16"
        aria-label={post.title}
      >
        <ArticleBody body={post.body} />

        {/* Updated date */}
        {post.updatedAt && (
          <p className="mt-10 text-xs" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
            Son güncelleme:{' '}
            <time dateTime={post.updatedAt}>
              {new Date(post.updatedAt).toLocaleDateString('tr-TR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          </p>
        )}

        <div className="mt-8">
          <Link
            href="/blog"
            className="text-sm tracking-wider uppercase transition-colors hover:text-[#E5C36A]"
            style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
          >
            ← Tüm Yazılar
          </Link>
        </div>
      </article>

      <BookingForm />

      {/* ── İlgili Hizmetler ── */}
      {post.relatedServices && post.relatedServices.length > 0 && (
        <section className="py-14 md:py-16" style={{ background: '#0D0D0D' }}>
          <div className="max-w-3xl mx-auto px-5 md:px-8">
            <p
              className="text-xs tracking-[0.25em] uppercase mb-6 text-center"
              style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
            >
              İlgili Hizmetler
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {post.relatedServices.map((service) => (
                <Link
                  key={service.href}
                  href={service.href}
                  className="px-5 py-2.5 rounded text-xs tracking-wider uppercase transition-colors duration-200 hover:bg-[#C9A84C]/10"
                  style={{
                    border: '1px solid rgba(201,168,76,0.25)',
                    color: '#C9A84C',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {service.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Diğer Yazılar ── */}
      {otherPosts.length > 0 && (
        <section className="py-14 md:py-16" style={{ background: '#EDF3F7' }}>
          <div className="max-w-5xl mx-auto px-5 md:px-8">
            <p
              className="text-xs tracking-[0.25em] uppercase mb-8 text-center"
              style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
            >
              Diğer Yazılar
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {otherPosts.map((other) => (
                <Link
                  key={other.slug}
                  href={`/blog/${other.slug}`}
                  className="group flex gap-4 p-5 rounded transition-colors duration-200"
                  style={{
                    border: '1px solid #D8E1E8',
                    background: '#FFFFFF',
                  }}
                >
                  {other.image && (
                    <div
                      className="flex-shrink-0 rounded overflow-hidden"
                      style={{ width: '80px', height: '60px' }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={other.image}
                        alt={other.imageAlt ?? other.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p
                      className="text-[10px] tracking-[0.15em] uppercase mb-1"
                      style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
                    >
                      {other.category}
                    </p>
                    <p
                      className="text-sm font-medium leading-snug transition-colors duration-200 group-hover:text-[#C9A84C]"
                      style={{ color: '#263F55', fontFamily: 'Playfair Display, Georgia, serif' }}
                    >
                      {other.title}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}
