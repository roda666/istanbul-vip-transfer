import 'server-only';

import { unstable_cache } from 'next/cache';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { content, contentTranslations } from '@/db/schema';
import { getServiceCategories } from '@/lib/service-category-server';
import { getContactSettings, type ContactSettings } from '@/lib/site-settings-server';
import { HOMEPAGE_FALLBACK } from '@/lib/homepage-types';
import {
  PUBLIC_CHROME_REVALIDATE_SECONDS,
  PUBLIC_CHROME_TAG,
} from '@/lib/public-chrome-cache';
import type { HomepageSections } from '@/lib/homepage-types';
import type {
  PublicServiceNavigationGroup,
  PublicServiceNavigationItem,
} from '@/lib/public-service-catalog-types';

export { PUBLIC_CHROME_TAG, PUBLIC_CHROME_REVALIDATE_SECONDS };

export type PublicChromePayload = {
  contactSettings: ContactSettings;
  serviceNavigationGroups: PublicServiceNavigationGroup[];
  serviceLinks: PublicServiceNavigationItem[];
  homepageFooter: HomepageSections['footerSection'] | null;
};

function fallbackFooter(locale: string): HomepageSections['footerSection'] {
  return (HOMEPAGE_FALLBACK[locale] ?? HOMEPAGE_FALLBACK.en).footerSection;
}

function asFooterSection(value: unknown): HomepageSections['footerSection'] | null {
  if (typeof value === 'string') {
    try {
      return asFooterSection(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (
    typeof value !== 'object' || value === null
    || typeof (value as HomepageSections['footerSection']).tagline !== 'string'
    || typeof (value as HomepageSections['footerSection']).premiumTagline !== 'string'
  ) {
    return null;
  }
  return value as HomepageSections['footerSection'];
}

/**
 * Reads exactly the homepage footer JSON field rather than transferring and
 * parsing the complete homepage document for every shared layout render.
 */
async function getPublishedHomepageFooter(locale: string): Promise<HomepageSections['footerSection']> {
  try {
    if (locale === 'tr') {
      const [row] = await db
        .select({ footer: sql<unknown>`${content.body}::jsonb -> 'footerSection'` })
        .from(content)
        .where(and(eq(content.slug, 'ana-sayfa'), eq(content.status, 'PUBLISHED')))
        .limit(1);
      return asFooterSection(row?.footer) ?? fallbackFooter(locale);
    }

    const [source] = await db
      .select({ id: content.id })
      .from(content)
      .where(eq(content.slug, 'ana-sayfa'))
      .limit(1);
    if (!source) return fallbackFooter(locale);

    const [translation] = await db
      .select({ footer: sql<unknown>`${contentTranslations.body}::jsonb -> 'footerSection'` })
      .from(contentTranslations)
      .where(and(
        eq(contentTranslations.entityType, 'homepage'),
        eq(contentTranslations.entityId, source.id),
        eq(contentTranslations.targetLanguageCode, locale),
        eq(contentTranslations.status, 'PUBLISHED'),
      ))
      .limit(1);
    return asFooterSection(translation?.footer) ?? fallbackFooter(locale);
  } catch {
    return fallbackFooter(locale);
  }
}

async function getChromeServices(locale: string): Promise<{
  serviceNavigationGroups: PublicServiceNavigationGroup[];
  serviceLinks: PublicServiceNavigationItem[];
}> {
  const categories = await getServiceCategories(locale);
  try {
    const services = locale === 'tr'
      ? await db
        .select({
          slug: content.slug,
          label: content.title,
          category: content.category,
        })
        .from(content)
        .where(and(
          eq(content.contentType, 'SERVICE'),
          eq(content.status, 'PUBLISHED'),
          eq(content.isActive, true),
          eq(content.showInNav, true),
        ))
        .orderBy(asc(content.displayOrder))
      : await db
        .select({
          slug: content.slug,
          label: contentTranslations.title,
          category: content.category,
        })
        .from(content)
        .innerJoin(contentTranslations, and(
          sql`${contentTranslations.entityId}::uuid = ${content.id}`,
          eq(contentTranslations.targetLanguageCode, locale),
          eq(contentTranslations.entityType, 'service_page'),
          // Visitor-ready policy (see lib/service-page-cms.ts getServicePage /
          // getPublishedLocalesForService): DRAFT/REVIEW/APPROVED/PUBLISHED/OUTDATED
          // translations are all served to visitors — only TRANSLATING/QUEUED/
          // FAILED/NOT_STARTED/ARCHIVED stay hidden. The nav must use the same
          // set, or a page that's fully live can still vanish from the menu in
          // that language whenever an unrelated TR edit re-flags it OUTDATED.
          inArray(contentTranslations.status, ['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'OUTDATED']),
        ))
        .where(and(
          eq(content.contentType, 'SERVICE'),
          eq(content.status, 'PUBLISHED'),
          eq(content.isActive, true),
          eq(content.showInNav, true),
        ))
        .orderBy(asc(content.displayOrder));

    const links = services
      .filter((service): service is typeof service & { label: string } => Boolean(service.label))
      .map((service) => ({ slug: service.slug, label: service.label }));

    return {
      serviceLinks: links,
      serviceNavigationGroups: categories
        .map((category) => ({
          slug: category.slug,
          label: category.label,
          items: links.filter((service) =>
            services.some((row) => row.slug === service.slug && row.category === category.slug),
          ),
        }))
        .filter((group) => group.items.length > 0),
    };
  } catch {
    return { serviceNavigationGroups: [], serviceLinks: [] };
  }
}

const getCachedPublicChrome = unstable_cache(
  async (locale: string): Promise<PublicChromePayload> => {
    const [contactSettings, services, homepageFooter] = await Promise.all([
      getContactSettings(),
      getChromeServices(locale),
      getPublishedHomepageFooter(locale),
    ]);
    return { contactSettings, homepageFooter, ...services };
  },
  ['public-chrome-v1'],
  { revalidate: PUBLIC_CHROME_REVALIDATE_SECONDS, tags: [PUBLIC_CHROME_TAG] },
);

/** Cached, locale-specific data needed by the public Header/Footer only. */
export function getPublicChrome(locale: string): Promise<PublicChromePayload> {
  return getCachedPublicChrome(locale);
}