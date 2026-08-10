import type { Metadata } from 'next';
import LocaleLink from '@/components/LocaleLink';
import PageHero from '@/components/PageHero';
import Services from '@/components/Services';
import VehicleFleet from '@/components/VehicleFleet';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/vip-transfer`;

export const metadata: Metadata = {
  title: 'VIP Transfer İstanbul | Vito ve Sprinter',
  description:
    'İstanbul\'da Mercedes Vito ve Sprinter araçlarla havalimanı, otel, kurumsal ve şehirler arası VIP transfer hizmeti.',
  alternates: { canonical: PAGE },
  openGraph: {
    title: 'VIP Transfer İstanbul | Vito ve Sprinter',
    description:
      'İstanbul\'da Mercedes Vito ve Sprinter araçlarla havalimanı, otel, kurumsal ve şehirler arası VIP transfer hizmeti.',
    url: PAGE,
    siteName: 'VIP Transfer Istanbul',
    locale: 'tr_TR',
    type: 'website',
    images: [SITE.ogImage],
  },
  robots: { index: true, follow: true },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: BASE },
    { '@type': 'ListItem', position: 2, name: 'VIP Transfer Hizmetleri', item: PAGE },
  ],
};

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'İstanbul VIP Transfer Hizmetleri',
  description:
    'İstanbul genelinde havalimanı, otel, kurumsal, şehir turu, özel etkinlik ve şehirler arası transferler.',
  provider: {
    '@type': 'LocalBusiness',
    name: 'VIP Transfer Istanbul',
    telephone: SITE.phoneE164,
    email: SITE.email,
  },
  areaServed: { '@type': 'City', name: 'İstanbul' },
  serviceType: 'VIP Transfer',
};

export default function VipTransferPage() {
  return (
    <>
      <PageHero pageKey="vipTransfer" />
      <Services />
      <VehicleFleet />
      <BookingForm />
      <Contact />

      {/* İlgili Blog Yazıları */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">İlgili Blog Yazıları</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <LocaleLink
              href="/blog/istanbul-havalimani-transfer-rehberi"
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-amber-400 transition-all"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-2">Rehber</p>
              <h3 className="font-semibold text-gray-900 leading-snug">
                İstanbul Havalimanı Transfer Rehberi
              </h3>
              <p className="text-sm text-gray-500 mt-2">IST&apos;ten her destinasyona →</p>
            </LocaleLink>
            <LocaleLink
              href="/blog/sabiha-gokcen-transfer-rehberi"
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-amber-400 transition-all"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-2">Rehber</p>
              <h3 className="font-semibold text-gray-900 leading-snug">
                Sabiha Gökçen Havalimanı Transfer Rehberi
              </h3>
              <p className="text-sm text-gray-500 mt-2">SAW&apos;dan her destinasyona →</p>
            </LocaleLink>
            <LocaleLink
              href="/blog/vip-transfer-ile-taksi-arasindaki-farklar"
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-amber-400 transition-all"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-2">Karşılaştırma</p>
              <h3 className="font-semibold text-gray-900 leading-snug">
                VIP Transfer ile Taksi Arasındaki Farklar
              </h3>
              <p className="text-sm text-gray-500 mt-2">Hangisi sizin için doğru seçim? →</p>
            </LocaleLink>
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
