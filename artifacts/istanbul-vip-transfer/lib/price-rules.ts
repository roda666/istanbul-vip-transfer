/**
 * Pure price-rule utilities. Keeping selection and period logic independent of
 * the database makes the future calculator deterministic and directly testable.
 */

export type PriceRuleWindow = {
  id: string;
  active: boolean;
  validFrom: Date | null;
  validUntil: Date | null;
  updatedAt: Date;
};

/** The admin UI and database only support currencies priced without FX conversion. */
export const SUPPORTED_PRICE_CURRENCIES = ['EUR', 'TRY', 'USD'] as const;
export type SupportedPriceCurrency = (typeof SUPPORTED_PRICE_CURRENCIES)[number];

export function isSupportedPriceCurrency(currency: string): currency is SupportedPriceCurrency {
  return (SUPPORTED_PRICE_CURRENCIES as readonly string[]).includes(currency);
}

export function isValidPriceWindow(validFrom: Date | null, validUntil: Date | null): boolean {
  return !validFrom || !validUntil || validFrom.getTime() <= validUntil.getTime();
}

export function isPriceRuleActiveAt(rule: PriceRuleWindow, at: Date): boolean {
  return rule.active
    && (!rule.validFrom || rule.validFrom.getTime() <= at.getTime())
    && (!rule.validUntil || rule.validUntil.getTime() >= at.getTime());
}

/** Inclusive date windows overlap unless one ends before the other begins. */
export function priceRuleWindowsOverlap(
  left: Pick<PriceRuleWindow, 'validFrom' | 'validUntil'>,
  right: Pick<PriceRuleWindow, 'validFrom' | 'validUntil'>,
): boolean {
  return (!left.validUntil || !right.validFrom || left.validUntil.getTime() >= right.validFrom.getTime())
    && (!right.validUntil || !left.validFrom || right.validUntil.getTime() >= left.validFrom.getTime());
}

/**
 * Select the most recently updated applicable rule. Overlaps are prevented on
 * writes; this stable tie-breaker keeps reads safe if historic data overlaps.
 */
export function selectApplicablePriceRule<T extends PriceRuleWindow>(rules: T[], at: Date): T | null {
  return rules
    .filter((rule) => isPriceRuleActiveAt(rule, at))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.id.localeCompare(a.id))[0] ?? null;
}