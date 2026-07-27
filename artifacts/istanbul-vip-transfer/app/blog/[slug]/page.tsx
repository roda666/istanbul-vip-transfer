import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import PageHero from '@/components/PageHero';
import BookingForm from '@/components/BookingForm';
import { getBlogPost, getAllSlugs } from '@/lib/blog-data';
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
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: PAGE },
    openGraph: {
      title: post.title,
      description: post.description,
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      images: post.image ? [{ url: post.image, alt: post.imageAlt }] : undefined,
    },
    robots: { index: true, follow: true },
  };
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const PAGE = `${BASE}/blog/${post.slug}`;

  const blogPostingSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    image: post.image || undefined,
    url: PAGE,
    publisher: {
      '@type': 'Organization',
      name: 'VIP Transfer Istanbul',
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
        subtitle={`${post.category} · ${new Date(post.publishedAt).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}`}
      />

      {/* Article image */}
      {post.image && (
        <div className="max-w-4xl mx-auto px-5 md:px-8 pt-10">
          <div className="aspect-video rounded-sm overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.image}
              alt={post.imageAlt}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Article body */}
      <article
        className="max-w-3xl mx-auto px-5 md:px-8 py-12 md:py-16"
        style={{ color: '#AAA', fontFamily: 'Inter, sans-serif' }}
      >
        <div
          className="prose prose-invert prose-sm md:prose-base leading-relaxed max-w-none"
          style={{ color: '#AAA' }}
        >
          {post.body.split('\n\n').map((para, i) => (
            <p key={i} className="mb-5 leading-relaxed">
              {para}
            </p>
          ))}
        </div>

        {/* Updated date */}
        {post.updatedAt && (
          <p className="mt-10 text-xs" style={{ color: '#555', fontFamily: 'Inter, sans-serif' }}>
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
