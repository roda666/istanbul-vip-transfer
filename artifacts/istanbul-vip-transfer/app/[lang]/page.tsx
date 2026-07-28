/**
 * Translated homepage for /en, /de, /ru, /ar
 *
 * Shows the full public homepage with:
 * - UI labels in the target language (via LangProvider → useLang())
 * - Published DB translations for content sections (if any)
 * - Falls back to the Turkish content structure for untranslated sections
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isValidLang } from '@/lib/i18n';
import { buildAlternates, getOgLocale } from '@/lib/i18n/seo';
import BookingForm from '@/components/BookingForm';
import TranslatedHero from '@/components/TranslatedHero';

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
      <TranslatedHero lang={lang} />
      <BookingForm />
    </>
  );
}
