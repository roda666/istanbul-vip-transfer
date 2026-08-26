/**
 * Deterministic, server-side pricing math. All TRY values use kuruş; EUR/USD
 * values use cents; rates use micro-units (one currency unit × 1,000,000).
 */
export type PricingProfileInput =
  | {
    mode: 'DISTANCE';
    openingKurus: number;
    firstKmKurus: number;
    thresholdKm: number;
    secondKmKurus: number;
  }
  | {
    mode: 'HOURLY';
    hourlyRateKurus: number;
    minimumHours: number;
    includedKmMode: 'PER_HOUR' | 'PACKAGE';
    includedKm: number;
    excessKmKurus: number;
    excessHourKurus: number;
  };

export type PricingServiceInput = {
  id: string;
  name: string;
  quantity: number;
  unitAmount: number;
  currency: 'TRY' | 'EUR' | 'USD';
  includedInTransfer: boolean;
};

export type PricingLine = {
  key: string;
  label: string;
  amountKurus: number;
  visibleToCustomer: boolean;
};

export type PricingQuoteResult =
  | { state: 'ON_REQUEST'; reason: 'VEHICLE_NOT_ELIGIBLE' }
  | { state: 'UNAVAILABLE'; reason: 'MISSING_PROFILE' | 'INVALID_INPUT' | 'MISSING_RATE' | 'MISSING_DISTANCE' }
  | {
    state: 'AVAILABLE';
    formulaKind: 'DISTANCE' | 'HOURLY' | 'OVERRIDE';
    lines: PricingLine[];
    netTryKurus: number;
    vatTryKurus: number;
    grossTryKurus: number;
    rawEurCents: number;
    quotedEurCents: number;
    quotedUsdCents: number;
    quotedTryKurus: number;
    effectiveHours?: number;
    includedKmAllowance?: number;
    /**
     * A missing tariff never silently contributes zero: it is excluded from
     * the sum and surfaced here so the admin panel can flag the quote as
     * incomplete instead of quietly under-pricing it.
     */
    hasMissingTollData: boolean;
    missingTollNames: string[];
    /** A tariff past the configurable staleness threshold still prices the quote, but is flagged for admin review. */
    hasStaleTollData: boolean;
    staleTollNames: string[];
    /**
     * A toll point whose tollDirection was never confirmed against an
     * official source still prices the quote using the legacy "double on
     * round trip" assumption, but is flagged here so the admin knows that
     * assumption is unverified rather than a sourced fact.
     */
    hasUnconfirmedTollDirection: boolean;
    directionUnconfirmedTollNames: string[];
  };

export function roundUp(value: number, step: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(step) || step <= 0) throw new Error('Invalid rounding input');
  return Math.ceil(value / step) * step;
}

function positiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function serviceTryKurus(
  service: PricingServiceInput,
  rates: { eurTryMicros: number; eurUsdMicros: number },
): number | null {
  if (!positiveInteger(service.unitAmount) || !Number.isInteger(service.quantity) || service.quantity < 1) return null;
  const amount = service.unitAmount * service.quantity;
  if (service.currency === 'TRY') return amount;
  if (service.currency === 'EUR') return Math.ceil((amount * rates.eurTryMicros) / 1_000_000);
  if (rates.eurUsdMicros <= 0) return null;
  // USD cents -> EUR cents -> TRY kuruş, using the same locked quote rate.
  return Math.ceil((amount * rates.eurTryMicros) / rates.eurUsdMicros);
}

export function calculateAdminQuote(input: {
  vehicleEligible: boolean;
  profile?: PricingProfileInput;
  overrideKurus?: number | null;
  distanceKm: number;
  requestedHours?: number;
  tripType: 'ONE_WAY' | 'ROUND_TRIP';
  tolls?: Array<{ id: string; name: string; amountKurus: number | null; missing?: boolean; stale?: boolean; directionUnconfirmed?: boolean }>;
  services?: PricingServiceInput[];
  vatRateBasisPoints: number;
  vatDisplayMode: 'EXCLUDED' | 'INCLUDED';
  rates: { eurTryMicros: number; eurUsdMicros: number };
  rounding: { eurCents: number; usdCents: number; tryKurus: number };
}): PricingQuoteResult {
  if (!input.vehicleEligible) return { state: 'ON_REQUEST', reason: 'VEHICLE_NOT_ELIGIBLE' };
  if (!positiveInteger(input.distanceKm) || input.distanceKm < 1 || !input.profile) {
    return { state: 'UNAVAILABLE', reason: input.profile ? 'INVALID_INPUT' : 'MISSING_PROFILE' };
  }
  if (
    input.rates.eurTryMicros <= 0
    || input.rates.eurUsdMicros <= 0
    || !positiveInteger(input.vatRateBasisPoints)
  ) return { state: 'UNAVAILABLE', reason: 'MISSING_RATE' };

  const tripMultiplier = input.tripType === 'ROUND_TRIP' ? 2 : 1;
  const lines: PricingLine[] = [];
  let baseKurus = 0;
  let formulaKind: 'DISTANCE' | 'HOURLY' | 'OVERRIDE' = 'DISTANCE';
  let effectiveHours: number | undefined;
  let includedKmAllowance: number | undefined;

  if (input.overrideKurus != null) {
    if (!positiveInteger(input.overrideKurus) || input.overrideKurus < 1) {
      return { state: 'UNAVAILABLE', reason: 'INVALID_INPUT' };
    }
    formulaKind = 'OVERRIDE';
    baseKurus = input.overrideKurus * tripMultiplier;
    lines.push({ key: 'override', label: 'Sabit güzergâh fiyatı', amountKurus: baseKurus, visibleToCustomer: false });
  } else if (input.profile.mode === 'DISTANCE') {
    const profile = input.profile;
    if (![profile.openingKurus, profile.firstKmKurus, profile.thresholdKm, profile.secondKmKurus].every(positiveInteger) || profile.thresholdKm < 1) {
      return { state: 'UNAVAILABLE', reason: 'INVALID_INPUT' };
    }
    const firstKm = Math.min(input.distanceKm, profile.thresholdKm);
    const secondKm = Math.max(0, input.distanceKm - profile.thresholdKm);
    // A zero second-tier amount represents an intentionally blank optional
    // tier: continue the first kilometre tariff rather than making all later
    // kilometres free.
    const secondKmRate = profile.secondKmKurus > 0 ? profile.secondKmKurus : profile.firstKmKurus;
    baseKurus = (profile.openingKurus + firstKm * profile.firstKmKurus + secondKm * secondKmRate) * tripMultiplier;
    lines.push({ key: 'distance-opening', label: 'Açılış', amountKurus: profile.openingKurus * tripMultiplier, visibleToCustomer: false });
    lines.push({ key: 'distance-first-tier', label: `İlk kademe (${firstKm} km)`, amountKurus: firstKm * profile.firstKmKurus * tripMultiplier, visibleToCustomer: false });
    if (secondKm > 0) lines.push({ key: 'distance-second-tier', label: profile.secondKmKurus > 0 ? `İkinci kademe (${secondKm} km)` : `Tek tarife devamı (${secondKm} km)`, amountKurus: secondKm * secondKmRate * tripMultiplier, visibleToCustomer: false });
  } else {
    formulaKind = 'HOURLY';
    const profile = input.profile;
    const requestedHours = input.requestedHours ?? 0;
    if (
      !Number.isSafeInteger(requestedHours) || requestedHours < 1
      || ![profile.hourlyRateKurus, profile.minimumHours, profile.includedKm, profile.excessKmKurus, profile.excessHourKurus].every(positiveInteger)
      || profile.minimumHours < 1
    ) return { state: 'UNAVAILABLE', reason: 'INVALID_INPUT' };
    effectiveHours = Math.max(requestedHours, profile.minimumHours);
    includedKmAllowance = profile.includedKmMode === 'PER_HOUR'
      ? effectiveHours * profile.includedKm
      : profile.includedKm;
    // A short allocation always bills the configured minimum. Beyond it, the
    // separate excess-hour rate applies; the two components never overlap.
    const baseHours = profile.minimumHours;
    const excessHours = Math.max(0, requestedHours - profile.minimumHours);
    const excessKm = Math.max(0, input.distanceKm - includedKmAllowance);
    baseKurus = (baseHours * profile.hourlyRateKurus
      + excessHours * profile.excessHourKurus
      + excessKm * profile.excessKmKurus) * tripMultiplier;
    lines.push({ key: 'hourly-base', label: `Tahsis (${effectiveHours} saat)`, amountKurus: baseHours * profile.hourlyRateKurus * tripMultiplier, visibleToCustomer: false });
    if (excessHours) lines.push({ key: 'hourly-excess', label: `Süre aşımı (${excessHours} saat)`, amountKurus: excessHours * profile.excessHourKurus * tripMultiplier, visibleToCustomer: false });
    if (excessKm) lines.push({ key: 'hourly-km-excess', label: `Km aşımı (${excessKm} km)`, amountKurus: excessKm * profile.excessKmKurus * tripMultiplier, visibleToCustomer: false });
  }

  const missingTollNames: string[] = [];
  const staleTollNames: string[] = [];
  const directionUnconfirmedTollNames: string[] = [];
  for (const toll of input.tolls ?? []) {
    if (toll.missing || toll.amountKurus == null) {
      missingTollNames.push(toll.name);
      continue;
    }
    if (!positiveInteger(toll.amountKurus) || toll.amountKurus < 1) return { state: 'UNAVAILABLE', reason: 'INVALID_INPUT' };
    if (toll.stale) staleTollNames.push(toll.name);
    if (toll.directionUnconfirmed) directionUnconfirmedTollNames.push(toll.name);
    // Direction-aware round-trip handling already happened upstream (see
    // resolveTolls): amountKurus here is the FULL round-trip amount for this
    // point when applicable, so it must never be multiplied again here.
    lines.push({ key: `toll:${toll.id}`, label: toll.name, amountKurus: toll.amountKurus, visibleToCustomer: false });
  }
  for (const service of input.services ?? []) {
    const amountKurus = serviceTryKurus(service, input.rates);
    if (amountKurus == null) return { state: 'UNAVAILABLE', reason: 'MISSING_RATE' };
    lines.push({ key: `service:${service.id}`, label: service.name, amountKurus, visibleToCustomer: !service.includedInTransfer });
  }

  const netTryKurus = lines.reduce((sum, line) => sum + line.amountKurus, 0);
  if (netTryKurus < 1) return { state: 'UNAVAILABLE', reason: 'INVALID_INPUT' };
  const vatTryKurus = input.vatDisplayMode === 'INCLUDED'
    ? netTryKurus - Math.floor((netTryKurus * 10_000) / (10_000 + input.vatRateBasisPoints))
    : Math.ceil((netTryKurus * input.vatRateBasisPoints) / 10_000);
  const grossTryKurus = input.vatDisplayMode === 'INCLUDED' ? netTryKurus : netTryKurus + vatTryKurus;
  const rawEurCents = Math.ceil((grossTryKurus * 1_000_000) / input.rates.eurTryMicros);
  const quotedEurCents = roundUp(rawEurCents, input.rounding.eurCents);
  const quotedUsdCents = roundUp(Math.ceil((quotedEurCents * input.rates.eurUsdMicros) / 1_000_000), input.rounding.usdCents);
  const quotedTryKurus = roundUp(Math.ceil((quotedEurCents * input.rates.eurTryMicros) / 1_000_000), input.rounding.tryKurus);

  return {
    state: 'AVAILABLE',
    formulaKind,
    lines,
    netTryKurus,
    vatTryKurus,
    grossTryKurus,
    rawEurCents,
    quotedEurCents,
    quotedUsdCents,
    quotedTryKurus,
    effectiveHours,
    includedKmAllowance,
    hasMissingTollData: missingTollNames.length > 0,
    missingTollNames,
    hasStaleTollData: staleTollNames.length > 0,
    staleTollNames,
    hasUnconfirmedTollDirection: directionUnconfirmedTollNames.length > 0,
    directionUnconfirmedTollNames,
  };
}