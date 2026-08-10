import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';
import { SITE } from '@/lib/site-config';

/** Set DRAFT = false once page content is reviewed and approved for indexing. */
const DRAFT = true;

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/bursa-gunubirlik-tur`;

export const metadata: Metadata = {
  title: 'Bursa Günübirlik Tur | İstanbul\'dan VIP Transfer',
  description:
    'İstanbul\'dan Bursa\'ya özel araçla günübirlik tur. Yeşil Bursa\'yı kendi programınıza göre keşfetmek için Mercedes VIP tur transferi.',
  alternates: { canonical: PAGE },
  openGraph: {
    title: 'Bursa Günübirlik Tur | İstanbul\'dan VIP Transfer',
    description: 'İstanbul\'dan Bursa\'ya özel araçla günübirlik tur. Yeşil Bursa\'yı kendi programınıza göre keşfetmek için Mercedes VIP tur transferi.',
    url: PAGE,
    siteName: 'VIP Transfer Istanbul',
    locale: 'tr_TR',
    type: 'website',
    images: [SITE.ogImage],
  },
  robots: DRAFT ? { index: false, follow: true } : { index: true, follow: true },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: BASE },
    { '@type': 'ListItem', position: 2, name: 'Hizmetler', item: `${BASE}/hizmetler` },
    { '@type': 'ListItem', position: 3, name: 'Bursa Günübirlik Tur', item: PAGE },
  ],
};

export default function BursaGunubirlikTurPage() {
  return (
    <>
      <PageHero pageKey="bursa" />

      <section
        className="py-16 md:py-20 max-w-3xl mx-auto px-5 md:px-8"
        style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
      >
        <p className="text-base leading-relaxed">
          İstanbul&apos;dan hareketle Bursa&apos;ya özel araçla günübirlik tur düzenliyoruz. Osmanlı&apos;nın ilk
          başkenti olan Bursa&apos;yı kendi belirlediğiniz güzergahta, profesyonel sürücümüz eşliğinde
          gezebilirsiniz. Araçlar grubunuzun büyüklüğüne göre Mercedes Vito veya Sprinter olarak
          belirlenmektedir.
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
