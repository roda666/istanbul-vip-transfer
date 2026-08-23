import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import { getServiceOgImageUrl } from '@/lib/service-og-images';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import { SITE } from '@/lib/site-config';

const SLUG = 'ankara-vip-transfer';
const BASE = SITE.siteUrl;
const PAGE = `${BASE}/${SLUG}`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs(SLUG);
  const alts = await buildAlternates(`/${SLUG}`, publishedLangs);
  const cmsPage = await getPublishedServicePage(SLUG, 'tr');
  return {
    title: cmsPage?.title ?? 'Ankara VIP Transfer | Esenboğa Havalimanı Özel Araç',
    description: cmsPage?.excerpt ?? 'Ankara Esenboğa Havalimanı\'ndan ve şehir içi noktalara Mercedes Vito ve Sprinter ile özel VIP transfer hizmeti. 7/24, kapıdan kapıya.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'Ankara VIP Transfer | Esenboğa Havalimanı Özel Araç',
      description: cmsPage?.excerpt ?? 'Ankara Esenboğa Havalimanı\'ndan şehir içi noktalara Mercedes ile özel VIP transfer hizmeti.',
      url: PAGE, siteName: 'VIP Transfer Istanbul', locale: 'tr_TR', type: 'website',
      images: [{ url: getServiceOgImageUrl(SLUG, SITE.siteUrl), width: 1200, height: 630 }],
    },
    robots: { index: true, follow: true },
  };
}

export default function AnkaraVipTransferPage() {
  return <ServicePageRenderer slug={SLUG} lang="tr" canonicalPath={`/${SLUG}`} />;
}
