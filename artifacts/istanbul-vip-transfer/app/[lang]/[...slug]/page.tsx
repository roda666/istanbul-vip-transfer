/**
 * Locale-prefixed passthrough for Turkish content pages.
 *
 * Handles routes like /en/hizmetler, /de/istanbul-havalimani-transfer, etc.
 * The parent [lang]/layout.tsx already wraps children in <LangProvider forceLang={lang}>,
 * and PublicLayoutWrapper's outer LangProvider detects the lang from the URL pathname.
 * This means Header, Footer, and all client components automatically render in the
 * correct language even though the page content is Turkish.
 *
 * SEO: these locale-prefixed paths are not indexed (noindex). The canonical Turkish
 * URL (e.g. /hizmetler) remains the indexed version.
 *
 * NOTE: The param is named `slug` to match app/[lang]/blog/[slug]/page.tsx.
 * Next.js requires overlapping catch-all and named dynamic segments use the same name.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isValidLang } from '@/lib/i18n';

// ── Turkish page components ─────────────────────────────────────────────────
import HizmetlerPage          from '@/app/hizmetler/page';
import AraclarPage            from '@/app/araclar/page';
import HakkimizdaPage         from '@/app/hakkimizda/page';
import IletisimPage           from '@/app/iletisim/page';
import IstHavaPage            from '@/app/istanbul-havalimani-transfer/page';
import SabihaPage             from '@/app/sabiha-gokcen-havalimani-transfer/page';
import VipTransferPage        from '@/app/vip-transfer/page';
import SehirlerArasiPage      from '@/app/sehirler-arasi-transfer/page';
import SoforluPage            from '@/app/soforlu-arac-kiralama/page';
import OtelPage               from '@/app/otel-transfer/page';
import SaglikPage             from '@/app/saglik-turizmi-transfer/page';
import KurumPage              from '@/app/kurumsal-vip-transfer/page';
import IstBursaPage           from '@/app/istanbul-bursa-transfer/page';
import IstSapancaPage         from '@/app/istanbul-sapanca-transfer/page';
import IstGunubirlikPage      from '@/app/istanbul-gunubirlik-turlar/page';
import SapancaPage            from '@/app/sapanca-masukiye-turu/page';
import BursaPage              from '@/app/bursa-gunubirlik-tur/page';
import YalovaPage             from '@/app/yalova-gunubirlik-tur/page';

// ── Route map ───────────────────────────────────────────────────────────────
const PAGE_MAP: Record<string, React.ComponentType> = {
  'hizmetler':                         HizmetlerPage,
  'araclar':                           AraclarPage,
  'hakkimizda':                        HakkimizdaPage,
  'iletisim':                          IletisimPage,
  'istanbul-havalimani-transfer':      IstHavaPage,
  'sabiha-gokcen-havalimani-transfer': SabihaPage,
  'vip-transfer':                      VipTransferPage,
  'sehirler-arasi-transfer':           SehirlerArasiPage,
  'soforlu-arac-kiralama':             SoforluPage,
  'otel-transfer':                     OtelPage,
  'saglik-turizmi-transfer':           SaglikPage,
  'kurumsal-vip-transfer':             KurumPage,
  'istanbul-bursa-transfer':           IstBursaPage,
  'istanbul-sapanca-transfer':         IstSapancaPage,
  'istanbul-gunubirlik-turlar':        IstGunubirlikPage,
  'sapanca-masukiye-turu':             SapancaPage,
  'bursa-gunubirlik-tur':              BursaPage,
  'yalova-gunubirlik-tur':             YalovaPage,
};

interface Props {
  params: Promise<{ lang: string; slug: string[] }>;
}

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function LocalizedPassthrough({ params }: Props) {
  const { lang, slug } = await params;

  if (!isValidLang(lang)) notFound();

  const pathKey = slug.join('/');
  const Page = PAGE_MAP[pathKey];

  if (!Page) notFound();

  return <Page />;
}
