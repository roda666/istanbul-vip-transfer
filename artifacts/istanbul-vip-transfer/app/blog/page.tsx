import type { Metadata } from 'next';
import Link from 'next/link';
import PageHero from '@/components/PageHero';
import { blogPosts, BLOG_LIVE } from '@/lib/blog-data';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/blog`;

const blogListingSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Blog | İstanbul VIP Transfer Rehberleri',
  description:
    'İstanbul havalimanı transferi, VIP ulaşım, araç seçimi ve rezervasyon süreçleri hakkında faydalı rehberler.',
  url: PAGE,
  inLanguage: 'tr',
  publisher: {
    '@type': 'Organization',
    name: 'VIP Transfer Istanbul',
    url: BASE,
    telephone: SITE.phoneE164,
    email: SITE.email,
  },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: BASE },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: PAGE },
  ],
};

export const metadata: Metadata = {
  title: 'Blog | İstanbul VIP Transfer Rehberleri',
  description:
    'İstanbul havalimanı transferi, VIP ulaşım, araç seçimi ve rezervasyon süreçleri hakkında faydalı rehberleri inceleyin.',
  alternates: { canonical: PAGE },
  openGraph: {
    title: 'Blog | İstanbul VIP Transfer Rehberleri',
    description:
      'İstanbul havalimanı transferi, VIP ulaşım, araç seçimi ve rezervasyon süreçleri hakkında faydalı rehberleri inceleyin.',
    url: PAGE,
    siteName: 'VIP Transfer Istanbul',
    locale: 'tr_TR',
    type: 'website',
    images: [SITE.ogImage],
  },
  robots: { index: true, follow: true },
};

export default function BlogPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[{ label: 'Ana Sayfa', href: '/' }, { label: 'Blog' }]}
        title="Transfer Rehberleri"
        subtitle="Havalimanı transferi, araç seçimi ve İstanbul ulaşımı hakkında faydalı bilgiler."
      />

      <section className="py-16 md:py-20 max-w-7xl mx-auto px-5 md:px-8">
        {BLOG_LIVE ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map((post) => (
              <article
                key={post.slug}
                className="rounded-sm overflow-hidden group flex flex-col"
                style={{ background: '#FFFFFF', border: '1px solid #D9E2EC' }}
              >
                {post.image && (
                  <div className="aspect-video overflow-hidden flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.image}
                      alt={post.imageAlt ?? post.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="p-6 flex flex-col flex-1">
                  <p
                    className="text-[10px] tracking-[0.18em] uppercase mb-3"
                    style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
                  >
                    {post.category} &middot;{' '}
                    <time dateTime={post.publishedAt}>
                      {new Date(post.publishedAt).toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </time>
                  </p>
                  <h2
                    className="text-lg font-bold mb-3 leading-snug flex-1"
                    style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}
                  >
                    <Link
                      href={`/blog/${post.slug}`}
                      className="transition-colors hover:text-[#174EA6]"
                    >
                      {post.title}
                    </Link>
                  </h2>
                  <p
                    className="text-sm leading-relaxed mb-4"
                    style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
                  >
                    {post.description}
                  </p>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="inline-block text-xs tracking-wider uppercase transition-colors hover:text-[#174EA6] mt-auto"
                    style={{ color: '#1D5FD1', fontFamily: 'Inter, sans-serif' }}
                    aria-label={`${post.title} yazısını oku`}
                  >
                    Devamını Oku →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          /* Empty state — shown until first article is published */
          <div className="text-center py-20">
            <p
              className="text-base"
              style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
            >
              Yakında blog yazıları yayımlanacak.
            </p>
            <Link
              href="/"
              className="inline-block mt-6 text-sm tracking-wider uppercase transition-colors hover:text-[#174EA6]"
              style={{ color: '#1D5FD1', fontFamily: 'Inter, sans-serif' }}
            >
              ← Ana Sayfaya Dön
            </Link>
          </div>
        )}
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogListingSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}
