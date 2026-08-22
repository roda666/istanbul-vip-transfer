import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import { getServiceHeroImage } from '@/lib/service-og-image';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import { SITE } from '@/lib/site-config';

const SLUG = 'antalya-vip-transfer';
const BASE = SITE.siteUrl;
const PAGE = `${BASE}/${SLUG}`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs(SLUG);
  const alts = await buildAlternates(`/${SLUG}`, publishedLangs);
  const cmsPage = await getPublishedServicePage(SLUG, 'tr');
  return {
    title: cmsPage?.title ?? 'Antalya VIP Transfer | Havalimanı Özel Araç Hizmeti',
    description: cmsPage?.excerpt ?? 'Antalya Havalimanı\'ndan Kemer, Belek, Side, Alanya ve şehir merkezine Mercedes ile VIP transfer. 7/24, kapıdan kapıya özel araç.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'Antalya VIP Transfer | Kemer, Belek, Side, Alanya',
      description: cmsPage?.excerpt ?? 'Antalya Havalimanı\'ndan tatil bölgelerine Mercedes araçla özel VIP transfer.',
      url: PAGE, siteName: 'VIP Transfer Istanbul', locale: 'tr_TR', type: 'website', images: [getServiceHeroImage(SLUG)],
    },
    robots: { index: true, follow: true },
  };
}

export default function AntalyaVipTransferPage() {
  return <ServicePageRenderer slug={SLUG} lang="tr" canonicalPath={`/${SLUG}`} />;
}
