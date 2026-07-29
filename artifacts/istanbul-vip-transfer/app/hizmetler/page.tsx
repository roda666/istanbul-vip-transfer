import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';
import HizmetlerServiceGrid from '@/components/HizmetlerServiceGrid';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/hizmetler`;

export const metadata: Metadata = {
  title: 'Hizmetlerimiz | İstanbul VIP Transfer',
  description:
    'İstanbul VIP Transfer hizmet kategorileri: havalimanı transferi, VIP özel transfer, şehirler arası ulaşım ve günübirlik turlar. Mercedes Vito ve Sprinter araçlar.',
  alternates: { canonical: PAGE },
  openGraph: {
    title: 'Hizmetlerimiz | İstanbul VIP Transfer',
    description:
      'İstanbul VIP Transfer hizmet kategorileri: havalimanı transferi, VIP özel transfer, şehirler arası ulaşım ve günübirlik turlar.',
    url: PAGE,
    siteName: 'VIP Transfer Istanbul',
    locale: 'tr_TR',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: BASE },
    { '@type': 'ListItem', position: 2, name: 'Hizmetler', item: PAGE },
  ],
};

// Pull the Hizmetler groups from the single nav-config source
export default function HizmetlerPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[{ label: 'Ana Sayfa', href: '/' }, { label: 'Hizmetler' }]}
        title="Hizmetlerimiz"
        subtitle="İstanbul ve çevresinde Mercedes Vito ve Sprinter araçlarla sunduğumuz tüm transfer ve tur hizmetleri."
      />

      <section className="py-16 md:py-20 max-w-7xl mx-auto px-5 md:px-8">
        <HizmetlerServiceGrid />
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
