import type { Metadata } from 'next';
import Link from 'next/link';
import PageHero from '@/components/PageHero';
import { blogPosts, BLOG_LIVE } from '@/lib/blog-data';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/blog`;

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
                style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.12)' }}
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
                    style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#E5E5E5' }}
                  >
                    <Link
                      href={`/blog/${post.slug}`}
                      className="transition-colors hover:text-[#C9A84C]"
                    >
                      {post.title}
                    </Link>
                  </h2>
                  <p
                    className="text-sm leading-relaxed mb-4"
                    style={{ color: '#777', fontFamily: 'Inter, sans-serif' }}
                  >
                    {post.description}
                  </p>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="inline-block text-xs tracking-wider uppercase transition-colors hover:text-[#E5C36A] mt-auto"
                    style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
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
              style={{ color: '#555', fontFamily: 'Inter, sans-serif' }}
            >
              Yakında blog yazıları yayımlanacak.
            </p>
            <Link
              href="/"
              className="inline-block mt-6 text-sm tracking-wider uppercase transition-colors hover:text-[#E5C36A]"
              style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
            >
              ← Ana Sayfaya Dön
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
