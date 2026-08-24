import 'server-only';

import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  priceCalculatorSettings,
  routePriceRules,
  transferRoutes,
  vehicles,
} from '@/db/schema';
import { selectApplicablePriceRule } from '@/lib/price-rules';

export type PriceEstimateResult =
  | { state: 'DISABLED' }
  | { state: 'NOT_FOUND' }
  | {
    state: 'AVAILABLE';
    estimate: {
      amountCents: number;
      currency: string;
      routeSlug: string;
      vehicleSlug: string;
      generatedAt: string;
      validUntil: string | null;
    };
  };

/** Missing settings rows deliberately mean disabled, never accidentally live. */
export async function isPriceCalculatorEnabled(): Promise<boolean> {
  const rows = await db
    .select({ enabled: priceCalculatorSettings.enabled })
    .from(priceCalculatorSettings)
    .where(eq(priceCalculatorSettings.id, 1))
    .limit(1);
  return rows[0]?.enabled === true;
}

/**
 * Looks up one active fixed estimate. Historic validity dates are deliberately
 * ignored: legacy price administration now uses active/passive only.
 */
export async function getPriceEstimate(input: {
  routeSlug: string;
  vehicleSlug: string;
  at?: Date;
}): Promise<PriceEstimateResult> {
  if (!(await isPriceCalculatorEnabled())) return { state: 'DISABLED' };

  const rows = await db
    .select({
      id: routePriceRules.id,
      amountCents: routePriceRules.amountCents,
      currency: routePriceRules.currency,
      active: routePriceRules.active,
      validFrom: routePriceRules.validFrom,
      validUntil: routePriceRules.validUntil,
      updatedAt: routePriceRules.updatedAt,
      routeSlug: transferRoutes.slug,
      vehicleSlug: vehicles.slug,
    })
    .from(routePriceRules)
    .innerJoin(transferRoutes, eq(routePriceRules.routeId, transferRoutes.id))
    .innerJoin(vehicles, eq(routePriceRules.vehicleId, vehicles.id))
    .where(and(
      eq(transferRoutes.slug, input.routeSlug),
      eq(transferRoutes.active, true),
      eq(vehicles.slug, input.vehicleSlug),
      eq(vehicles.status, 'PUBLISHED'),
      eq(vehicles.isActive, true),
      eq(vehicles.priceCalculationEligible, true),
    ));

  const at = input.at ?? new Date();
  const selected = selectApplicablePriceRule(rows, at);
  if (!selected) return { state: 'NOT_FOUND' };

  return {
    state: 'AVAILABLE',
    estimate: {
      amountCents: selected.amountCents,
      currency: selected.currency,
      routeSlug: selected.routeSlug,
      vehicleSlug: selected.vehicleSlug,
      generatedAt: at.toISOString(),
      validUntil: null,
    },
  };
}