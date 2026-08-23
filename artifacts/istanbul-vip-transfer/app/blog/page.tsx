import type { Metadata } from 'next';
import { SUPPORTED_LANGS } from '@/lib/i18n';
import { buildAlternates } from '@/lib/i18n/seo';
import Link from 'next/link';
import PageHero from '@/components/PageHero';
import { getPublishedBlogPosts } from '@/lib/blog-cms';
import { getBlogPost } from '@/lib/blog-data';
import SafeArticleImage from '@/components/SafeArticleImage';
import { SITE } from '@/lib/site-config';
import { getContactSettings } from '@/lib/site-settings-server';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/blog`;

// blogListingSchema is built inside BlogPage() so contact fields come from DB.

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: BASE },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: PAGE },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const alts = await buildAlternates('/blog', [...SUPPORTED_LANGS]);
  return {
    title: 'Blog | İstanbul VIP Transfer Rehberleri',
    description: 'İstanbul havalimanı transferi, VIP ulaşım, araç seçimi ve rezervasyon süreçleri hakkında faydalı rehberleri inceleyin.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: 'Blog | İstanbul VIP Transfer Rehberleri',
      description: 'İstanbul havalimanı transferi, VIP ulaşım, araç seçimi ve rezervasyon süreçleri hakkında faydalı rehberleri inceleyin.',
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [SITE.ogImage],
    },
    robots: { index: true, follow: true },
  };
}

export default async function BlogPage() {
  const [posts, cs] = await Promise.all([getPublishedBlogPosts(), getContactSettings()]);
  const listingPosts = posts.map((post) => {
    const sourcePost = getBlogPost(post.slug);
    const thumbnailSrc = post.heroImage?.trim() || sourcePost?.image;
    const thumbnailAlt = post.heroImageAlt?.trim() || sourcePost?.imageAlt || post.title;

    return { ...post, thumbnailSrc, thumbnailAlt };
  });

  const blogListingSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Blog | İstanbul VIP Transfer Rehberleri',
    description: 'İstanbul havalimanı transferi, VIP ulaşım, araç seçimi ve rezervasyon süreçleri hakkında faydalı rehberler.',
    url: PAGE,
    inLanguage: 'tr',
    publisher: {
      '@type': 'Organization',
      name: 'VIP Transfer Istanbul',
      url: BASE,
      telephone: cs.phoneE164,
      email: cs.email,
    },
  };

  return (
    <>
      <PageHero
        breadcrumbs={[{ label: 'Ana Sayfa', href: '/' }, { label: 'Blog' }]}
        title="Transfer Rehberleri"
        subtitle="Havalimanı transferi, araç seçimi ve İstanbul ulaşımı hakkında faydalı bilgiler."
      />

      <section className="py-16 md:py-20 max-w-7xl mx-auto px-5 md:px-8">
        {listingPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {listingPosts.map((post) => (
              <article
                key={post.slug}
                className="rounded-sm overflow-hidden group flex flex-col"
                style={{ background: '#FFFFFF', border: '1px solid #D9E2EC' }}
              >
                {post.thumbnailSrc && (
                  <div className="aspect-video overflow-hidden flex-shrink-0">
                    <SafeArticleImage
                      src={post.thumbnailSrc}
                      alt={post.thumbnailAlt}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                )}
                <div className="p-6 flex flex-col flex-1">
                  <p className="text-[10px] tracking-[0.18em] uppercase mb-3" style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>
                    {post.category && <span>{post.category} &middot; </span>}
                    {post.readTimeMinutes && <span>{post.readTimeMinutes} dk okuma &middot; </span>}
                    {post.publishedAt && (
                      <time dateTime={post.publishedAt.toISOString()}>
                        {post.publishedAt.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </time>
                    )}
                  </p>
                  <h2
                    className="text-lg font-bold mb-3 leading-snug flex-1"
                    style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}
                  >
                    <Link href={`/blog/${post.slug}`} className="transition-colors hover:text-[#174EA6]">
                      {post.title}
                    </Link>
                  </h2>
                  {post.excerpt && (
                    <p className="text-sm leading-relaxed mb-4" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
                      {post.excerpt}
                    </p>
                  )}
                  {post.author && (
                    <p className="text-xs mb-3" style={{ color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>
                      {post.author}
                    </p>
                  )}
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
          <div className="text-center py-20">
            <p className="text-base" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
              Yakında blog yazıları yayımlanacak.
            </p>
            <Link href="/" className="inline-block mt-6 text-sm tracking-wider uppercase transition-colors hover:text-[#174EA6]" style={{ color: '#1D5FD1', fontFamily: 'Inter, sans-serif' }}>
              ← Ana Sayfaya Dön
            </Link>
          </div>
        )}
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogListingSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
    </>
  );
}
