import 'server-only';

import { unstable_cache } from 'next/cache';
import { getContactSettings } from '@/lib/site-settings-server';
import { getPublishedHomepageData } from '@/lib/homepage-cms';
import { getPublicServiceCatalog } from '@/lib/public-service-catalog';
import {
  getPublishedHomepageFaqs,
  getPublishedHomepageReviews,
  getPublishedHomepageServiceCopy,
} from '@/lib/homepage-public-content';
import { getHomepageTransferRoutes } from '@/lib/transfer-route-pages';
import { PUBLIC_CHROME_REVALIDATE_SECONDS, PUBLIC_CHROME_TAG } from '@/lib/public-chrome-cache';

/**
 * Shared homepage payload cached across visitors.
 *
 * The root layout intentionally remains request-aware for language and consent
 * handling. Keeping every homepage content query behind this cache prevents
 * that request awareness from causing a fresh CMS/database read per visit.
 * The existing public-chrome tag is invalidated by all homepage publish and
 * public catalog mutation paths, so updates remain visible immediately.
 */
const getCachedPublicHomepageData = unstable_cache(
  async (locale: string) => {
    const [cmsData, serviceCatalog, contactSettings, transferRoutes, reviews, homepageFaqs, serviceCopy] =
      await Promise.all([
        getPublishedHomepageData(locale),
        getPublicServiceCatalog(locale),
        getContactSettings(),
        getHomepageTransferRoutes().catch(() => []),
        getPublishedHomepageReviews(locale),
        getPublishedHomepageFaqs(locale),
        getPublishedHomepageServiceCopy(locale),
      ]);

    return {
      cmsData,
      serviceCatalog,
      contactSettings,
      transferRoutes,
      reviews,
      homepageFaqs,
      serviceCopy,
    };
  },
  ['public-homepage-data-v1'],
  {
    revalidate: PUBLIC_CHROME_REVALIDATE_SECONDS,
    tags: [PUBLIC_CHROME_TAG],
  },
);

export function getPublicHomepageData(locale: string) {
  return getCachedPublicHomepageData(locale);
}