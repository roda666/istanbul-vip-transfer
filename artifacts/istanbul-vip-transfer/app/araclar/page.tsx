import type { Metadata } from 'next';
import { SUPPORTED_LANGS } from '@/lib/i18n';
import { buildAlternates } from '@/lib/i18n/seo';
import { SITE } from '@/lib/site-config';
import VehiclesPageContent from '@/components/VehiclesPageContent';

const PAGE = `${SITE.siteUrl}/araclar`;

export async function generateMetadata(): Promise<Metadata> {
  const alts = await buildAlternates('/araclar', [...SUPPORTED_LANGS]);
  return {
    title: 'VIP Araçlarımız | Vito ve Sprinter',
    description:
      'Mercedes Vito ve Sprinter VIP araç seçeneklerimizi inceleyin; transfer ihtiyaçlarınıza ve yolcu sayınıza uygun aracı seçin.',
    alternates: { canonical: PAGE, languages: alts.languages },
    openGraph: {
      title: 'VIP Araçlarımız | Vito ve Sprinter',
      description:
        'Mercedes Vito ve Sprinter VIP araç seçeneklerimizi inceleyin; transfer ihtiyaçlarınıza ve yolcu sayınıza uygun aracı seçin.',
      url: PAGE,
      siteName: 'VIP Transfer Istanbul',
      locale: 'tr_TR',
      type: 'website',
      images: [SITE.ogImage],
    },
    robots: { index: true, follow: true },
  };
}

export default function AraclarPage() {
  return <VehiclesPageContent locale="tr" />;
}