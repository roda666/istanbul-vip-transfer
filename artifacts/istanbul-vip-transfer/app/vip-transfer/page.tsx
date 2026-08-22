import type { Metadata } from 'next';
import { buildAlternates } from '@/lib/i18n/seo';
import { getPublishedServicePage, getPublishedServicePageLangs } from '@/lib/service-page-cms';
import { getServiceHeroImage } from '@/lib/service-og-image';
import ServicePageRenderer from '@/components/ServicePageRenderer';
import LocaleLink from '@/components/LocaleLink';
import { SITE } from '@/lib/site-config';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/vip-transfer`;

export async function generateMetadata(): Promise<Metadata> {
  const publishedLangs = await getPublishedServicePageLangs('vip-transfer');
  const alts = await buildAlternates('/vip-transfer', publishedLangs);
  const cmsPage = await getPublishedServicePage('vip-transfer', 'tr');
  return {
    title: cmsPage?.title ?? 'VIP Transfer İstanbul | Vito ve Sprinter',
    description:
      cmsPage?.excerpt ?? 'İstanbul\'da Mercedes Vito ve Sprinter araçlarla havalimanı, otel, kurumsal ve şehirler arası VIP transfer hizmeti.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: cmsPage?.title ?? 'VIP Transfer İstanbul | Vito ve Sprinter',
      description: cmsPage?.excerpt ?? 'İstanbul\'da Mercedes Vito ve Sprinter araçlarla havalimanı, otel, kurumsal ve şehirler arası VIP transfer hizmeti.',
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [getServiceHeroImage('vip-transfer')],
    },
    robots: { index: true, follow: true },
  };
}

export default async function VipTransferPage() {
  return (
    <>
      <ServicePageRenderer slug="vip-transfer" lang="tr" canonicalPath="/vip-transfer" />

      {/* İlgili Blog Yazıları */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">İlgili Blog Yazıları</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <LocaleLink
              href="/blog/istanbul-havalimani-transfer-rehberi"
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-amber-400 transition-all"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-2">Rehber</p>
              <h3 className="font-semibold text-gray-900 leading-snug">
                İstanbul Havalimanı Transfer Rehberi
              </h3>
              <p className="text-sm text-gray-500 mt-2">IST&apos;ten her destinasyona →</p>
            </LocaleLink>
            <LocaleLink
              href="/blog/sabiha-gokcen-transfer-rehberi"
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-amber-400 transition-all"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-2">Rehber</p>
              <h3 className="font-semibold text-gray-900 leading-snug">
                Sabiha Gökçen Havalimanı Transfer Rehberi
              </h3>
              <p className="text-sm text-gray-500 mt-2">SAW&apos;dan her destinasyona →</p>
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
