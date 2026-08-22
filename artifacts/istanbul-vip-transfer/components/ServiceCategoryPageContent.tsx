import 'server-only';

import Link from 'next/link';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';
import HizmetlerServiceGridCms from '@/components/HizmetlerServiceGridCms';
import type { ServiceCategoryItem } from '@/lib/service-category-server';
import { RTL_LOCALES } from '@/lib/i18n/locale-registry';
import { localizedServiceCategoryPath, localizedStaticPath } from '@/lib/localized-service-path';
import { SITE } from '@/lib/site-config';

type CategoryPageCopy = {
  allServices: string;
  eyebrow: string;
  intro: string;
};

const COPY: Record<string, CategoryPageCopy> = {
  tr: { allServices: 'Tüm hizmetler', eyebrow: 'Hizmet kategorisi', intro: 'İhtiyacınıza uygun VIP transfer seçeneklerini inceleyin.' },
  en: { allServices: 'All services', eyebrow: 'Service category', intro: 'Explore VIP transfer options tailored to your journey.' },
  de: { allServices: 'Alle Dienstleistungen', eyebrow: 'Dienstleistungskategorie', intro: 'Entdecken Sie VIP-Transferoptionen für Ihre Reise.' },
  ru: { allServices: 'Все услуги', eyebrow: 'Категория услуг', intro: 'Выберите VIP-трансфер, подходящий для вашей поездки.' },
  ar: { allServices: 'جميع الخدمات', eyebrow: 'فئة الخدمة', intro: 'استكشف خيارات النقل الخاص المناسبة لرحلتك.' },
  fr: { allServices: 'Tous les services', eyebrow: 'Catégorie de service', intro: 'Découvrez des options de transfert VIP adaptées à votre trajet.' },
  es: { allServices: 'Todos los servicios', eyebrow: 'Categoría de servicio', intro: 'Descubra opciones de traslado VIP adaptadas a su viaje.' },
  it: { allServices: 'Tutti i servizi', eyebrow: 'Categoria di servizio', intro: 'Scopri le opzioni di transfer VIP adatte al tuo viaggio.' },
  nl: { allServices: 'Alle diensten', eyebrow: 'Dienstencategorie', intro: 'Bekijk VIP-transferopties die bij uw reis passen.' },
};

export function getServiceCategoryPageCopy(locale: string): CategoryPageCopy {
  return COPY[locale] ?? COPY.en;
}

function safeJsonLd(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

interface Props {
  locale: string;
  category: ServiceCategoryItem;
}

export default async function ServiceCategoryPageContent({ locale, category }: Props) {
  const copy = getServiceCategoryPageCopy(locale);
  const isRtl = RTL_LOCALES.includes(locale);
  const servicesPath = localizedStaticPath('hizmetler', locale);
  const categoryPath = localizedServiceCategoryPath(category.slug, locale);
  const pageUrl = `${SITE.siteUrl}${categoryPath}`;
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'VIP Transfer Istanbul', item: SITE.siteUrl },
      { '@type': 'ListItem', position: 2, name: copy.allServices, item: `${SITE.siteUrl}${servicesPath}` },
      { '@type': 'ListItem', position: 3, name: category.label, item: pageUrl },
    ],
  };

  return (
    <>
      <section
        dir={isRtl ? 'rtl' : 'ltr'}
        style={{
          background: 'linear-gradient(135deg, #102A43 0%, #1B3A52 100%)',
          color: '#fff',
          padding: '76px 20px 68px',
        }}
      >
        <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
          <Link
            href={servicesPath}
            style={{
              display: 'inline-flex', color: '#F6E6B9', textDecoration: 'none',
              fontFamily: 'Inter, sans-serif', fontSize: '14px', marginBottom: '22px',
            }}
          >
            {isRtl ? '→' : '←'} {copy.allServices}
          </Link>
          <p style={{ color: '#D9B964', fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: '0 0 10px' }}>
            {copy.eyebrow}
          </p>
          <h1 style={{ margin: 0, maxWidth: '760px', fontSize: 'clamp(2rem, 5vw, 4rem)', lineHeight: 1.08 }}>
            {category.label}
          </h1>
          <p style={{ color: '#D9E6EF', fontFamily: 'Inter, sans-serif', fontSize: '17px', lineHeight: 1.7, maxWidth: '620px', margin: '18px 0 0' }}>
            {copy.intro}
          </p>
        </div>
      </section>

      <section className="py-16 md:py-20 max-w-7xl mx-auto px-5 md:px-8">
        <HizmetlerServiceGridCms locale={locale} categories={[category]} categorySlug={category.slug} />
      </section>

      <BookingForm />
      <Contact />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumb) }} />
    </>
  );
}