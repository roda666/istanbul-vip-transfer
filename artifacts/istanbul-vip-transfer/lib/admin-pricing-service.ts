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
  vehicles,
} from '@/db/schema';
import {
  calculateAdminQuote,
  type PricingProfileInput,
  type PricingQuoteResult,
  type PricingServiceInput,
} from '@/lib/admin-pricing-engine';

function currentlyApplicable<T extends { validFrom: Date | null; validUntil: Date | null }>(rows: T[], at: Date): T | undefined {
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
  vehicleId: string;
  mode: 'DISTANCE' | 'HOURLY';
  distanceKm: number;
  requestedHours?: number;
  tripType: 'ONE_WAY' | 'ROUND_TRIP';
  tollAlternativeId?: string;
  serviceQuantities?: Array<{ serviceId: string; quantity: number }>;
  reservationRequestId?: string;
  adminId: string;
}): Promise<{ result: PricingQuoteResult; snapshot?: Record<string, unknown>; quoteSnapshotId?: string }> {
  const now = new Date();
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, input.vehicleId)).limit(1);
  if (!vehicle) throw new Error('Araç bulunamadı.');

  const profileRows = await db.select().from(vehiclePricingProfiles).where(and(
    eq(vehiclePricingProfiles.vehicleId, input.vehicleId),
    eq(vehiclePricingProfiles.mode, input.mode),
    eq(vehiclePricingProfiles.active, true),
    isNull(vehiclePricingProfiles.archivedAt),
  )).orderBy(desc(vehiclePricingProfiles.updatedAt));
  const profileRow = profileRows[0];

  let route = null;
  let override = undefined;
  if (input.routeId) {
    [route] = await db.select().from(transferRoutes).where(eq(transferRoutes.id, input.routeId)).limit(1);
    if (!route) throw new Error('Güzergâh bulunamadı.');
    const overrides = await db.select().from(fixedPriceOverrides).where(and(
      eq(fixedPriceOverrides.routeId, input.routeId),
      eq(fixedPriceOverrides.vehicleId, input.vehicleId),
      eq(fixedPriceOverrides.active, true),
      or(isNull(fixedPriceOverrides.validFrom), lte(fixedPriceOverrides.validFrom, now)),
      or(isNull(fixedPriceOverrides.validUntil), gte(fixedPriceOverrides.validUntil, now)),
    )).orderBy(desc(fixedPriceOverrides.validFrom));
    override = currentlyApplicable(overrides, now);
  }

  const [policy] = await db.select().from(priceCalculatorSettings).where(eq(priceCalculatorSettings.id, 1)).limit(1);
  const rates = await getCurrentExchangeRates();
  const services = await resolveServices(input.serviceQuantities ?? [], rates);
  const tolls = input.routeId && input.tollAlternativeId
    ? await resolveTolls(input.routeId, input.tollAlternativeId, vehicle.pricingClass, now)
    : [];

  const profile = profileRow ? ({
    mode: profileRow.mode,
    openingKurus: profileRow.distanceOpeningKurus ?? -1,
    firstKmKurus: profileRow.distanceFirstKmKurus ?? -1,
    thresholdKm: profileRow.distanceThresholdKm ?? -1,
    secondKmKurus: profileRow.distanceSecondKmKurus ?? -1,
    hourlyRateKurus: profileRow.hourlyRateKurus ?? -1,
    minimumHours: profileRow.minimumHours ?? -1,
    includedKmMode: profileRow.includedKmMode ?? 'PACKAGE',
    includedKm: profileRow.includedKm ?? -1,
    excessKmKurus: profileRow.excessKmKurus ?? -1,
    excessHourKurus: profileRow.excessHourKurus ?? -1,
  } as PricingProfileInput) : undefined;

  const resolvedDistanceKm = route?.distanceKm ?? input.distanceKm;
  const result = calculateAdminQuote({
    vehicleEligible: vehicle.priceCalculationEligible,
    profile,
    overrideKurus: override?.amountKurus,
    distanceKm: resolvedDistanceKm,
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
    inputs: { ...input, distanceKm: resolvedDistanceKm, requestedDistanceKm: input.distanceKm },
    vehicle: { id: vehicle.id, name: vehicle.name, pricingClass: vehicle.pricingClass, priceCalculationEligible: vehicle.priceCalculationEligible },
    route: route ? { id: route.id, name: route.name, distanceKm: route.distanceKm } : null,
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

  if (!input.reservationRequestId) return { result, snapshot };
  if (result.state !== 'AVAILABLE') return { result, snapshot };
  const [request] = await db.select({ id: reservationRequests.id }).from(reservationRequests).where(eq(reservationRequests.id, input.reservationRequestId)).limit(1);
  if (!request) throw new Error('Talep bulunamadı.');
  const { priceQuoteSnapshots } = await import('@/db/schema');
  const [quote] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(priceQuoteSnapshots).values({
      routeId: input.routeId ?? null,
      vehicleId: input.vehicleId,
      snapshot,
      createdBy: input.adminId,
    }).returning();
    await tx.update(reservationRequests).set({ priceQuoteSnapshotId: created.id, updatedAt: now }).where(eq(reservationRequests.id, request.id));
    return [created];
  });
  return { result, snapshot, quoteSnapshotId: quote.id };
}

async function resolveServices(
  selections: Array<{ serviceId: string; quantity: number }>,
  rates: Awaited<ReturnType<typeof getCurrentExchangeRates>>,
): Promise<PricingServiceInput[]> {
  if (!selections.length) return [];
  const ids = [...new Set(selections.map((item) => item.serviceId))];
  const rows = await db.select().from(optionalServices).where(and(inArray(optionalServices.id, ids), eq(optionalServices.active, true)));
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

async function resolveTolls(routeId: string, alternativeId: string, vehicleClass: string, now: Date) {
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
  const tariffs = await db.select().from(tollTariffs).where(and(
    inArray(tollTariffs.tollPointId, pointIds),
    eq(tollTariffs.vehicleClass, vehicleClass),
    eq(tollTariffs.active, true),
    or(isNull(tollTariffs.validFrom), lte(tollTariffs.validFrom, now)),
    or(isNull(tollTariffs.validUntil), gte(tollTariffs.validUntil, now)),
  ));
  return items.map((item) => {
    const point = points.find((candidate) => candidate.id === item.tollPointId)!;
    const tariff = currentlyApplicable(tariffs.filter((candidate) => candidate.tollPointId === item.tollPointId), now);
    if (!tariff) throw new Error(`${point.name} için ${vehicleClass} tarifesi bulunamadı.`);
    return { id: point.id, name: point.name, amountKurus: tariff.amountKurus };
  });
}