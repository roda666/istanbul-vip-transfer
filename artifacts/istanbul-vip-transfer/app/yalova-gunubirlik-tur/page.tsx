import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';
import { SITE } from '@/lib/site-config';

/** Set DRAFT = false once page content is reviewed and approved for indexing. */
const DRAFT = true;

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/yalova-gunubirlik-tur`;

export const metadata: Metadata = {
  title: 'Yalova Günübirlik Tur | İstanbul\'dan VIP Transfer',
  description:
    'İstanbul\'dan Yalova\'ya özel araçla günübirlik tur. Termal tatil bölgelerini ve doğal güzellikleri keşfetmek için Mercedes VIP tur transferi.',
  alternates: { canonical: PAGE },
  openGraph: {
    title: 'Yalova Günübirlik Tur | İstanbul\'dan VIP Transfer',
    description: 'İstanbul\'dan Yalova\'ya özel araçla günübirlik tur. Termal tatil bölgelerini ve doğal güzellikleri keşfetmek için Mercedes VIP tur transferi.',
    url: PAGE,
    siteName: 'VIP Transfer Istanbul',
    locale: 'tr_TR',
    type: 'website',
  },
  robots: DRAFT ? { index: false, follow: true } : { index: true, follow: true },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: BASE },
    { '@type': 'ListItem', position: 2, name: 'Hizmetler', item: `${BASE}/hizmetler` },
    { '@type': 'ListItem', position: 3, name: 'Yalova Günübirlik Tur', item: PAGE },
  ],
};

export default function YalovaGunubirlikTurPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[
          { label: 'Ana Sayfa', href: '/' },
          { label: 'Hizmetler', href: '/hizmetler' },
          { label: 'Yalova Günübirlik Tur' },
        ]}
        title="Yalova Günübirlik Tur"
        subtitle="İstanbul'dan Yalova'ya özel araçla konforlu günübirlik tur hizmeti."
      />

      <section
        className="py-16 md:py-20 max-w-3xl mx-auto px-5 md:px-8"
        style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
      >
        <p className="text-base leading-relaxed">
          Yalova, termal kaynakları ve yeşil doğasıyla İstanbul&apos;a yakın popüler bir tatil destinasyonudur.
          Özel araç hizmetimizle kapınızdan alınarak Yalova&apos;ya güvenli ve konforlu biçimde ulaşabilir,
          günü kendi programınıza göre geçirdikten sonra evinize dönebilirsiniz. Araç seçimi yolcu
          sayısına göre yapılmaktadır.
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
