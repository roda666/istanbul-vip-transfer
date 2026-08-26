import 'server-only';

import { and, desc, eq, inArray, isNull, lte, or, gte } from 'drizzle-orm';
import { db } from '@/db';
import {
  exchangeRateHistory,
  exchangeRateSettings,
  fixedPriceOverrides,
  optionalServices,
  priceCalculatorSettings,
  reservationRequests,
  routeTollAlternativeItems,
  routeTollAlternatives,
  tollPoints,
  tollTariffs,
  transferRoutes,
  vehiclePricingProfiles,
  vehicleTollPointClasses,
  vehicles,
} from '@/db/schema';
import { resolveLocationDistance, type LocationDistanceResult } from '@/lib/location-distance';
import {
  calculateAdminQuote,
  type PricingProfileInput,
  type PricingQuoteResult,
  type PricingServiceInput,
} from '@/lib/admin-pricing-engine';
import {
  evaluateTollTariffStaleness,
  getDefaultRouteTollAlternative,
  getTollPricingSettings,
  resolveActiveTimeBandForPoint,
} from '@/lib/toll-management';

export function currentlyApplicable<T extends { validFrom: Date | null; validUntil: Date | null }>(rows: T[], at: Date): T | undefined {
  return rows
    .filter((row) => (!row.validFrom || row.validFrom <= at) && (!row.validUntil || row.validUntil >= at))
    .sort((a, b) => (b.validFrom?.getTime() ?? 0) - (a.validFrom?.getTime() ?? 0))[0];
}

export async function getCurrentExchangeRates() {
  const [settings] = await db.select().from(exchangeRateSettings).where(eq(exchangeRateSettings.id, 1)).limit(1);
  if (!settings) return null;
  const [latest] = await db.select().from(exchangeRateHistory).where(eq(exchangeRateHistory.source, 'TCMB')).orderBy(desc(exchangeRateHistory.fetchedAt)).limit(1);
  const eurTryMicros = settings.eurTryMode === 'MANUAL' ? settings.manualEurTryMicros : latest?.eurTryMicros;
  const eurUsdMicros = settings.eurUsdMode === 'MANUAL' ? settings.manualEurUsdMicros : latest?.eurUsdMicros;
  if (!eurTryMicros || !eurUsdMicros || eurTryMicros <= 0 || eurUsdMicros <= 0) return null;
  return {
    eurTryMicros,
    eurUsdMicros,
    source: settings.eurTryMode === 'MANUAL' || settings.eurUsdMode === 'MANUAL' ? 'MANUAL' : 'TCMB',
    rateRecordId: latest?.id ?? null,
  };
}

export async function createAdminQuote(input: {
  routeId?: string;
  originLocationId?: string;
  destinationLocationId?: string;
  vehicleId?: string;
  mode: 'DISTANCE' | 'HOURLY';
  requestedHours?: number;
  tripType: 'ONE_WAY' | 'ROUND_TRIP';
  tollAlternativeId?: string;
  serviceQuantities?: Array<{ serviceId: string; quantity: number }>;
  reservationRequestId?: string;
  /** Trip pickup instant used only to pick the DAY/NIGHT toll tariff band; defaults to now. */
  pickupAt?: Date;
  adminId: string;
}): Promise<{ result: PricingQuoteResult; distance: LocationDistanceResult; snapshot?: Record<string, unknown>; quoteSnapshotId?: string }> {
  const now = new Date();
  const pickupAt = input.pickupAt ?? now;
  let route = null;
  let override = undefined;
  if (input.routeId) {
    [route] = await db.select().from(transferRoutes).where(and(
      eq(transferRoutes.id, input.routeId),
      eq(transferRoutes.active, true),
    )).limit(1);
    if (!route) throw new Error('Güzergâh bulunamadı.');
  }

  const originLocationId = route?.originLocationId ?? input.originLocationId;
  const destinationLocationId = route?.destinationLocationId ?? input.destinationLocationId;
  if (!originLocationId || !destinationLocationId) {
    return {
      result: { state: 'UNAVAILABLE', reason: 'MISSING_DISTANCE' },
      distance: { state: 'UNAVAILABLE', reason: 'LOCATION_NOT_FOUND', calculatedAt: now.toISOString() },
    };
  }
  const distance = await resolveLocationDistance({ originLocationId, destinationLocationId, at: now });
  if (distance.state === 'UNAVAILABLE') {
    return { result: { state: 'UNAVAILABLE', reason: 'MISSING_DISTANCE' }, distance };
  }

  const vehicleId = input.vehicleId ?? route?.defaultVehicleId;
  if (!vehicleId) throw new Error('Bu güzergâh için araç seçin veya varsayılan araç atayın.');
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
  if (!vehicle) throw new Error('Araç bulunamadı.');

  const profileRows = await db.select().from(vehiclePricingProfiles).where(and(
    eq(vehiclePricingProfiles.vehicleId, vehicleId),
    eq(vehiclePricingProfiles.mode, input.mode),
    eq(vehiclePricingProfiles.active, true),
    isNull(vehiclePricingProfiles.archivedAt),
  )).orderBy(desc(vehiclePricingProfiles.updatedAt));
  const profileRow = profileRows[0];

  if (route) {
    const overrides = await db.select().from(fixedPriceOverrides).where(and(
      eq(fixedPriceOverrides.routeId, route.id),
      eq(fixedPriceOverrides.vehicleId, vehicleId),
      eq(fixedPriceOverrides.active, true),
      or(isNull(fixedPriceOverrides.validFrom), lte(fixedPriceOverrides.validFrom, now)),
      or(isNull(fixedPriceOverrides.validUntil), gte(fixedPriceOverrides.validUntil, now)),
    )).orderBy(desc(fixedPriceOverrides.validFrom));
    // Fixed prices remain a secondary legacy override, but only while their
    // explicit validity window applies.
    override = currentlyApplicable(overrides, now);
  }

  const [policy] = await db.select().from(priceCalculatorSettings).where(eq(priceCalculatorSettings.id, 1)).limit(1);
  const rates = await getCurrentExchangeRates();
  const services = await resolveServices(input.serviceQuantities ?? [], rates);
  // The server, rather than the browser, resolves a route's chosen default.
  // This keeps calculations deterministic for reservation snapshots and avoids
  // silently omitting tolls if an older UI does not submit the optional field.
  // Always validate the route's default invariant, including when an admin
  // explicitly chooses an alternative. An explicit id may choose between
  // valid alternatives; it must never bypass a malformed route configuration.
  const routeDefaultTollAlternativeId = input.routeId
    ? await getDefaultRouteTollAlternative(input.routeId)
    : null;
  const effectiveTollAlternativeId = input.routeId
    ? input.tollAlternativeId ?? routeDefaultTollAlternativeId
    : null;
  const tolls = input.routeId && effectiveTollAlternativeId
    ? await resolveTolls(input.routeId, effectiveTollAlternativeId, vehicleId, vehicle.pricingClass, now, pickupAt, input.tripType)
    : [];

  const profile = profileRow ? ({
    mode: profileRow.mode,
    openingKurus: profileRow.distanceOpeningKurus ?? 0,
    firstKmKurus: profileRow.distanceFirstKmKurus ?? -1,
    thresholdKm: profileRow.distanceThresholdKm ?? -1,
    secondKmKurus: profileRow.distanceSecondKmKurus ?? 0,
    hourlyRateKurus: profileRow.hourlyRateKurus ?? -1,
    minimumHours: profileRow.minimumHours ?? -1,
    includedKmMode: profileRow.includedKmMode ?? 'PACKAGE',
    includedKm: profileRow.includedKm ?? -1,
    excessKmKurus: profileRow.excessKmKurus ?? -1,
    excessHourKurus: profileRow.excessHourKurus ?? -1,
  } as PricingProfileInput) : undefined;

  const result = calculateAdminQuote({
    vehicleEligible: vehicle.priceCalculationEligible,
    profile,
    overrideKurus: override?.amountKurus,
    distanceKm: distance.distanceKm,
    requestedHours: input.requestedHours,
    tripType: input.tripType,
    tolls,
    services,
    vatRateBasisPoints: policy?.vatRateBasisPoints ?? 2000,
    vatDisplayMode: policy?.vatDisplayMode ?? 'EXCLUDED',
    rates: rates ?? { eurTryMicros: 0, eurUsdMicros: 0 },
    rounding: {
      eurCents: policy?.eurRoundingKurus ?? 500,
      usdCents: policy?.usdRoundingCents ?? 500,
      tryKurus: policy?.tryRoundingKurus ?? 5000,
    },
  });

  const snapshot = {
    version: 1,
    calculatedAt: now.toISOString(),
    inputs: {
      ...input,
      tollAlternativeId: effectiveTollAlternativeId,
      tollAlternativeAutoApplied: Boolean(!input.tollAlternativeId && routeDefaultTollAlternativeId),
      vehicleId,
      originLocationId,
      destinationLocationId,
      distanceKm: distance.distanceKm,
    },
    vehicle: { id: vehicle.id, name: vehicle.name, pricingClass: vehicle.pricingClass, priceCalculationEligible: vehicle.priceCalculationEligible },
    route: route ? { id: route.id, name: route.name, distanceKm: distance.distanceKm } : null,
    distance,
    profile: profileRow ?? null,
    override: override ?? null,
    tolls,
    services,
    policy: policy ? {
      vatRateBasisPoints: policy.vatRateBasisPoints,
      vatDisplayMode: policy.vatDisplayMode,
      eurRoundingKurus: policy.eurRoundingKurus,
      usdRoundingCents: policy.usdRoundingCents,
      tryRoundingKurus: policy.tryRoundingKurus,
      settingsVersion: policy.settingsVersion,
    } : null,
    exchangeRates: rates,
    result,
  } satisfies Record<string, unknown>;

  if (!input.reservationRequestId) return { result, distance, snapshot };
  if (result.state !== 'AVAILABLE') return { result, distance, snapshot };
  const [request] = await db.select({ id: reservationRequests.id }).from(reservationRequests).where(eq(reservationRequests.id, input.reservationRequestId)).limit(1);
  if (!request) throw new Error('Talep bulunamadı.');
  const { priceQuoteSnapshots } = await import('@/db/schema');
  const [quote] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(priceQuoteSnapshots).values({
      routeId: input.routeId ?? null,
      vehicleId,
      snapshot,
      createdBy: input.adminId,
    }).returning();
    await tx.update(reservationRequests).set({ priceQuoteSnapshotId: created.id, updatedAt: now }).where(eq(reservationRequests.id, request.id));
    return [created];
  });
  return { result, distance, snapshot, quoteSnapshotId: quote.id };
}

async function resolveServices(
  selections: Array<{ serviceId: string; quantity: number }>,
  rates: Awaited<ReturnType<typeof getCurrentExchangeRates>>,
): Promise<PricingServiceInput[]> {
  if (!selections.length) return [];
  const ids = [...new Set(selections.map((item) => item.serviceId))];
   const rows = await db.select().from(optionalServices).where(and(
     inArray(optionalServices.id, ids),
     eq(optionalServices.active, true),
     isNull(optionalServices.archivedAt),
   ));
  if (rows.length !== ids.length) throw new Error('Seçilen ek hizmetlerden biri geçerli değil.');
  return selections.map((selection) => {
    const service = rows.find((row) => row.id === selection.serviceId)!;
    if (!Number.isInteger(selection.quantity) || selection.quantity < 1 || selection.quantity > service.maximumQuantity) throw new Error('Ek hizmet adedi geçersiz.');
    if (service.currency !== 'TRY' && !rates) throw new Error('Ek hizmet için güvenilir kur bulunamadı.');
    return {
      id: service.id,
      name: service.name,
      quantity: selection.quantity,
      unitAmount: service.unitAmount,
      currency: service.currency as 'TRY' | 'EUR' | 'USD',
      includedInTransfer: service.includedInTransfer,
    };
  });
}

/**
 * Resolves one line per toll point in the chosen alternative. A point with no
 * matching active tariff is returned with `amountKurus: null, missing: true`
 * instead of throwing — a missing tariff must never silently price as zero,
 * but it also must not block the entire quote. This also covers a point
 * where the vehicle has no admin-assigned class yet (per toll point, since
 * classification systems differ by operator): it resolves as "missing" for
 * that point, since the class was never manually chosen there.
 *
 * A point where the vehicle's assigned class is on that point's confirmed
 * ban list is a different, harder case: the vehicle genuinely cannot use
 * that crossing, so silently treating it as "missing" (i.e. free) would
 * underprice, and showing it as ordinary missing data would mislead the
 * admin into thinking it just needs a tariff entered. This throws instead —
 * the admin must pick a different alternative that does not route through a
 * banned crossing for this vehicle.
 *
 * Only genuine data-integrity problems (an inactive point, more than one
 * conflicting active tariff, or a banned crossing) throw; everything else
 * that is simply not-yet-entered stays non-blocking. Each point resolves its
 * own day/night band independently, since cutover hours are configured per
 * toll point, not globally.
 */
async function resolveTolls(routeId: string, alternativeId: string, vehicleId: string, vehiclePricingClass: string, now: Date, pickupAt: Date, tripType: 'ONE_WAY' | 'ROUND_TRIP') {
  const [alternative] = await db.select().from(routeTollAlternatives).where(and(
    eq(routeTollAlternatives.id, alternativeId),
    eq(routeTollAlternatives.routeId, routeId),
    eq(routeTollAlternatives.active, true),
  )).limit(1);
  if (!alternative) throw new Error('Geçiş alternatifi bu güzergâh için geçerli değil.');
  const items = await db.select().from(routeTollAlternativeItems).where(eq(routeTollAlternativeItems.alternativeId, alternativeId));
  if (!items.length) return [];
  const pointIds = items.map((item) => item.tollPointId);
  const points = await db.select().from(tollPoints).where(and(inArray(tollPoints.id, pointIds), eq(tollPoints.active, true)));
  if (points.length !== pointIds.length) throw new Error('Geçiş noktası artık aktif değil.');
  const settings = await getTollPricingSettings();
  const pointBand = new Map(points.map((point) => [point.id, resolveActiveTimeBandForPoint(pickupAt, point)]));

  const pointClassRows = await db.select().from(vehicleTollPointClasses).where(and(
    eq(vehicleTollPointClasses.vehicleId, vehicleId),
    inArray(vehicleTollPointClasses.tollPointId, pointIds),
  ));
  const classByPointId = new Map(pointClassRows.map((row) => [row.tollPointId, row.vehicleClass]));
  const assignedClasses = [...new Set(pointClassRows.map((row) => row.vehicleClass))];

  const allTariffs = assignedClasses.length
    ? await db.select().from(tollTariffs).where(and(
      inArray(tollTariffs.tollPointId, pointIds),
      inArray(tollTariffs.vehicleClass, assignedClasses),
      eq(tollTariffs.active, true),
      or(isNull(tollTariffs.validFrom), lte(tollTariffs.validFrom, now)),
      or(isNull(tollTariffs.validUntil), gte(tollTariffs.validUntil, now)),
    ))
    : [];
  const tariffs = allTariffs.filter((tariff) => {
    const vehicleClassAtPoint = classByPointId.get(tariff.tollPointId);
    if (vehicleClassAtPoint !== tariff.vehicleClass) return false;
    const band = pointBand.get(tariff.tollPointId) ?? 'DAY';
    return band === 'DAY' ? tariff.appliesDay : tariff.appliesNight;
  });

  return items.map((item) => {
    const point = points.find((candidate) => candidate.id === item.tollPointId)!;
    // Vehicle-TYPE ban (e.g. Avrasya Tüneli categorically bans "Otobüs") is a
    // separate, independent axis from the axle-based class ban below — a
    // vehicle can be banned by type even before it has an assigned class at
    // this point, so this check runs first and unconditionally.
    const bannedTypes = (point.bannedVehicleTypes ?? []) as string[];
    if (vehiclePricingClass && bannedTypes.includes(vehiclePricingClass)) {
      throw new Error(`${point.name} bu araç tipi (${vehiclePricingClass}) için geçişe kapalıdır. Fiyat üretimi güvenle durduruldu — lütfen bu geçiş noktasını içermeyen başka bir alternatif seçin.`);
    }
    const vehicleClassAtPoint = classByPointId.get(point.id) ?? null;
    const bannedClasses = (point.bannedVehicleClasses ?? []) as string[];
    if (vehicleClassAtPoint && bannedClasses.includes(vehicleClassAtPoint)) {
      throw new Error(`${point.name} bu araç sınıfı (${vehicleClassAtPoint}) için geçişe kapalıdır. Fiyat üretimi güvenle durduruldu — lütfen bu geçiş noktasını içermeyen başka bir alternatif seçin.`);
    }
    if (!vehicleClassAtPoint) {
      return { id: point.id, name: point.name, amountKurus: null as number | null, missing: true as const, stale: false, directionUnconfirmed: point.tollDirection == null };
    }
    const isGatePair = point.pricingMode === 'GATE_PAIR';
    if (isGatePair && (!item.entryGateName || !item.exitGateName)) {
      // A GATE_PAIR point (e.g. Osmangazi Köprüsü / O-5 corridor) has no
      // single point-level tariff — this route was never told which gate
      // pair it actually uses, which is a configuration gap, not a priced
      // amount waiting on data entry, but it stays non-blocking like any
      // other missing tariff.
      return { id: point.id, name: point.name, amountKurus: null as number | null, missing: true as const, stale: false, directionUnconfirmed: point.tollDirection == null };
    }
    const pointTariffs = tariffs.filter((candidate) => candidate.tollPointId === item.tollPointId);
    const forwardCandidates = pointTariffs.filter((candidate) => {
      if (isGatePair) return candidate.entryGateName === item.entryGateName && candidate.exitGateName === item.exitGateName;
      if (point.tollDirection === 'TWO_WAY_DIRECTIONAL') return candidate.direction === 'FORWARD';
      return true;
    });
    if (forwardCandidates.length > 1) {
      throw new Error(`${point.name} için ${vehicleClassAtPoint} sınıfında birden fazla geçerli tarife bulundu. Fiyat üretimi güvenle durduruldu.`);
    }
    const forwardAmountKurus = forwardCandidates[0]?.amountKurus ?? null;
    if (forwardCandidates.length === 0 || forwardAmountKurus == null) {
      return { id: point.id, name: point.name, amountKurus: null as number | null, missing: true as const, stale: false, directionUnconfirmed: point.tollDirection == null };
    }
    const forwardTariff = forwardCandidates[0];
    const forwardStaleness = evaluateTollTariffStaleness(forwardTariff, settings, now);

    // ONE_WAY trips only ever charge the forward leg, regardless of the
    // point's tollDirection (that field only governs what a ROUND_TRIP adds).
    if (tripType === 'ONE_WAY') {
      return { id: point.id, name: point.name, amountKurus: forwardTariff.amountKurus, missing: false as const, stale: forwardStaleness.stale, directionUnconfirmed: point.tollDirection == null };
    }

    // ROUND_TRIP: how much the return leg adds depends on tollDirection.
    if (point.tollDirection === 'ONE_WAY') {
      // Charged in one direction only — a round trip still pays it once.
      return { id: point.id, name: point.name, amountKurus: forwardTariff.amountKurus, missing: false as const, stale: forwardStaleness.stale, directionUnconfirmed: false };
    }
    if (point.tollDirection === 'TWO_WAY_DIRECTIONAL') {
      const backwardCandidates = pointTariffs.filter((candidate) => {
        if (isGatePair) return candidate.entryGateName === item.exitGateName && candidate.exitGateName === item.entryGateName;
        return candidate.direction === 'BACKWARD';
      });
      if (backwardCandidates.length > 1) {
        throw new Error(`${point.name} için ${vehicleClassAtPoint} sınıfında dönüş yönünde birden fazla geçerli tarife bulundu. Fiyat üretimi güvenle durduruldu.`);
      }
      const backwardAmountKurus = backwardCandidates[0]?.amountKurus ?? null;
      if (backwardCandidates.length === 0 || backwardAmountKurus == null) {
        // The forward leg is priced but the return leg's own tariff is
        // missing — summing only the forward amount would silently
        // under-price the round trip, so the whole toll is missing instead.
        return { id: point.id, name: point.name, amountKurus: null as number | null, missing: true as const, stale: false, directionUnconfirmed: false };
      }
      const backwardTariff = backwardCandidates[0];
      const backwardStaleness = evaluateTollTariffStaleness(backwardTariff, settings, now);
      return {
        id: point.id,
        name: point.name,
        amountKurus: forwardAmountKurus + backwardAmountKurus,
        missing: false as const,
        stale: forwardStaleness.stale || backwardStaleness.stale,
        directionUnconfirmed: false,
      };
    }
    // TWO_WAY_SAME, or null/unconfirmed (preserved legacy behavior so
    // existing quotes don't silently change without a verified source).
    return {
      id: point.id,
      name: point.name,
      amountKurus: forwardAmountKurus * 2,
      missing: false as const,
      stale: forwardStaleness.stale,
      directionUnconfirmed: point.tollDirection == null,
    };
  });
}