import type { Metadata } from 'next';
import { NON_SOURCE_LOCALES } from '@/lib/i18n/locale-registry';
import { buildAlternates } from '@/lib/i18n/seo';
import PageHero from '@/components/PageHero';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';
import HizmetlerServiceGridCms from '@/components/HizmetlerServiceGridCms';
import HizmetlerCategoryNav from '@/components/HizmetlerCategoryNav';
import { SITE } from '@/lib/site-config';
import { getPublicServiceCatalog } from '@/lib/public-service-catalog';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/hizmetler`;

export async function generateMetadata(): Promise<Metadata> {
  const alts = await buildAlternates('/hizmetler', NON_SOURCE_LOCALES as string[]);
  return {
    title: 'Hizmetlerimiz | İstanbul VIP Transfer',
    description:
      'İstanbul VIP Transfer hizmet kategorileri: havalimanı transferi, VIP özel transfer, şehirler arası ulaşım ve günübirlik turlar. Mercedes Vito ve Sprinter araçlar.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: 'Hizmetlerimiz | İstanbul VIP Transfer',
      description:
        'İstanbul VIP Transfer hizmet kategorileri: havalimanı transferi, VIP özel transfer, şehirler arası ulaşım ve günübirlik turlar.',
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [SITE.ogImage],
    },
    robots: { index: true, follow: true },
  };
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: BASE },
    { '@type': 'ListItem', position: 2, name: 'Hizmetler', item: PAGE },
  ],
};

/**
 * Turkish service listing page — CMS-backed.
 * Renders published SERVICE content rows from the database.
 * The locale-prefixed variants (/en/hizmetler etc.) are handled by
 * app/[lang]/hizmetler/page.tsx (specific route, overrides catch-all).
 */
export default async function HizmetlerPage() {
  const catalog = await getPublicServiceCatalog('tr');

  return (
    <>
      <PageHero pageKey="services" />

      <section className="py-16 md:py-20 max-w-7xl mx-auto px-5 md:px-8">
        <HizmetlerCategoryNav locale="tr" categories={catalog.categories} />
        <HizmetlerServiceGridCms locale="tr" categories={catalog.categories} services={catalog.services} />
      </section>

      <BookingForm />
      <Contact />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}
