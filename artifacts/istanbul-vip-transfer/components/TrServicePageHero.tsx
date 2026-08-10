/**
 * Server Component — renders PageHero for Turkish root service pages with DB content overlay.
 *
 * Fetches the published Turkish CMS record for the given slug. When a record
 * exists with body.hero content, it passes explicit title/subtitle/breadcrumb
 * props to PageHero so admin edits appear on the primary TR URL. Falls back to
 * the static i18n `pageKey` when the DB has no published content (or on error).
 */
import type { PageKey } from '@/components/PageHero';
import PageHero from '@/components/PageHero';
import { getPublishedServicePage } from '@/lib/service-page-cms';

/** Slugs that use 2-crumb breadcrumb (Ana Sayfa → Page) instead of 3-crumb. */
const TWO_CRUMB_SLUGS = new Set([
  'istanbul-havalimani-transfer',
  'sabiha-gokcen-havalimani-transfer',
  'vip-transfer',
  'sehirler-arasi-transfer',
]);

interface Props {
  slug: string;
  pageKey: PageKey;
}

export default async function TrServicePageHero({ slug, pageKey }: Props) {
  const dbPage = await getPublishedServicePage(slug, 'tr');

  if (dbPage?.body) {
    const { hero } = dbPage.body;
    const isTwoCrumb = TWO_CRUMB_SLUGS.has(slug);

    const breadcrumbs = isTwoCrumb
      ? [{ label: 'Ana Sayfa', href: '/' }, { label: hero.crumb }]
      : [
          { label: 'Ana Sayfa', href: '/' },
          { label: 'Hizmetler', href: '/hizmetler' },
          { label: hero.crumb },
        ];

    return (
      <PageHero
        breadcrumbs={breadcrumbs}
        title={hero.title}
        subtitle={hero.subtitle}
      />
    );
  }

  // Static fallback — uses i18n dict via pageKey
  return <PageHero pageKey={pageKey} />;
}
