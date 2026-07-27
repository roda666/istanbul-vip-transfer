import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';
import { SITE } from '@/lib/site-config';

/** Set DRAFT = false once page content is reviewed and approved for indexing. */
const DRAFT = true;

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/otel-transfer`;

export const metadata: Metadata = {
  title: 'Otel Transferi | İstanbul VIP Transfer',
  description:
    'İstanbul otellerinden ve otellere Mercedes Vito ve Sprinter araçlarla VIP otel transfer hizmeti. Havalimanı, terminal ve şehir içi otel transferleri.',
  alternates: { canonical: PAGE },
  robots: DRAFT ? { index: false, follow: true } : { index: true, follow: true },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: BASE },
    { '@type': 'ListItem', position: 2, name: 'Hizmetler', item: `${BASE}/hizmetler` },
    { '@type': 'ListItem', position: 3, name: 'Otel Transferi', item: PAGE },
  ],
};

export default function OtelTransferPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[
          { label: 'Ana Sayfa', href: '/' },
          { label: 'Hizmetler', href: '/hizmetler' },
          { label: 'Otel Transferi' },
        ]}
        title="Otel Transferi"
        subtitle="İstanbul'daki otelinize veya otelinizden istediğiniz noktaya Mercedes araçlarla özel VIP transfer hizmeti."
      />

      <section
        className="py-16 md:py-20 max-w-3xl mx-auto px-5 md:px-8"
        style={{ color: '#888', fontFamily: 'Inter, sans-serif' }}
      >
        <p className="text-base leading-relaxed">
          Havalimanından otelinize, otelinizden havalimanına ya da şehir içindeki herhangi bir noktaya
          özel araç ile konforlu ve güvenli ulaşım sağlıyoruz. Bagaj yardımı ve karşılama hizmetiyle
          seyahatinizin her adımında yanınızdayız.
        </p>
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
