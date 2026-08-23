/** Pure, deterministic helpers for the legacy fixed-price rule store. */

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

/**
 * Fixed legacy rules are immediate: active status is the only applicability
 * control. Historical validity dates remain in the database but never affect
 * selection, because the admin UI no longer manages date windows.
 */
export function selectApplicablePriceRule<T extends PriceRuleWindow>(rules: T[], _at?: Date): T | null {
  return rules
    .filter((rule) => rule.active)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.id.localeCompare(a.id))[0] ?? null;
}