/**
 * Translated homepage for /en, /de, /ru, /ar
 *
 * Renders the full public homepage with all sections.
 * Every shared component reads the active locale via useLang().
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isValidLang } from '@/lib/i18n';
import { buildAlternates, getOgLocale } from '@/lib/i18n/seo';
import BookingForm from '@/components/BookingForm';
import Hero from '@/components/Hero';
import VehicleFleet from '@/components/VehicleFleet';
import Services from '@/components/Services';
import TrustSignals from '@/components/TrustSignals';
import Reviews from '@/components/Reviews';
import FAQ from '@/components/FAQ';
import Contact from '@/components/Contact';

interface Props {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isValidLang(lang)) return {};

  const alternates = buildAlternates('/', [lang]);

  const titles: Record<string, string> = {
    en: 'Istanbul VIP Transfer | Luxury Airport & City Transfers',
    de: 'Istanbul VIP Transfer | Luxus Flughafen & Stadttransfers',
    ru: 'Стамбул VIP Трансфер | Трансфер из аэропорта и по городу',
    ar: 'إسطنبول VIP ترانسفير | نقل فاخر من المطار والمدينة',
  };

  const descriptions: Record<string, string> = {
    en: 'Premium airport transfers, intercity transport and private tours in Istanbul with luxury Mercedes Vito & Sprinter. 24/7 service.',
    de: 'Premiumtransfers vom Flughafen, Stadtfahrten und Privattouren in Istanbul mit luxuriösen Mercedes Vito & Sprinter. 24/7 Service.',
    ru: 'Премиальные трансферы из аэропорта, городские перевозки и частные туры в Стамбуле на люксовых Mercedes Vito и Sprinter. Работаем 24/7.',
    ar: 'خدمة نقل فاخرة من المطار والمدينة وجولات خاصة في إسطنبول بسيارات مرسيدس فيتو وسبرينتر. خدمة 24/7.',
  };

  return {
    title: titles[lang] ?? titles.en,
    description: descriptions[lang] ?? descriptions.en,
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
    openGraph: {
      locale: getOgLocale(lang),
    },
    robots: { index: true, follow: true },
  };
}

export default async function TranslatedHomePage({ params }: Props) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();

  return (
    <>
      <Hero />
      <BookingForm />
      <VehicleFleet />
      <Services />
      <TrustSignals />
      <Reviews />
      <FAQ />
      <Contact />
    </>
  );
}
