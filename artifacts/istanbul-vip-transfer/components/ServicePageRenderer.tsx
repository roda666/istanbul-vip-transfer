/**
 * Server Component — renders a service page with optional DB content overlay.
 *
 * Used by the catch-all locale route (`/[lang]/[...slug]/page.tsx`) for SERVICE
 * type pages. Fetches the published translation for `slug+locale` from the DB;
 * if found, passes explicit title/subtitle/crumb props to PageHero. Falls back
 * to the static i18n `pageKey` approach when the DB has no published content.
 *
 * Shared components (BookingForm, VehicleFleet, Contact) are always rendered.
 */
import type { PageKey } from '@/components/PageHero';
import PageHero from '@/components/PageHero';
import BookingForm from '@/components/BookingForm';
import VehicleFleet from '@/components/VehicleFleet';
import Contact from '@/components/Contact';
import { getPublishedServicePage } from '@/lib/service-page-cms';

/** Slug → PageHero pageKey mapping (for static fallback). */
const SLUG_TO_PAGE_KEY: Record<string, PageKey> = {
  'istanbul-havalimani-transfer':      'istHava',
  'sabiha-gokcen-havalimani-transfer': 'sabiha',
  'vip-transfer':                      'vipTransfer',
  'sehirler-arasi-transfer':           'sehirlerArasi',
  'soforlu-arac-kiralama':             'soforlu',
  'otel-transfer':                     'otel',
  'saglik-turizmi-transfer':           'saglik',
  'kurumsal-vip-transfer':             'kurumsal',
  'istanbul-bursa-transfer':           'istBursa',
  'istanbul-sapanca-transfer':         'istSapanca',
  'istanbul-gunubirlik-turlar':        'istGunubirlik',
  'sapanca-masukiye-turu':             'sapanca',
  'bursa-gunubirlik-tur':              'bursa',
  'yalova-gunubirlik-tur':             'yalova',
};

/** Slugs that use 2-crumb breadcrumb (Home → Page) instead of 3-crumb. */
const TWO_CRUMB_SLUGS = new Set([
  'istanbul-havalimani-transfer',
  'sabiha-gokcen-havalimani-transfer',
  'vip-transfer',
  'sehirler-arasi-transfer',
]);

interface Props {
  slug: string;
  lang: string;
}

export default async function ServicePageRenderer({ slug, lang }: Props) {
  const dbPage = await getPublishedServicePage(slug, lang);
  const pageKey = SLUG_TO_PAGE_KEY[slug];

  if (dbPage?.body) {
    const { hero } = dbPage.body;
    const isTwoCrumb = TWO_CRUMB_SLUGS.has(slug);

    const breadcrumbs = isTwoCrumb
      ? [{ label: 'Home', href: '/' }, { label: hero.crumb }]
      : [{ label: 'Home', href: '/' }, { label: 'Services', href: '/hizmetler' }, { label: hero.crumb }];

    return (
      <>
        {/* PageHero with DB content — explicit props mode */}
        <PageHero breadcrumbs={breadcrumbs} title={hero.title} subtitle={hero.subtitle} />
        <BookingForm />
        <VehicleFleet />
        <Contact />
      </>
    );
  }

  // Static fallback — uses i18n dict via pageKey
  if (pageKey) {
    return (
      <>
        <PageHero pageKey={pageKey} />
        <BookingForm />
        <VehicleFleet />
        <Contact />
      </>
    );
  }

  return null;
}
