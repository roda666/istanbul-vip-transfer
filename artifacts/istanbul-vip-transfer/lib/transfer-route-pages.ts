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
import { removeCustomerVisibleTollCopy } from '@/lib/customer-visible-copy';

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

function sanitizeRouteText(value: string | null): string | null {
  return value === null ? null : removeCustomerVisibleTollCopy(value);
}

function sanitizeRouteRecord(route: TransferRoute): TransferRoute {
  return {
    ...route,
    name: removeCustomerVisibleTollCopy(route.name),
    origin: removeCustomerVisibleTollCopy(route.origin),
    destination: removeCustomerVisibleTollCopy(route.destination),
    description: sanitizeRouteText(route.description),
    introParagraph: sanitizeRouteText(route.introParagraph),
    transportOptions: (route.transportOptions ?? []).map((option) => ({
      ...option,
      name: removeCustomerVisibleTollCopy(option.name),
      summary: removeCustomerVisibleTollCopy(option.summary),
      downside: removeCustomerVisibleTollCopy(option.downside),
    })).filter((option) => option.name || option.summary || option.downside),
    routeNotes: (route.routeNotes ?? []).map(removeCustomerVisibleTollCopy).filter(Boolean),
    faqItems: (route.faqItems ?? []).map((faq) => ({
      ...faq,
      question: removeCustomerVisibleTollCopy(faq.question),
      answer: removeCustomerVisibleTollCopy(faq.answer),
    })).filter((faq) => faq.question && faq.answer),
    seoTitle: sanitizeRouteText(route.seoTitle),
    seoDescription: sanitizeRouteText(route.seoDescription),
    ogTitle: sanitizeRouteText(route.ogTitle),
    ogDescription: sanitizeRouteText(route.ogDescription),
  };
}

function sanitizeRelatedRoute(route: Pick<TransferRoute, 'slug' | 'name' | 'origin' | 'destination'>) {
  return {
    ...route,
    name: removeCustomerVisibleTollCopy(route.name),
    origin: removeCustomerVisibleTollCopy(route.origin),
    destination: removeCustomerVisibleTollCopy(route.destination),
  };
}

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

  return routes.map((rawRoute) => {
    const route = sanitizeRouteRecord(rawRoute);
    return {
    ...route,
    publishedPageLocales: localesByRoute.get(route.id) ?? [],
    };
  });
}

/**
 * Returns a route only when it may be rendered publicly in the requested locale.
 * Non-Turkish routes require an explicit PUBLISHED translation—never Turkish fallback.
 */
export async function getPublicTransferRoute(
  slug: string,
  locale: string,
): Promise<PublicTransferRoute | null> {
  const [rawRoute] = await db
    .select()
    .from(transferRoutes)
    .where(and(eq(transferRoutes.slug, slug), eq(transferRoutes.active, true)))
    .limit(1);

  if (!rawRoute) return null;
  const route = sanitizeRouteRecord(rawRoute);

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
      relatedRoutes: relatedRoutes.map(sanitizeRelatedRoute),
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
      relatedRoutes: relatedRoutes.map(sanitizeRelatedRoute),
    content: {
        title: removeCustomerVisibleTollCopy(translation.title),
        description: removeCustomerVisibleTollCopy(translation.description),
        seoTitle: sanitizeRouteText(translation.seoTitle),
        seoDescription: sanitizeRouteText(translation.seoDescription),
        ogTitle: sanitizeRouteText(translation.ogTitle),
        ogDescription: sanitizeRouteText(translation.ogDescription),
        introParagraph: sanitizeRouteText(translation.introParagraph),
        transportOptions: (translation.transportOptions ?? []).map((option) => ({
          ...option,
          name: removeCustomerVisibleTollCopy(option.name),
          summary: removeCustomerVisibleTollCopy(option.summary),
          downside: removeCustomerVisibleTollCopy(option.downside),
        })).filter((option) => option.name || option.summary || option.downside),
        routeNotes: (translation.routeNotes ?? []).map(removeCustomerVisibleTollCopy).filter(Boolean),
        faqItems: (translation.faqItems ?? []).map((faq) => ({
          ...faq,
          question: removeCustomerVisibleTollCopy(faq.question),
          answer: removeCustomerVisibleTollCopy(faq.answer),
        })).filter((faq) => faq.question && faq.answer),
    },
  };
}
