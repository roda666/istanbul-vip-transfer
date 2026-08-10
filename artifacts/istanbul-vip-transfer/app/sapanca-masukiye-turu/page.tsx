import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';
import { SITE } from '@/lib/site-config';

/** Set DRAFT = false once page content is reviewed and approved for indexing. */
const DRAFT = true;

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/sapanca-masukiye-turu`;

export const metadata: Metadata = {
  title: 'Sapanca–Maşukiye Günübirlik Turu | VIP Transfer',
  description:
    'İstanbul\'dan Sapanca Gölü ve Maşukiye\'ye özel araçla günübirlik tur. Doğa içinde konforlu bir gün geçirmek için Mercedes ile VIP tur hizmeti.',
  alternates: { canonical: PAGE },
  openGraph: {
    title: 'Sapanca–Maşukiye Günübirlik Turu | VIP Transfer',
    description: 'İstanbul\'dan Sapanca Gölü ve Maşukiye\'ye özel araçla günübirlik tur. Doğa içinde konforlu bir gün geçirmek için Mercedes ile VIP tur hizmeti.',
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
    { '@type': 'ListItem', position: 3, name: 'Sapanca–Maşukiye Turu', item: PAGE },
  ],
};

export default function SapancaMasukiyeTuruPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[
          { label: 'Ana Sayfa', href: '/' },
          { label: 'Hizmetler', href: '/hizmetler' },
          { label: 'Sapanca–Maşukiye Turu' },
        ]}
        title="Sapanca–Maşukiye Günübirlik Turu"
        subtitle="İstanbul'dan Sapanca Gölü ve Maşukiye ormanlarına özel araçla rahat ve güvenli günübirlik tur."
      />

      <section
        className="py-16 md:py-20 max-w-3xl mx-auto px-5 md:px-8"
        style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
      >
        <p className="text-base leading-relaxed">
          Sapanca Gölü kıyıları ve Maşukiye orman köyü, İstanbul&apos;dan ulaşılabilecek en popüler
          doğa rotaları arasında yer almaktadır. Özel araç hizmetimizle kapınızdan alınarak Sapanca
          ve Maşukiye&apos;yi kendi temponuzda gezebilir, günün sonunda evinize konforla dönebilirsiniz.
          Araçlar yolcu sayısına göre seçilmekte olup tüm güzergah boyunca sürücünüz hizmetinizdedir.
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
