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
const PAGE = `${BASE}/istanbul-gunubirlik-turlar`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs('istanbul-gunubirlik-turlar');
  const alts = await buildAlternates('/istanbul-gunubirlik-turlar', publishedLangs);
  const cmsPage = await getPublishedServicePage('istanbul-gunubirlik-turlar', 'tr');
  return {
    title: cmsPage?.title ?? 'İstanbul Günübirlik Turlar | VIP Özel Tur Aracı',
    description:
      cmsPage?.excerpt ?? 'İstanbul\'un tarihi ve kültürel mekânlarını özel araçla günübirlik keşfedin. Mercedes Vito ve Sprinter ile kişiye özel şehir turu hizmeti.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'İstanbul Günübirlik Turlar | VIP Özel Tur Aracı',
      description: cmsPage?.excerpt ?? 'İstanbul\'un tarihi ve kültürel mekânlarını özel araçla günübirlik keşfedin. Mercedes Vito ve Sprinter ile kişiye özel şehir turu hizmeti.',
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
    { '@type': 'ListItem', position: 3, name: 'İstanbul Günübirlik Turlar', item: PAGE },
  ],
};

export default function IstanbulGunubirlikTurlarPage() {
  return (
    <>
      <TrServicePageHero slug="istanbul-gunubirlik-turlar" pageKey="istGunubirlik" />

      <section
        className="py-16 md:py-20 max-w-3xl mx-auto px-5 md:px-8"
        style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
      >
        <p className="text-base leading-relaxed">
          İstanbul günübirlik tur hizmetimizle şehrin tarihi yarımadasından Boğaz kıyılarına,
          çarşılarından müzelerine kadar istediğiniz rotayı özel araçla gezebilirsiniz. Sabit
          bir tur programı yerine sizin tercihlerinize göre şekillenen esnek bir güzergah sunuyoruz.
          Sürücümüz gün boyunca yanınızda kalarak ulaşım konusundaki tüm ihtiyaçlarınızı karşılar.
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
