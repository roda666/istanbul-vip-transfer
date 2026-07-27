import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';
import { SITE } from '@/lib/site-config';

/** Set DRAFT = false once page content is reviewed and approved for indexing. */
const DRAFT = true;

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/saglik-turizmi-transfer`;

export const metadata: Metadata = {
  title: 'Sağlık Turizmi Transferi | İstanbul VIP Transfer',
  description:
    'İstanbul\'da hastane, klinik ve sağlık merkezleri için özel VIP transfer hizmeti. Konforlu ve güvenli araçlarla sağlık turizmi ulaşım desteği.',
  alternates: { canonical: PAGE },
  robots: DRAFT ? { index: false, follow: true } : { index: true, follow: true },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: BASE },
    { '@type': 'ListItem', position: 2, name: 'Hizmetler', item: `${BASE}/hizmetler` },
    { '@type': 'ListItem', position: 3, name: 'Sağlık Turizmi Transferi', item: PAGE },
  ],
};

export default function SaglikTurizmiTransferPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[
          { label: 'Ana Sayfa', href: '/' },
          { label: 'Hizmetler', href: '/hizmetler' },
          { label: 'Sağlık Turizmi Transferi' },
        ]}
        title="Sağlık Turizmi Transferi"
        subtitle="Hastane, klinik ve sağlık merkezi transferleriniz için özel, konforlu ve güvenilir araç hizmeti."
      />

      <section
        className="py-16 md:py-20 max-w-3xl mx-auto px-5 md:px-8"
        style={{ color: '#888', fontFamily: 'Inter, sans-serif' }}
      >
        <p className="text-base leading-relaxed">
          Sağlık turizmi kapsamında İstanbul&apos;a gelen misafirlerimiz için havalimanından hastaneye,
          hastaneden konaklamasına ve şehir içindeki tüm sağlık randevularına güvenli ve konforlu
          ulaşım sağlıyoruz. Özel araçlarımız temizlik standartlarına uygun olarak hazırlanmakta;
          sürücülerimiz sabır ve özenle hizmet vermektedir.
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
