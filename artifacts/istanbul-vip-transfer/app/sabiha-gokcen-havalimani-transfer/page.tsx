import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import LocaleLink from '@/components/LocaleLink';
import { SITE } from '@/lib/site-config';
import { getServiceOgImageUrl } from '@/lib/service-og-images';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/sabiha-gokcen-havalimani-transfer`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs('sabiha-gokcen-havalimani-transfer');
  const alts = await buildAlternates('/sabiha-gokcen-havalimani-transfer', publishedLangs);
  const cmsPage = await getPublishedServicePage('sabiha-gokcen-havalimani-transfer', 'tr');
  return {
    title: cmsPage?.title ?? 'Sabiha Gökçen Transfer | VIP Vito',
    description:
      cmsPage?.excerpt ?? 'Sabiha Gökçen Havalimanı transfer hizmetiyle Mercedes Vito ve Sprinter araçlarla İstanbul\'un her noktasına özel ulaşım.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'Sabiha Gökçen Transfer | VIP Vito',
      description: cmsPage?.excerpt ?? 'Sabiha Gökçen Havalimanı transfer hizmetiyle Mercedes Vito ve Sprinter araçlarla İstanbul\'un her noktasına özel ulaşım.',
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [{ url: getServiceOgImageUrl('sabiha-gokcen-havalimani-transfer', SITE.siteUrl), width: 1200, height: 630 }],
    },
    robots: { index: true, follow: true },
  };
}

export default async function SabihaGokcenPage() {
  return (
    <>
      <ServicePageRenderer slug="sabiha-gokcen-havalimani-transfer" lang="tr" canonicalPath="/sabiha-gokcen-havalimani-transfer" />

      {/* İlgili Blog Yazıları */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">İlgili Blog Yazıları</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <LocaleLink
              href="/blog/sabiha-gokcen-transfer-rehberi"
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-amber-400 transition-all"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-2">Rehber</p>
              <h3 className="font-semibold text-gray-900 leading-snug">
                Sabiha Gökçen Havalimanı Transfer Rehberi
              </h3>
              <p className="text-sm text-gray-500 mt-2">Tarife, araç tipleri ve ipuçları →</p>
            </LocaleLink>
            <LocaleLink
              href="/blog/vip-transfer-ile-taksi-arasindaki-farklar"
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-amber-400 transition-all"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-2">Karşılaştırma</p>
              <h3 className="font-semibold text-gray-900 leading-snug">
                VIP Transfer ile Taksi Arasındaki Farklar
              </h3>
              <p className="text-sm text-gray-500 mt-2">Hangisi sizin için doğru seçim? →</p>
            </LocaleLink>
          </div>
        </div>
      </section>
    </>
  );
}
