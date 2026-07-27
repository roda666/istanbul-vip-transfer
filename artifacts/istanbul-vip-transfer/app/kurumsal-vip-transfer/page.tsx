import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';
import { SITE } from '@/lib/site-config';

/** Set DRAFT = false once page content is reviewed and approved for indexing. */
const DRAFT = true;

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/kurumsal-vip-transfer`;

export const metadata: Metadata = {
  title: 'Kurumsal VIP Transfer | İstanbul VIP Transfer',
  description:
    'İstanbul\'da kurumsal VIP transfer hizmeti. Şirket yöneticileri, iş misafirleri ve kurumsal etkinlikler için Mercedes araçlarla profesyonel ulaşım çözümleri.',
  alternates: { canonical: PAGE },
  robots: DRAFT ? { index: false, follow: true } : { index: true, follow: true },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: BASE },
    { '@type': 'ListItem', position: 2, name: 'Hizmetler', item: `${BASE}/hizmetler` },
    { '@type': 'ListItem', position: 3, name: 'Kurumsal VIP Transfer', item: PAGE },
  ],
};

export default function KurumsalVipTransferPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[
          { label: 'Ana Sayfa', href: '/' },
          { label: 'Hizmetler', href: '/hizmetler' },
          { label: 'Kurumsal VIP Transfer' },
        ]}
        title="Kurumsal VIP Transfer"
        subtitle="Yöneticiler, iş misafirleri ve kurumsal etkinlikler için İstanbul genelinde özel Mercedes transferi."
      />

      <section
        className="py-16 md:py-20 max-w-3xl mx-auto px-5 md:px-8"
        style={{ color: '#888', fontFamily: 'Inter, sans-serif' }}
      >
        <p className="text-base leading-relaxed">
          Şirketinizin yöneticileri ve iş misafirleriniz için profesyonel, dakik ve güvenilir kurumsal
          transfer hizmeti sunuyoruz. Uçuş takibi, karşılama tabelası ve havalimanından toplantı
          noktasına ya da otele kesintisiz ulaşım konusunda kurumsal ihtiyaçlarınıza özel çözümler
          üretiyoruz. Sürekli müşterilerimize fatura düzenleme imkânı mevcuttur.
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
