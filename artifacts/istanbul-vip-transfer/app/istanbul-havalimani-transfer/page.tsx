import type { Metadata } from 'next';
import Link from 'next/link';
import PageHero from '@/components/PageHero';
import BookingForm from '@/components/BookingForm';
import VehicleFleet from '@/components/VehicleFleet';
import Contact from '@/components/Contact';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/istanbul-havalimani-transfer`;

export const metadata: Metadata = {
  title: 'İstanbul Havalimanı Transfer | VIP Vito',
  description:
    'İstanbul Havalimanı transfer hizmetiyle Mercedes Vito ve Sprinter araçlarla otel, ev ve istediğiniz adrese özel ulaşım.',
  alternates: { canonical: PAGE },
  openGraph: {
    title: 'İstanbul Havalimanı Transfer | VIP Vito',
    description:
      'İstanbul Havalimanı transfer hizmetiyle Mercedes Vito ve Sprinter araçlarla otel, ev ve istediğiniz adrese özel ulaşım.',
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
    { '@type': 'ListItem', position: 2, name: 'İstanbul Havalimanı Transfer', item: PAGE },
  ],
};

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'İstanbul Havalimanı (IST) VIP Transfer',
  description:
    'İstanbul Havalimanı\'ndan şehir merkezine ve tüm destinasyonlara Mercedes VIP araçlarla karşılama ve transfer hizmeti.',
  provider: {
    '@type': 'LocalBusiness',
    name: 'VIP Transfer Istanbul',
    telephone: SITE.phoneE164,
    email: SITE.email,
  },
  areaServed: { '@type': 'City', name: 'İstanbul' },
  serviceType: 'Airport Transfer',
};

export default function IstanbulHavalimaniPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[
          { label: 'Ana Sayfa', href: '/' },
          { label: 'İstanbul Havalimanı Transfer' },
        ]}
        title="İstanbul Havalimanı (IST) VIP Transfer"
        subtitle="İstanbul Havalimanı'ndan her destinasyona Mercedes Vito ve Sprinter VIP ile profesyonel karşılama ve transfer hizmeti."
      />
      <BookingForm />
      <VehicleFleet />
      <Contact />

      {/* İlgili Blog Yazıları */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">İlgili Blog Yazıları</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/blog/istanbul-havalimani-transfer-rehberi"
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-amber-400 transition-all"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-2">Rehber</p>
              <h3 className="font-semibold text-gray-900 leading-snug">
                İstanbul Havalimanı Transfer Rehberi
              </h3>
              <p className="text-sm text-gray-500 mt-2">Tarife, araç tipleri ve ipuçları →</p>
            </Link>
            <Link
              href="/blog/vip-transfer-ile-taksi-arasindaki-farklar"
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-amber-400 transition-all"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-2">Karşılaştırma</p>
              <h3 className="font-semibold text-gray-900 leading-snug">
                VIP Transfer ile Taksi Arasındaki Farklar
              </h3>
              <p className="text-sm text-gray-500 mt-2">Hangisi sizin için doğru seçim? →</p>
            </Link>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
    </>
  );
}
