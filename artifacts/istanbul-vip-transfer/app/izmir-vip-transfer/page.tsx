import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import { SITE } from '@/lib/site-config';

const SLUG = 'izmir-vip-transfer';
const BASE = SITE.siteUrl;
const PAGE = `${BASE}/${SLUG}`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs(SLUG);
  const alts = await buildAlternates(`/${SLUG}`, publishedLangs);
  const cmsPage = await getPublishedServicePage(SLUG, 'tr');
  return {
    title: cmsPage?.title ?? 'İzmir VIP Transfer | Adnan Menderes Havalimanı Özel Araç',
    description: cmsPage?.excerpt ?? 'İzmir Adnan Menderes Havalimanı\'ndan Çeşme, Alaçatı, Urla ve şehir merkezine Mercedes ile özel VIP transfer. 7/24, kapıdan kapıya.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'İzmir VIP Transfer | Çeşme, Alaçatı, Adnan Menderes',
      description: cmsPage?.excerpt ?? 'İzmir Adnan Menderes Havalimanı\'ndan Çeşme, Alaçatı ve şehir merkezine Mercedes araçla özel VIP transfer.',
      url: PAGE, siteName: 'VIP Transfer Istanbul', locale: 'tr_TR', type: 'website', images: [SITE.ogImage],
    },
    robots: { index: true, follow: true },
  };
}

export default function IzmirVipTransferPage() {
  return <ServicePageRenderer slug={SLUG} lang="tr" canonicalPath={`/${SLUG}`} />;
}
