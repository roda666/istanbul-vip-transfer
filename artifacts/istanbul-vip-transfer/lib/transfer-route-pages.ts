import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  transferRoutes,
  transferRouteTranslations,
  type RouteFaqItem,
  type RouteTransportOption,
  type TransferRoute,
} from '@/db/schema';
import { getPublicLanguages } from '@/lib/i18n/active-locales';

export const ROUTE_PAGE_LOCALES = ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'] as const;

export type TransferRouteCard = TransferRoute & {
  publishedPageLocales: string[];
};

export type PublicTransferRoute = TransferRoute & {
  content: {
    title: string;
    description: string;
    seoTitle: string | null;
    seoDescription: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    introParagraph: string | null;
    transportOptions: RouteTransportOption[];
    routeNotes: string[];
    faqItems: RouteFaqItem[];
  };
  publishedLocales: string[];
  relatedRoutes: Array<Pick<TransferRoute, 'slug' | 'name' | 'origin' | 'destination'>>;
};

async function publicLocaleCodes(): Promise<Set<string>> {
  const languages = await getPublicLanguages();
  return new Set(languages.map((language) => language.code));
}

async function publishedLocalesForRoute(routeId: string): Promise<string[]> {
  const [publicCodes, rows] = await Promise.all([
    publicLocaleCodes(),
    db
      .select({ languageCode: transferRouteTranslations.languageCode })
      .from(transferRouteTranslations)
      .where(and(
        eq(transferRouteTranslations.routeId, routeId),
        eq(transferRouteTranslations.status, 'PUBLISHED'),
      )),
  ]);

  return rows
    .map((row) => row.languageCode)
    .filter((code) => code !== 'tr' && publicCodes.has(code));
}

/** Active routes for route cards, with only genuinely public detail locales exposed. */
export async function getHomepageTransferRoutes(): Promise<TransferRouteCard[]> {
  const routes = await db
    .select()
    .from(transferRoutes)
    .where(eq(transferRoutes.active, true))
    .orderBy(asc(transferRoutes.displayOrder));

  if (routes.length === 0) return [];

  const [publicCodes, translations] = await Promise.all([
    publicLocaleCodes(),
    db
      .select({
        routeId: transferRouteTranslations.routeId,
        languageCode: transferRouteTranslations.languageCode,
      })
      .from(transferRouteTranslations)
      .where(and(
        inArray(transferRouteTranslations.routeId, routes.map((route) => route.id)),
        eq(transferRouteTranslations.status, 'PUBLISHED'),
      )),
  ]);

  const localesByRoute = new Map<string, string[]>();
  for (const translation of translations) {
    if (!publicCodes.has(translation.languageCode)) continue;
    const locales = localesByRoute.get(translation.routeId) ?? [];
    locales.push(translation.languageCode);
    localesByRoute.set(translation.routeId, locales);
  }

  return routes.map((route) => ({
    ...route,
    publishedPageLocales: localesByRoute.get(route.id) ?? [],
  }));
}

/**
 * Returns a route only when it may be rendered publicly in the requested locale.
 * Non-Turkish routes require an explicit PUBLISHED translation—never Turkish fallback.
 */
export async function getPublicTransferRoute(
  slug: string,
  locale: string,
): Promise<PublicTransferRoute | null> {
  const [route] = await db
    .select()
    .from(transferRoutes)
    .where(and(eq(transferRoutes.slug, slug), eq(transferRoutes.active, true)))
    .limit(1);

  if (!route) return null;

  const [publishedLocales, relatedRoutes] = await Promise.all([
    publishedLocalesForRoute(route.id),
    db
      .select({
        slug: transferRoutes.slug,
        name: transferRoutes.name,
        origin: transferRoutes.origin,
        destination: transferRoutes.destination,
      })
      .from(transferRoutes)
      .where(and(eq(transferRoutes.active, true), sql`${transferRoutes.id} <> ${route.id}`))
      .orderBy(asc(transferRoutes.displayOrder))
      .limit(3),
  ]);
  if (locale === 'tr') {
    return {
      ...route,
      publishedLocales,
      relatedRoutes,
      content: {
        title: route.name,
        description: route.description ?? `${route.origin} ile ${route.destination} arasındaki VIP transfer hizmeti.`,
        seoTitle: route.seoTitle,
        seoDescription: route.seoDescription,
        ogTitle: route.ogTitle,
        ogDescription: route.ogDescription,
        introParagraph: route.introParagraph,
        transportOptions: route.transportOptions ?? [],
        routeNotes: route.routeNotes ?? [],
        faqItems: route.faqItems ?? [],
      },
    };
  }

  if (!publishedLocales.includes(locale)) return null;

  const [translation] = await db
    .select()
    .from(transferRouteTranslations)
    .where(and(
      eq(transferRouteTranslations.routeId, route.id),
      eq(transferRouteTranslations.languageCode, locale),
      eq(transferRouteTranslations.status, 'PUBLISHED'),
    ))
    .limit(1);

  if (!translation) return null;

  return {
    ...route,
    publishedLocales,
    relatedRoutes,
    content: {
      title: translation.title,
      description: translation.description,
      seoTitle: translation.seoTitle,
      seoDescription: translation.seoDescription,
      ogTitle: translation.ogTitle,
      ogDescription: translation.ogDescription,
      introParagraph: translation.introParagraph,
      transportOptions: translation.transportOptions ?? [],
      routeNotes: translation.routeNotes ?? [],
      faqItems: translation.faqItems ?? [],
    },
  };
}
