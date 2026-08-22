import PageHero from '@/components/PageHero';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';
import HizmetlerServiceGridCms from '@/components/HizmetlerServiceGridCms';
import HizmetlerCategoryNav from '@/components/HizmetlerCategoryNav';
import { SITE } from '@/lib/site-config';
import { getServiceCategories } from '@/lib/service-category-server';
import { localizedStaticPath } from '@/lib/localized-service-path';
import { getDictionary } from '@/lib/i18n';

/** Shared locale-aware services content used by the canonical localized URL. */
export default async function LocalizedServicesPageContent({ lang }: { lang: string }) {
  const dict = getDictionary(lang);
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: dict.nav.home, item: `${SITE.siteUrl}/${lang}` },
      { '@type': 'ListItem', position: 2, name: dict.nav.services, item: `${SITE.siteUrl}${localizedStaticPath('hizmetler', lang)}` },
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