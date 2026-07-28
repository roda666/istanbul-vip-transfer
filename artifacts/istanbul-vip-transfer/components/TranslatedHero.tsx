/**
 * Minimal hero section for non-Turkish language homepages.
 * Shows brand identity + a translated booking CTA.
 * Detailed content is managed through the translation workflow.
 */
'use client';

import Link from 'next/link';
import { useLang } from '@/lib/i18n/context';

const HERO_CONTENT: Record<string, { heading: string; sub: string; cta: string }> = {
  en: {
    heading: 'Istanbul VIP Transfer',
    sub: 'Premium airport transfers & private tours — Mercedes Vito & Sprinter, 24/7.',
    cta: 'Get a Price Quote',
  },
  de: {
    heading: 'Istanbul VIP Transfer',
    sub: 'Premium Flughafentransfers & Privattouren — Mercedes Vito & Sprinter, 24/7.',
    cta: 'Preisangebot einholen',
  },
  ru: {
    heading: 'Стамбул VIP Трансфер',
    sub: 'Премиальные трансферы из аэропорта и частные туры — Mercedes Vito & Sprinter, 24/7.',
    cta: 'Получить ценовое предложение',
  },
  ar: {
    heading: 'إسطنبول VIP ترانسفير',
    sub: 'نقل فاخر من المطار وجولات خاصة — مرسيدس فيتو وسبرينتر، 24/7.',
    cta: 'احصل على عرض سعر',
  },
};

interface Props {
  lang: string;
}

export default function TranslatedHero({ lang }: Props) {
  const { dict } = useLang();
  const content = HERO_CONTENT[lang] ?? HERO_CONTENT.en;

  return (
    <section
      className="py-24 px-5 md:px-8 text-center"
      style={{ background: 'linear-gradient(135deg, #0D2137 0%, #102A43 60%, #163550 100%)', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}
    >
      <div className="max-w-3xl mx-auto">
        <p
          className="text-xs tracking-[0.35em] uppercase mb-6"
          style={{ color: '#C99A32', fontFamily: 'Inter, sans-serif' }}
        >
          {dict.booking.sectionLabel}
        </p>
        <h1
          className="text-4xl md:text-6xl font-bold mb-6"
          style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#FFFFFF', lineHeight: 1.15 }}
        >
          {content.heading}
        </h1>
        <p
          className="text-lg mb-10 max-w-xl mx-auto"
          style={{ color: 'rgba(255,255,255,0.72)', fontFamily: 'Inter, sans-serif', lineHeight: 1.7 }}
        >
          {content.sub}
        </p>
        <Link
          href={`#rezervasyon`}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-semibold uppercase tracking-wider transition-all duration-300 hover:shadow-2xl hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C79A35]"
          style={{ background: '#C79A35', color: '#102A43', fontFamily: 'Inter, sans-serif', letterSpacing: '0.07em' }}
        >
          {content.cta}
        </Link>
      </div>
    </section>
  );
}
