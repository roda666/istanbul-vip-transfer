import type { Metadata } from 'next';
import PageHero from '@/components/PageHero';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';
import { SITE } from '@/lib/site-config';

/**
 * Set DRAFT = false once page content is reviewed and approved for indexing.
 * Also add the route to app/sitemap.ts at that time.
 */
const DRAFT = true;

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/soforlu-arac-kiralama`;

export const metadata: Metadata = {
  title: 'Şoförlü Araç Kiralama | İstanbul VIP Transfer',
  description:
    'İstanbul\'da şoförlü araç kiralama hizmeti. Toplantı, etkinlik veya şehir içi ulaşımınız için Mercedes Vito ve Sprinter araçlarla profesyonel şoförlü transfer.',
  alternates: { canonical: PAGE },
  robots: DRAFT ? { index: false, follow: true } : { index: true, follow: true },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: BASE },
    { '@type': 'ListItem', position: 2, name: 'Hizmetler', item: `${BASE}/hizmetler` },
    { '@type': 'ListItem', position: 3, name: 'Şoförlü Araç Kiralama', item: PAGE },
  ],
};

export default function SoforluAracKiralamaPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[
          { label: 'Ana Sayfa', href: '/' },
          { label: 'Hizmetler', href: '/hizmetler' },
          { label: 'Şoförlü Araç Kiralama' },
        ]}
        title="Şoförlü Araç Kiralama"
        subtitle="İstanbul içi toplantılar, özel etkinlikler ve günlük ulaşım ihtiyaçlarınız için profesyonel şoförlü Mercedes transfer hizmeti."
      />

      <section
        className="py-16 md:py-20 max-w-3xl mx-auto px-5 md:px-8"
        style={{ color: '#888', fontFamily: 'Inter, sans-serif' }}
      >
        <p className="text-base leading-relaxed">
          Şoförlü araç kiralama hizmetimizle İstanbul genelinde iş toplantılarınıza, özel etkinliklerinize
          ve şehir içi tüm ulaşım ihtiyaçlarınıza güvenli ve konforlu çözüm sunuyoruz. Deneyimli ve
          yol bilen profesyonel sürücülerimiz eşliğinde, Mercedes Vito veya Sprinter araçlarımızla
          vaktinizi verimli geçirebilirsiniz.
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
