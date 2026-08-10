import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import TrServicePageHero from '@/components/TrServicePageHero';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';
import { SITE } from '@/lib/site-config';

/** Set DRAFT = false once page content is reviewed and approved for indexing. */
const DRAFT = true;

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/istanbul-bursa-transfer`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs('istanbul-bursa-transfer');
  const alts = await buildAlternates('/istanbul-bursa-transfer', publishedLangs);
  const cmsPage = await getPublishedServicePage('istanbul-bursa-transfer', 'tr');
  return {
    title: cmsPage?.title ?? 'İstanbul–Bursa Transfer | VIP Özel Araç',
    description:
      cmsPage?.excerpt ?? 'İstanbul\'dan Bursa\'ya veya Bursa\'dan İstanbul\'a Mercedes Vito ve Sprinter ile özel VIP transfer hizmeti. Kapıdan kapıya konforlu şehirler arası ulaşım.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'İstanbul–Bursa Transfer | VIP Özel Araç',
      description: cmsPage?.excerpt ?? 'İstanbul\'dan Bursa\'ya veya Bursa\'dan İstanbul\'a Mercedes Vito ve Sprinter ile özel VIP transfer hizmeti. Kapıdan kapıya konforlu şehirler arası ulaşım.',
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
    { '@type': 'ListItem', position: 3, name: 'İstanbul–Bursa Transfer', item: PAGE },
  ],
};

export default function IstanbulBursaTransferPage() {
  return (
    <>
      <TrServicePageHero slug="istanbul-bursa-transfer" pageKey="istBursa" />

      <section
        className="py-16 md:py-20 max-w-3xl mx-auto px-5 md:px-8"
        style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
      >
        <p className="text-base leading-relaxed">
          İstanbul ile Bursa arasında özel araç transferi hizmetimizle konforlu ve güvenli bir yolculuk
          yapabilirsiniz. Kapıdan kapıya hizmetimiz sayesinde terminal veya durak beklemeden, kendi
          programınıza göre yola çıkabilirsiniz. Yolcu sayısına göre Mercedes Vito veya Sprinter
          araçlarımızdan uygun olanı seçilir.
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
