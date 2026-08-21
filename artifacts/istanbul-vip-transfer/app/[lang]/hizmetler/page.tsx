/**
 * Non-TR locale service listing page: /en/hizmetler, /de/hizmetler, etc.
 *
 * This specific route takes precedence over the [lang]/[...slug] catch-all for
 * the `hizmetler` path. It renders only services that have a PUBLISHED
 * translation in the requested locale. Services without a translation are
 * hidden from the list — no silent Turkish fallback.
 *
 * The existing design (PageHero, group cards, RTL support) is preserved.
 * Uses HizmetlerServiceGridCms (server component backed by the CMS).
 */
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import PageHero    from '@/components/PageHero';
import BookingForm from '@/components/BookingForm';
import Contact     from '@/components/Contact';
import HizmetlerServiceGridCms from '@/components/HizmetlerServiceGridCms';
import HizmetlerCategoryNav from '@/components/HizmetlerCategoryNav';
import { buildStaticAlternates }  from '@/lib/i18n/seo';
import { NON_SOURCE_LOCALES } from '@/lib/i18n/locale-registry';
import { SITE } from '@/lib/site-config';
import { getServiceCategories } from '@/lib/service-category-server';
import { localizedStaticPath } from '@/lib/localized-service-path';

// Localised page metadata for /[lang]/hizmetler
const PAGE_META: Record<string, { title: string; description: string }> = {
  en: {
    title: 'Our Services | Istanbul VIP Transfer',
    description: 'Istanbul VIP Transfer service categories: airport transfer, VIP private transfer, intercity travel and day tours. Mercedes Vito and Sprinter vehicles.',
  },
  de: {
    title: 'Unsere Dienstleistungen | Istanbul VIP Transfer',
    description: 'Istanbul VIP Transfer Dienstleistungskategorien: Flughafentransfer, VIP-Privattransfer, Intercity-Reisen und Tagestouren. Mercedes Vito und Sprinter Fahrzeuge.',
  },
  ru: {
    title: 'Наши услуги | Istanbul VIP Transfer',
    description: 'Категории услуг Istanbul VIP Transfer: трансфер в аэропорт, VIP частный трансфер, межгородские поездки и однодневные экскурсии. Автомобили Mercedes Vito и Sprinter.',
  },
  ar: {
    title: 'خدماتنا | Istanbul VIP Transfer',
    description: 'فئات خدمات Istanbul VIP Transfer: نقل المطار، النقل الخاص VIP، السفر بين المدن والجولات اليومية. سيارات مرسيدس فيتو وسبرينتر.',
  },
  fr: {
    title: 'Nos Services | Istanbul VIP Transfer',
    description: "Catégories de services Istanbul VIP Transfer : transfert aéroport, transfert privé VIP, voyages interurbains et excursions d'une journée. Véhicules Mercedes Vito et Sprinter.",
  },
  es: {
    title: 'Nuestros Servicios | Istanbul VIP Transfer',
    description: 'Categorías de servicios de Istanbul VIP Transfer: traslado al aeropuerto, traslado privado VIP, viajes interurbanos y excursiones de un día. Vehículos Mercedes Vito y Sprinter.',
  },
  it: {
    title: 'I Nostri Servizi | Istanbul VIP Transfer',
    description: 'Categorie di servizi Istanbul VIP Transfer: transfer aeroporto, transfer privato VIP, viaggi intercity e tour di un giorno. Veicoli Mercedes Vito e Sprinter.',
  },
  nl: {
    title: 'Onze Diensten | Istanbul VIP Transfer',
    description: 'Istanbul VIP Transfer-servicecategorieën: luchthaventransfer, VIP-privétransfer, intercityreizen en dagtochten. Mercedes Vito en Sprinter voertuigen.',
  },
};

interface Props {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const meta  = PAGE_META[lang] ?? PAGE_META.en;
  const alts  = await buildStaticAlternates('hizmetler');
  const url   = `${SITE.siteUrl}${localizedStaticPath('hizmetler', lang)}`;

  return {
    title:       meta.title,
    description: meta.description,
    alternates:  { canonical: url, languages: alts.languages },
    openGraph: {
      title:       meta.title,
      description: meta.description,
      url,
      siteName: 'VIP Transfer Istanbul',
      type:     'website',
      images:   [SITE.ogImage],
    },
    robots: { index: true, follow: true },
  };
}

/** Shared locale-aware services content used by the canonical localized URL. */
export async function LocalizedServicesPageContent({ lang }: { lang: string }) {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE.siteUrl}/${lang}` },
      { '@type': 'ListItem', position: 2, name: 'Services', item: `${SITE.siteUrl}${localizedStaticPath('hizmetler', lang)}` },
    ],
  };

  const categories = await getServiceCategories(lang);

  return (
    <>
      <PageHero pageKey="services" />

      <section className="py-16 md:py-20 max-w-7xl mx-auto px-5 md:px-8">
        <HizmetlerCategoryNav locale={lang} categories={categories} />
        <HizmetlerServiceGridCms locale={lang} categories={categories} />
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

export default async function HizmetlerLangPage({ params }: Props) {
  const { lang } = await params;

  // Guard: this route only serves non-TR locales.
  // TR is served at /hizmetler (app/hizmetler/page.tsx).
  if (!NON_SOURCE_LOCALES.includes(lang)) notFound();

  // This route predates locale-specific page segments and takes precedence
  // over the catch-all route. Keep it as a permanent compatibility redirect.
  permanentRedirect(localizedStaticPath('hizmetler', lang));
}
