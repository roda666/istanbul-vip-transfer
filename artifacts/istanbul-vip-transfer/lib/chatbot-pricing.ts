import 'server-only';

import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { db } from '@/db';
import {
  fixedPriceOverrides,
  priceCalculatorSettings,
  transferRoutes,
  vehiclePricingProfiles,
  vehicles,
} from '@/db/schema';
import { currentlyApplicable, getCurrentExchangeRates } from '@/lib/admin-pricing-service';
import { calculateAdminQuote, type PricingProfileInput } from '@/lib/admin-pricing-engine';

export type ChatbotFareRangeMatch = {
  origin: string;
  destination: string;
  minTryKurus: number;
  maxTryKurus: number;
};

const MAX_MATCHES = 2;
const MIN_TERM_LENGTH = 3;

function terms(value: string): string[] {
  return [...new Set(
    value
      .toLocaleLowerCase('tr-TR')
      .split(/[^\p{L}\p{N}]+/u)
      .filter((term) => term.length >= MIN_TERM_LENGTH),
  )];
}

/**
 * Finds active routes whose name/origin/destination overlap with the
 * visitor's message, and — ONLY for those routes, and ONLY for vehicles that
 * actually have admin-defined pricing data — computes a real one-way price
 * range using the exact same pricing engine the admin quote tool uses.
 *
 * Tolls are deliberately excluded from the computation: the chatbot must
 * never itemize or imply bridge/tunnel/highway fees, and WhatsApp/the
 * booking form always confirms the exact final price anyway.
 *
 * A route with no eligible vehicle carrying a defined pricing profile
 * produces NO entry at all — this function never fabricates a number.
 */
export async function getChatbotFareRangeMatches(visitorMessage: string): Promise<ChatbotFareRangeMatch[]> {
  const queryTermSet = new Set(terms(visitorMessage));
  if (queryTermSet.size === 0) return [];

  try {
    const routes = await db
      .select({
        id: transferRoutes.id,
        name: transferRoutes.name,
        origin: transferRoutes.origin,
        destination: transferRoutes.destination,
        distanceKm: transferRoutes.distanceKm,
      })
      .from(transferRoutes)
      .where(eq(transferRoutes.active, true));

    const scoredRoutes = routes
      .map((route) => {
        const routeTerms = terms(`${route.name} ${route.origin} ${route.destination}`);
        const matches = routeTerms.filter((term) => queryTermSet.has(term)).length;
        return { route, matches };
      })
      .filter(({ matches }) => matches > 0)
      .sort((a, b) => b.matches - a.matches)
      .slice(0, MAX_MATCHES);

    if (scoredRoutes.length === 0) return [];

    const [rates, [policy]] = await Promise.all([
      getCurrentExchangeRates(),
      db.select().from(priceCalculatorSettings).where(eq(priceCalculatorSettings.id, 1)).limit(1),
    ]);
    if (!rates || !policy) return [];

    const now = new Date();
    const eligibleVehicles = await db
      .select()
      .from(vehicles)
      .where(and(eq(vehicles.priceCalculationEligible, true), eq(vehicles.isActive, true)));
    if (eligibleVehicles.length === 0) return [];

    const results: ChatbotFareRangeMatch[] = [];

    for (const { route } of scoredRoutes) {
      const totalsKurus: number[] = [];

      for (const vehicle of eligibleVehicles) {
        const profileRows = await db
          .select()
          .from(vehiclePricingProfiles)
          .where(and(
            eq(vehiclePricingProfiles.vehicleId, vehicle.id),
            eq(vehiclePricingProfiles.mode, 'DISTANCE'),
            eq(vehiclePricingProfiles.active, true),
            isNull(vehiclePricingProfiles.archivedAt),
          ))
          .orderBy(desc(vehiclePricingProfiles.updatedAt));
        const profileRow = profileRows[0];
        // No defined pricing profile for this vehicle on this route → skip it.
        // Never fall back to a guessed number.
        if (!profileRow) continue;

        const profile: PricingProfileInput = {
          mode: 'DISTANCE',
          openingKurus: profileRow.distanceOpeningKurus ?? 0,
          firstKmKurus: profileRow.distanceFirstKmKurus ?? -1,
          thresholdKm: profileRow.distanceThresholdKm ?? -1,
          secondKmKurus: profileRow.distanceSecondKmKurus ?? 0,
        };

        const overrideRows = await db
          .select()
          .from(fixedPriceOverrides)
          .where(and(
            eq(fixedPriceOverrides.routeId, route.id),
            eq(fixedPriceOverrides.vehicleId, vehicle.id),
            eq(fixedPriceOverrides.active, true),
            or(isNull(fixedPriceOverrides.validFrom), lte(fixedPriceOverrides.validFrom, now)),
            or(isNull(fixedPriceOverrides.validUntil), gte(fixedPriceOverrides.validUntil, now)),
          ));
        const override = currentlyApplicable(overrideRows, now);

        const result = calculateAdminQuote({
          vehicleEligible: vehicle.priceCalculationEligible,
          profile,
          overrideKurus: override?.amountKurus,
          distanceKm: route.distanceKm,
          tripType: 'ONE_WAY',
          tolls: [],
          services: [],
          vatRateBasisPoints: policy.vatRateBasisPoints,
          vatDisplayMode: policy.vatDisplayMode,
          rates: { eurTryMicros: rates.eurTryMicros, eurUsdMicros: rates.eurUsdMicros },
          rounding: {
            eurCents: policy.eurRoundingKurus,
            usdCents: policy.usdRoundingCents,
            tryKurus: policy.tryRoundingKurus,
          },
        });

        if (result.state === 'AVAILABLE') totalsKurus.push(result.quotedTryKurus);
      }

      // No vehicle produced a real quote for this route → no entry at all.
      if (totalsKurus.length === 0) continue;

      results.push({
        origin: route.origin,
        destination: route.destination,
        minTryKurus: Math.min(...totalsKurus),
        maxTryKurus: Math.max(...totalsKurus),
      });
    }

    return results;
  } catch (error) {
    console.error('[chatbot-pricing] fare range lookup failed:', error instanceof Error ? error.message : 'unknown');
    return [];
  }
}

function formatTry(kurus: number): string {
  const lira = Math.round(kurus / 100);
  return `${lira.toLocaleString('tr-TR')} TRY`;
}

/**
 * Formats fare-range matches as an untrusted reference-data block, following
 * the same pattern as `formatChatbotKnowledgeContext` — the model is told
 * exactly how it may and may not use this data.
 */
export function formatChatbotFareRangeContext(matches: ChatbotFareRangeMatch[]): string {
  if (matches.length === 0) return '';

  const entries = matches.map((match) => ({
    route: `${match.origin} -> ${match.destination}`,
    estimatedOneWayRangeTRY: `${formatTry(match.minTryKurus)} - ${formatTry(match.maxTryKurus)}`,
  }));

  return [
    'UNTRUSTED_KNOWLEDGE_REFERENCE_DATA — FARE_RANGE_DATA',
    'The JSON payload below lists REAL estimated one-way price ranges (Turkish Lira, tax included) computed just now from the pricing actually configured in the admin panel for routes that may match the visitor\'s question.',
    'Rules for using this data:',
    '- Only use an entry if it is the exact route the visitor is asking about. If several entries are listed but none match, ignore all of them.',
    '- Present the number explicitly as an ESTIMATED RANGE ("tahmini aralık" / "estimated range"), never as a fixed final price.',
    '- Always follow it by directing the visitor to WhatsApp or the booking form for the exact final price.',
    '- If the visitor asks about a route that is not listed here, say plainly that you do not have a defined price estimate for that route, and direct them to WhatsApp or the booking form. Never invent a number.',
    '- Never mention tolls, bridges, tunnels, highways, or any crossing fee in any language, in any form — not even to say they are excluded or included.',
    '<fare-range-data>',
    JSON.stringify(entries),
    '</fare-range-data>',
  ].join('\n');
}
