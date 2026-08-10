import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePageLangs } from '@/lib/service-page-cms';
import TrServicePageHero from '@/components/TrServicePageHero';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';
import { SITE } from '@/lib/site-config';

/** Set DRAFT = false once page content is reviewed and approved for indexing. */
const DRAFT = true;

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/istanbul-sapanca-transfer`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs('istanbul-sapanca-transfer');
  const alts = await buildAlternates('/istanbul-sapanca-transfer', publishedLangs);
  return {
    title: 'İstanbul–Sapanca Transfer | VIP Özel Araç',
    description:
      'İstanbul\'dan Sapanca\'ya veya Sapanca\'dan İstanbul\'a Mercedes Vito ve Sprinter ile özel VIP transfer hizmeti. Kapıdan kapıya konforlu şehirler arası ulaşım.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: 'İstanbul–Sapanca Transfer | VIP Özel Araç',
      description: 'İstanbul\'dan Sapanca\'ya veya Sapanca\'dan İstanbul\'a Mercedes Vito ve Sprinter ile özel VIP transfer hizmeti. Kapıdan kapıya konforlu şehirler arası ulaşım.',
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [SITE.ogImage],
    },
    robots: DRAFT ? { index: false, follow: true } : { index: true, follow: true },
  };
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: BASE },
    { '@type': 'ListItem', position: 2, name: 'Hizmetler', item: `${BASE}/hizmetler` },
    { '@type': 'ListItem', position: 3, name: 'İstanbul–Sapanca Transfer', item: PAGE },
  ],
};

export default function IstanbulSapancaTransferPage() {
  return (
    <>
      <TrServicePageHero slug="istanbul-sapanca-transfer" pageKey="istSapanca" />

      <section
        className="py-16 md:py-20 max-w-3xl mx-auto px-5 md:px-8"
        style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
      >
        <p className="text-base leading-relaxed">
          İstanbul ile Sapanca arasında özel araç transferi hizmetimizle doğanın içinde konforlu bir
          yolculuk deneyimi yaşayabilirsiniz. Hafta sonu kaçamakları, tatil ya da iş seyahati fark
          etmeksizin kapıdan kapıya güvenli ulaşım sağlıyoruz. Mercedes Vito veya Sprinter araçlarımız
          yolcu sayısına göre ayarlanır.
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
