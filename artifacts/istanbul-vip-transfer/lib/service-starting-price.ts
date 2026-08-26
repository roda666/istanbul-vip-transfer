/**
 * Computes the live "starting from X EUR" price shown on a service page.
 *
 * Source of truth is whatever panel-defined pricing already exists for the
 * routes linked to a service (`transfer_routes.related_service_slug`):
 *   - the legacy per-route EUR ranges (priceVitoMinEur / priceSprinterMinEur)
 *   - the newer route_price_rules table (vehicle-specific, currency-tagged)
 * The lowest EUR figure found across both sources is the "starting price",
 * rounded UP to the nearest multiple of 5 so the shown number is never an
 * under-promise.
 *
 * Deliberately excluded: the quote-calculator engine
 * (vehicle_pricing_profiles / admin-pricing-engine.ts). That engine requires
 * a specific trip context (distance, dates, extras) to produce a number, so
 * treating its output as a flat "starting price" would risk showing a figure
 * that isn't really a simple, always-true minimum.
 *
 * Returns null when no EUR pricing data exists for the service at all — the
 * caller must show nothing rather than a fabricated or estimated number.
 */
export async function getServiceStartingPriceEur(serviceSlug: string): Promise<number | null> {
  try {
    const { db } = await import('@/db');
    const { transferRoutes, routePriceRules } = await import('@/db/schema');
    const { eq, and } = await import('drizzle-orm');

    const routes = await db
      .select({
        id: transferRoutes.id,
        priceVitoMinEur: transferRoutes.priceVitoMinEur,
        priceSprinterMinEur: transferRoutes.priceSprinterMinEur,
      })
      .from(transferRoutes)
      .where(and(eq(transferRoutes.relatedServiceSlug, serviceSlug), eq(transferRoutes.active, true)));

    if (routes.length === 0) return null;

    let minEur: number | null = null;
    for (const route of routes) {
      for (const candidate of [route.priceVitoMinEur, route.priceSprinterMinEur]) {
        if (typeof candidate === 'number' && candidate > 0) {
          minEur = minEur === null ? candidate : Math.min(minEur, candidate);
        }
      }
    }

    const routeIds = routes.map(r => r.id);
    if (routeIds.length > 0) {
      const now = new Date();
      const rules = await db
        .select({ amountCents: routePriceRules.amountCents, currency: routePriceRules.currency, routeId: routePriceRules.routeId, validFrom: routePriceRules.validFrom, validUntil: routePriceRules.validUntil })
        .from(routePriceRules)
        .where(eq(routePriceRules.active, true));

      for (const rule of rules) {
        if (!routeIds.includes(rule.routeId)) continue;
        if (rule.currency !== 'EUR') continue;
        if (rule.validFrom && rule.validFrom > now) continue;
        if (rule.validUntil && rule.validUntil < now) continue;
        const eur = rule.amountCents / 100;
        if (eur > 0) {
          minEur = minEur === null ? eur : Math.min(minEur, eur);
        }
      }
    }

    if (minEur === null) return null;
    return Math.ceil(minEur / 5) * 5;
  } catch {
    return null;
  }
}
