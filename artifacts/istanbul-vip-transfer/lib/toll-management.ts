import 'server-only';

import { and, asc, desc, eq, inArray, isNull, lte, or, gte } from 'drizzle-orm';
import { db } from '@/db';
import {
  routeTollAlternativeItems,
  routeTollAlternatives,
  tollPoints,
  tollPricingSettings,
  tollTariffs,
  transferRoutes,
  vehicles,
  vehicleTollPointClasses,
  locations,
  intercityTollCorridors,
  intercityTollCorridorAlternatives,
  intercityTollCorridorAlternativeItems,
} from '@/db/schema';

/**
 * Re-exported from the client-safe module so existing server-side importers
 * of lib/toll-management.ts keep working unchanged. Any NEW client
 * component must import these directly from '@/lib/toll-vehicle-classes'
 * instead of from here — importing this file from a client component pulls
 * in 'server-only' and breaks the build.
 */
export {
  TOLL_VEHICLE_CLASSES,
  type TollVehicleClass,
  isTollVehicleClass,
  TOLL_VEHICLE_CLASS_LABELS,
  TOLL_VEHICLE_CLASS_DESCRIPTIONS,
  TOLL_VEHICLE_CLASS_SELECTION_WARNING,
} from '@/lib/toll-vehicle-classes';
import { TOLL_VEHICLE_CLASSES, type TollVehicleClass } from '@/lib/toll-vehicle-classes';

/**
 * How many times a round trip actually pays a given point. Every existing
 * point defaults to null (unconfirmed) until an admin/agent has actually
 * checked an official source for it — never guessed. Null is resolved the
 * same as TWO_WAY_SAME by the pricing engine so already-live quotes don't
 * silently change, but the admin panel visibly flags it as unverified.
 */
export const TOLL_DIRECTIONS = ['ONE_WAY', 'TWO_WAY_SAME', 'TWO_WAY_DIRECTIONAL'] as const;
export type TollDirection = (typeof TOLL_DIRECTIONS)[number];

export function isTollDirection(value: string): value is TollDirection {
  return (TOLL_DIRECTIONS as readonly string[]).includes(value);
}

export const TOLL_DIRECTION_LABELS: Record<TollDirection, string> = {
  ONE_WAY: 'Tek Yönlü',
  TWO_WAY_SAME: 'Çift Yönlü — Aynı Ücret',
  TWO_WAY_DIRECTIONAL: 'Çift Yönlü — Yöne Göre Farklı Ücret',
};

export const TOLL_DIRECTION_DESCRIPTIONS: Record<TollDirection, string> = {
  ONE_WAY: 'Bu noktada ücret yalnızca bir yönde alınır; gidiş-dönüş bir seferde bile ücret yalnızca bir kez hesaplanır.',
  TWO_WAY_SAME: 'Bu noktada her iki yönde de aynı tutar alınır; gidiş-dönüşte tutar iki katına çıkarılır.',
  TWO_WAY_DIRECTIONAL: 'Bu noktada her iki yön de ücretlendirilir ancak yöne göre farklı tarife satırları vardır (bkz. giriş/çıkış gişesi veya yön alanı); gidiş-dönüşte iki ayrı tarife toplanır, tek satır ikiye katlanmaz.',
};

/**
 * FLAT (default): a single tariff row per (point, class, time band). GATE_PAIR:
 * this point's real fee only exists as an entry-gate/exit-gate calculator
 * result (e.g. an otoyol operator's own fee tool) — never a flat table — so
 * its toll_tariffs rows mean "this exact gate pair + class + amount".
 */
export const TOLL_PRICING_MODES = ['FLAT', 'GATE_PAIR'] as const;
export type TollPricingMode = (typeof TOLL_PRICING_MODES)[number];

export function isTollPricingMode(value: string): value is TollPricingMode {
  return (TOLL_PRICING_MODES as readonly string[]).includes(value);
}

export const TOLL_TIME_BANDS = ['ALL', 'DAY', 'NIGHT'] as const;
export type TollTimeBand = (typeof TOLL_TIME_BANDS)[number];

export function isTollTimeBand(value: string): value is TollTimeBand {
  return (TOLL_TIME_BANDS as readonly string[]).includes(value);
}

/** True only when both classified sides form a genuine Istanbul cross-side trip. */
export function isOppositeIstanbulSide(
  origin: string | null | undefined,
  destination: string | null | undefined,
): boolean {
  return (origin === 'EUROPEAN' && destination === 'ASIAN')
    || (origin === 'ASIAN' && destination === 'EUROPEAN');
}

export function classifyLocationPairTollSource(input: {
  originSide: 'EUROPEAN' | 'ASIAN' | 'NONE';
  destinationSide: 'EUROPEAN' | 'ASIAN' | 'NONE';
  destinationType: string;
  hasRegisteredRoute?: boolean;
  hasCorridor?: boolean;
}): 'EXACT_ROUTE' | 'BOSPHORUS' | 'CORRIDOR' | 'NONE' {
  if (input.hasRegisteredRoute) return 'EXACT_ROUTE';
  if (isOppositeIstanbulSide(input.originSide, input.destinationSide)) return 'BOSPHORUS';
  if (input.originSide === 'EUROPEAN' && input.destinationType === 'PROVINCE' && input.hasCorridor) return 'CORRIDOR';
  return 'NONE';
}

export function assertBosphorusSelectionRequirement(input: {
  hasExactOrSelectedRoute: boolean;
  crossingRequired: boolean;
  bosphorusTollPointId?: string;
  corridorAlternativeId?: string;
}): void {
  if (input.hasExactOrSelectedRoute && input.bosphorusTollPointId) {
    throw new Error('Boğaz geçişi seçimi güzergâh ile birlikte kullanılamaz.');
  }
  if (!input.hasExactOrSelectedRoute && input.crossingRequired && !input.bosphorusTollPointId && !input.corridorAlternativeId) {
    throw new Error('Bu karşı-yaka yolculuğu için bir Boğaz geçişi seçilmelidir.');
  }
}

export async function getLocationPairTollAlternatives(
  originLocationId: string,
  destinationLocationId: string,
  vehicleId?: string,
  pickupAt?: Date,
) {
  const now = new Date();
  const activeAt = pickupAt ?? now;
  const [origin, destination] = await Promise.all([
    db.select().from(locations).where(and(eq(locations.id, originLocationId), eq(locations.isActive, true), isNull(locations.archivedAt))).limit(1),
    db.select().from(locations).where(and(eq(locations.id, destinationLocationId), eq(locations.isActive, true), isNull(locations.archivedAt))).limit(1),
  ]);
  if (!origin[0] || !destination[0]) throw new Error('Konum bulunamadı.');
  if (!isOppositeIstanbulSide(origin[0].istanbulSide, destination[0].istanbulSide)) {
    if (origin[0].istanbulSide !== 'EUROPEAN' || destination[0].type !== 'PROVINCE') {
      return { crossingRequired: false, alternatives: [], defaultAlternativeId: null, source: 'NONE' as const };
    }
    return getIntercityCorridorAlternatives(origin[0], destination[0], vehicleId, activeAt);
  }
  const vehicle = vehicleId
    ? (await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1))[0]
    : undefined;
  if (vehicleId && !vehicle) throw new Error('Araç bulunamadı.');
  const points = await db.select().from(tollPoints).where(and(
    eq(tollPoints.active, true), eq(tollPoints.isBosphorusCrossing, true),
  )).orderBy(asc(tollPoints.bosphorusCrossingOrder), asc(tollPoints.name));
  const pointClasses = new Map<string, string>();
  if (vehicle && points.length) {
    const assignments = await db.select({
      tollPointId: vehicleTollPointClasses.tollPointId,
      vehicleClass: vehicleTollPointClasses.vehicleClass,
    }).from(vehicleTollPointClasses).where(and(
      eq(vehicleTollPointClasses.vehicleId, vehicle.id),
      inArray(vehicleTollPointClasses.tollPointId, points.map((point) => point.id)),
    ));
    for (const assignment of assignments) pointClasses.set(assignment.tollPointId, assignment.vehicleClass);
  }
  const eligible = points.filter((point) => {
    if (!vehicle) return true;
    const classCode = point.pricingMode === 'GATE_PAIR'
      ? pointClasses.get(point.id)
      : vehicle.tollClass;
    return !(classCode && ((point.bannedVehicleClasses ?? []) as string[]).includes(classCode))
      && !((point.bannedVehicleTypes ?? []) as string[]).includes(vehicle.pricingClass);
  });
  const tariffClasses = [...new Set(eligible.map((point) =>
    point.pricingMode === 'GATE_PAIR' ? pointClasses.get(point.id) : vehicle?.tollClass,
  ).filter((value): value is string => !!value))] as TollVehicleClass[];
  const tariffRows = tariffClasses.length && eligible.length ? await db.select().from(tollTariffs).where(and(
    inArray(tollTariffs.tollPointId, eligible.map((p) => p.id)),
    inArray(tollTariffs.vehicleClass, tariffClasses),
    eq(tollTariffs.active, true),
    or(isNull(tollTariffs.validFrom), lte(tollTariffs.validFrom, now)),
    or(isNull(tollTariffs.validUntil), gte(tollTariffs.validUntil, now)),
  )) : [];
  const alternatives = eligible.map((point) => {
    const classCode = vehicle && (point.pricingMode === 'GATE_PAIR' ? pointClasses.get(point.id) : vehicle.tollClass);
    const pointTariffs = tariffRows.filter((t) => t.tollPointId === point.id && t.vehicleClass === classCode);
    const band = resolveTariffBandForPoint(activeAt, point, pointTariffs);
    const tariffs = band.status === 'UNCONFIGURED' ? [] : pointTariffs.filter((t) => tariffAppliesToBand(t, band));
    const matching = tariffs.length === 1 ? tariffs[0] : undefined;
    const amount = point.pricingMode === 'GATE_PAIR' ? null : matching ? effectiveTollAmount(matching) : null;
    const configurationReason = band.status === 'UNCONFIGURED'
      ? `${point.name} (gündüz/gece saatleri yapılandırılmadı)`
      : point.pricingMode === 'GATE_PAIR'
        ? `${point.name} (gişe çifti seçilmedi)`
        : null;
    return {
      id: point.id, tollPointId: point.id, name: `${point.name} üzerinden`,
      active: true, isDefault: point.isDefaultBosphorusCrossing,
      displayOrder: point.bosphorusCrossingOrder, pointIds: [point.id], pointNames: [point.name],
      needsReview: false, reviewNote: null, isBannedForSelectedVehicle: false, bannedPointNames: [],
      isPricedForSelectedVehicle: Boolean(vehicle && amount != null),
      missingTariffPointNames: vehicle && (!classCode || amount == null || band.status === 'UNCONFIGURED')
        ? [configurationReason ?? (!classCode ? `${point.name} (araç sınıfı atanmadı)` : point.name)] : [],
      missingReason: configurationReason,
      totalKurus: vehicle && amount != null ? amount : null,
      tariffCoverage: vehicle && amount != null ? 'FULL' : 'MISSING',
    };
  });
  return {
    crossingRequired: true,
    source: 'BOSPHORUS' as const,
    defaultAlternativeId: alternatives.find((a) => a.isDefault)?.id ?? null,
    alternatives,
  };
}

async function getIntercityCorridorAlternatives(
  origin: typeof locations.$inferSelect,
  destination: typeof locations.$inferSelect,
  vehicleId?: string,
  activeAt = new Date(),
) {
  const [corridor] = await db.select().from(intercityTollCorridors).where(and(
    eq(intercityTollCorridors.originSide, 'EUROPEAN'),
    eq(intercityTollCorridors.destinationLocationId, destination.id),
    eq(intercityTollCorridors.active, true),
  )).limit(1);
  if (!corridor) return { crossingRequired: false, alternatives: [], defaultAlternativeId: null, source: 'NONE' as const };
  const vehicle = vehicleId ? (await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1))[0] : undefined;
  if (vehicleId && !vehicle) throw new Error('Araç bulunamadı.');
  const alternatives = await db.select().from(intercityTollCorridorAlternatives).where(and(
    eq(intercityTollCorridorAlternatives.corridorId, corridor.id),
    eq(intercityTollCorridorAlternatives.active, true),
  )).orderBy(
    desc(intercityTollCorridorAlternatives.isDefault),
    asc(intercityTollCorridorAlternatives.displayOrder),
    asc(intercityTollCorridorAlternatives.name),
    asc(intercityTollCorridorAlternatives.id),
  );
  const items = alternatives.length ? await db.select().from(intercityTollCorridorAlternativeItems)
    .where(inArray(intercityTollCorridorAlternativeItems.alternativeId, alternatives.map(a => a.id)))
    .orderBy(asc(intercityTollCorridorAlternativeItems.displayOrder)) : [];
  const pointIds = [...new Set(items.map(i => i.tollPointId))];
  const points = pointIds.length ? await db.select().from(tollPoints).where(inArray(tollPoints.id, pointIds)) : [];
  const pointById = new Map(points.map(p => [p.id, p]));
  const pointClasses = new Map<string, string>();
  if (vehicle && pointIds.length) {
    const assignments = await db.select({
      tollPointId: vehicleTollPointClasses.tollPointId,
      vehicleClass: vehicleTollPointClasses.vehicleClass,
    }).from(vehicleTollPointClasses).where(and(
      eq(vehicleTollPointClasses.vehicleId, vehicle.id),
      inArray(vehicleTollPointClasses.tollPointId, pointIds),
    ));
    for (const assignment of assignments) pointClasses.set(assignment.tollPointId, assignment.vehicleClass);
  }
  const tariffClasses = [...new Set(points.map((point) =>
    point.pricingMode === 'GATE_PAIR' ? pointClasses.get(point.id) : vehicle?.tollClass,
  ).filter((value): value is string => !!value))] as TollVehicleClass[];
  const now = new Date();
  const tariffs = tariffClasses.length && pointIds.length ? await db.select().from(tollTariffs).where(and(
    inArray(tollTariffs.tollPointId, pointIds), inArray(tollTariffs.vehicleClass, tariffClasses),
    eq(tollTariffs.active, true), or(isNull(tollTariffs.validFrom), lte(tollTariffs.validFrom, now)),
    or(isNull(tollTariffs.validUntil), gte(tollTariffs.validUntil, now)),
  )) : [];
  return {
    crossingRequired: true, source: 'CORRIDOR' as const,
    defaultAlternativeId: alternatives.find(a => a.isDefault)?.id ?? null,
    alternatives: alternatives.map(a => {
      const its = items.filter(i => i.alternativeId === a.id);
      const missingTariffPointNames: string[] = [], bannedPointNames: string[] = [];
      let missingReason: string | null = null;
      let totalKurus = 0, complete = true;
      for (const item of its) {
        const point = pointById.get(item.tollPointId);
        if (!point || !vehicle) { complete = false; if (!point) missingTariffPointNames.push('Bilinmeyen geçiş noktası'); continue; }
        const pointClass = point.pricingMode === 'GATE_PAIR' ? pointClasses.get(point.id) : vehicle.tollClass;
        if (!pointClass) { complete = false; missingTariffPointNames.push(`${point.name} (araç sınıfı atanmadı)`); continue; }
        if ((point.bannedVehicleClasses ?? []).includes(pointClass) || (point.bannedVehicleTypes ?? []).includes(vehicle.pricingClass)) {
          bannedPointNames.push(point.name); continue;
        }
        const pointTariffs = tariffs.filter(t => t.tollPointId === point.id && t.vehicleClass === pointClass);
        const band = resolveTariffBandForPoint(activeAt, point, pointTariffs);
        if (band.status === 'UNCONFIGURED') {
          complete = false;
          missingReason = `${point.name} (gündüz/gece saatleri yapılandırılmadı)`;
          missingTariffPointNames.push(missingReason);
          continue;
        }
        const matches = pointTariffs.filter(t => tariffAppliesToBand(t, band)).filter(t =>
          point.pricingMode !== 'GATE_PAIR' || (t.entryGateName === item.entryGateName && t.exitGateName === item.exitGateName));
        if (matches.length !== 1 || effectiveTollAmount(matches[0]) == null) { complete = false; missingTariffPointNames.push(point.name); continue; }
        totalKurus += effectiveTollAmount(matches[0])!;
      }
      return { id: a.id, name: a.name, active: a.active, isDefault: a.isDefault, displayOrder: a.displayOrder,
        needsReview: a.needsReview, reviewNote: a.reviewNote, pointIds: its.map(i => i.tollPointId),
        pointNames: its.map(i => pointById.get(i.tollPointId)?.name ?? 'Bilinmeyen geçiş'),
        isBannedForSelectedVehicle: bannedPointNames.length > 0, bannedPointNames, isPricedForSelectedVehicle: !vehicle || (complete && !bannedPointNames.length),
        missingTariffPointNames, missingReason, totalKurus: vehicle && complete && !bannedPointNames.length ? totalKurus : null };
    }),
  };
}

/** Resolves the selected generic crossing through the same active tariff rules as the selector. */
export async function resolveBosphorusToll(
  pointId: string,
  originLocationId: string,
  destinationLocationId: string,
  vehicleId: string,
  pickupAt: Date,
  tripType: 'ONE_WAY' | 'ROUND_TRIP',
) {
  const result = await getLocationPairTollAlternatives(originLocationId, destinationLocationId, vehicleId, pickupAt);
  const selected = result.alternatives.find((alternative) => alternative.id === pointId);
  if (!selected) throw new Error('Seçilen Boğaz geçişi bu konum çifti veya araç için geçerli değil.');
  if (selected.totalKurus == null) {
    return {
      id: selected.id,
      name: selected.pointNames[0],
      amountKurus: null,
      missing: true,
      missingReason: selected.missingReason ?? undefined,
      stale: false,
      directionUnconfirmed: true,
    };
  }
  const [point] = await db.select().from(tollPoints).where(eq(tollPoints.id, pointId)).limit(1);
  const amountKurus = tripType === 'ROUND_TRIP' && point?.tollDirection !== 'ONE_WAY'
    ? selected.totalKurus * 2 : selected.totalKurus;
  return { id: selected.id, name: selected.pointNames[0], amountKurus, missing: false, stale: false, directionUnconfirmed: point?.tollDirection == null };
}

export async function resolveIntercityCorridorToll(
  alternativeId: string, originLocationId: string, destinationLocationId: string, vehicleId: string, pickupAt: Date, tripType: 'ONE_WAY' | 'ROUND_TRIP',
) {
  const result = await getLocationPairTollAlternatives(originLocationId, destinationLocationId, vehicleId, pickupAt);
  const selected = result.source === 'CORRIDOR' ? result.alternatives.find(a => a.id === alternativeId) : undefined;
  if (!selected) throw new Error('Seçilen intercity geçiş alternatifi bu konum çifti veya araç için geçerli değil.');
  const items = await db.select().from(intercityTollCorridorAlternativeItems)
    .where(eq(intercityTollCorridorAlternativeItems.alternativeId, alternativeId))
    .orderBy(asc(intercityTollCorridorAlternativeItems.displayOrder));
  const points = await db.select().from(tollPoints).where(inArray(tollPoints.id, items.map(item => item.tollPointId)));
  const settings = await getTollPricingSettings();
  const vehicle = (await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1))[0];
  const pointClasses = new Map<string, string>();
  if (vehicle && points.length) {
    const assignments = await db.select({
      tollPointId: vehicleTollPointClasses.tollPointId,
      vehicleClass: vehicleTollPointClasses.vehicleClass,
    }).from(vehicleTollPointClasses).where(and(
      eq(vehicleTollPointClasses.vehicleId, vehicle.id),
      inArray(vehicleTollPointClasses.tollPointId, points.map((point) => point.id)),
    ));
    for (const assignment of assignments) pointClasses.set(assignment.tollPointId, assignment.vehicleClass);
  }
  const tariffClasses = [...new Set(points.map((point) =>
    point.pricingMode === 'GATE_PAIR' ? pointClasses.get(point.id) : vehicle?.tollClass,
  ).filter((value): value is string => !!value))] as TollVehicleClass[];
  if (!vehicle || !tariffClasses.length) {
    return { id: selected.id, name: selected.name, amountKurus: null, missing: true, stale: false, directionUnconfirmed: true, source: 'CORRIDOR' as const };
  }
  const now = new Date();
  const tariffs = await db.select().from(tollTariffs).where(and(
    inArray(tollTariffs.tollPointId, points.map(point => point.id)),
    inArray(tollTariffs.vehicleClass, tariffClasses),
    eq(tollTariffs.active, true),
    or(isNull(tollTariffs.validFrom), lte(tollTariffs.validFrom, now)),
    or(isNull(tollTariffs.validUntil), gte(tollTariffs.validUntil, now)),
  ));
  let totalKurus = 0;
  let stale = false;
  let directionUnconfirmed = false;
  for (const item of items) {
    const point = points.find(candidate => candidate.id === item.tollPointId);
    const pointClass = point && (point.pricingMode === 'GATE_PAIR' ? pointClasses.get(point.id) : vehicle.tollClass);
    if (!point || !point.active || !pointClass) {
      return { id: selected.id, name: selected.name, amountKurus: null, missing: true, stale, directionUnconfirmed, source: 'CORRIDOR' as const };
    }
    if ((point.bannedVehicleClasses ?? []).includes(pointClass)) {
      return { id: selected.id, name: selected.name, amountKurus: null, missing: true, stale, directionUnconfirmed, source: 'CORRIDOR' as const };
    }
    directionUnconfirmed ||= point.tollDirection == null;
    const allPointTariffs = tariffs.filter(tariff => tariff.tollPointId === point.id && tariff.vehicleClass === pointClass);
    const band = resolveTariffBandForPoint(pickupAt, point, allPointTariffs);
    if (band.status === 'UNCONFIGURED') {
      return {
        id: selected.id,
        name: selected.name,
        amountKurus: null,
        missing: true,
        missingReason: `${point.name} (gündüz/gece saatleri yapılandırılmadı)`,
        stale,
        directionUnconfirmed,
        source: 'CORRIDOR' as const,
      };
    }
    const pointTariffs = allPointTariffs.filter(tariff => tariffAppliesToBand(tariff, band));
    const forward = pointTariffs.filter(tariff => point.pricingMode === 'GATE_PAIR'
      ? tariff.entryGateName === item.entryGateName && tariff.exitGateName === item.exitGateName
      : point.tollDirection === 'TWO_WAY_DIRECTIONAL' ? tariff.direction === 'FORWARD' : true);
    if (forward.length !== 1 || effectiveTollAmount(forward[0]) == null) {
      return { id: selected.id, name: selected.name, amountKurus: null, missing: true, stale, directionUnconfirmed, source: 'CORRIDOR' as const };
    }
    const forwardTariff = forward[0];
    totalKurus += effectiveTollAmount(forwardTariff)!;
    stale ||= evaluateTollTariffStaleness(forwardTariff, settings, now).stale;
    if (tripType === 'ONE_WAY' || point.tollDirection === 'ONE_WAY') continue;
    const backward = pointTariffs.filter(tariff => point.pricingMode === 'GATE_PAIR'
      ? tariff.entryGateName === item.exitGateName && tariff.exitGateName === item.entryGateName
      : point.tollDirection === 'TWO_WAY_DIRECTIONAL' ? tariff.direction === 'BACKWARD' : true);
    if (point.tollDirection === 'TWO_WAY_DIRECTIONAL' && backward.length !== 1) {
      return { id: selected.id, name: selected.name, amountKurus: null, missing: true, stale, directionUnconfirmed: false, source: 'CORRIDOR' as const };
    }
    if (point.tollDirection !== 'TWO_WAY_DIRECTIONAL') {
      totalKurus += effectiveTollAmount(forwardTariff)!;
    } else if (effectiveTollAmount(backward[0]) == null) {
      return { id: selected.id, name: selected.name, amountKurus: null, missing: true, stale, directionUnconfirmed: false, source: 'CORRIDOR' as const };
    } else {
      totalKurus += effectiveTollAmount(backward[0])!;
      stale ||= evaluateTollTariffStaleness(backward[0], settings, now).stale;
    }
  }
  return { id: selected.id, name: selected.name, amountKurus: totalKurus, missing: false, stale, directionUnconfirmed, source: 'CORRIDOR' as const };
}

/** ALL participates in both the day and night overlap checks; DAY/NIGHT participate only in their own. */
export function tollTimeBandFlags(timeBand: TollTimeBand): { appliesDay: boolean; appliesNight: boolean } {
  return {
    appliesDay: timeBand === 'ALL' || timeBand === 'DAY',
    appliesNight: timeBand === 'ALL' || timeBand === 'NIGHT',
  };
}

export type TollPricingSettings = {
  staleAfterDays: number;
  warnOnNewYearRollover: boolean;
};

const DEFAULT_TOLL_PRICING_SETTINGS: TollPricingSettings = {
  staleAfterDays: 180,
  warnOnNewYearRollover: false,
};

export async function getTollPricingSettings(): Promise<TollPricingSettings> {
  const [row] = await db.select().from(tollPricingSettings).where(eq(tollPricingSettings.id, 1)).limit(1);
  if (!row) return DEFAULT_TOLL_PRICING_SETTINGS;
  return {
    staleAfterDays: row.staleAfterDays,
    warnOnNewYearRollover: row.warnOnNewYearRollover,
  };
}

export async function updateTollPricingSettings(input: TollPricingSettings & { updatedBy: string }) {
  const now = new Date();
  const [row] = await db.insert(tollPricingSettings).values({
    id: 1,
    staleAfterDays: input.staleAfterDays,
    warnOnNewYearRollover: input.warnOnNewYearRollover,
    updatedAt: now,
    updatedBy: input.updatedBy,
  }).onConflictDoUpdate({
    target: tollPricingSettings.id,
    set: {
      staleAfterDays: input.staleAfterDays,
      warnOnNewYearRollover: input.warnOnNewYearRollover,
      updatedAt: now,
      updatedBy: input.updatedBy,
    },
  }).returning();
  return row;
}

export type TollTariffBandResolution =
  | { status: 'RESOLVED'; band: 'ALL' | 'DAY' | 'NIGHT'; allOnly?: boolean }
  | { status: 'UNCONFIGURED'; reason: 'MISSING_CUTOVER' | 'INVALID_CUTOVER' };

type TariffBandCandidate = {
  timeBand?: TollTimeBand | null;
  appliesDay: boolean;
  appliesNight: boolean;
};

function hasValidCutover(point: { dayStartHour: number | null; nightStartHour: number | null }): boolean {
  const dayStartHour = point.dayStartHour;
  const nightStartHour = point.nightStartHour;
  return dayStartHour != null && nightStartHour != null
    && Number.isInteger(dayStartHour)
    && Number.isInteger(nightStartHour)
    && dayStartHour >= 0 && dayStartHour <= 23
    && nightStartHour >= 0 && nightStartHour <= 23
    && dayStartHour !== nightStartHour;
}

function istanbulCalendarHour(at: Date): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at).find((part) => part.type === 'hour')?.value;
  return Number(hour);
}

/**
 * Which time band is in effect for a given instant, per a toll point's own
 * day/night cutover hours. Istanbul is deliberately explicit here: server
 * timezone must never affect a toll quote. A point with no cutover keeps the
 * historical DAY fallback for callers that only need a legacy band; tariff
 * pricing must use resolveTariffBandForPoint below so FERRY configuration gaps
 * cannot be mistaken for DAY.
 */
export function resolveActiveTimeBandForPoint(at: Date, point: { dayStartHour: number | null; nightStartHour: number | null }): 'DAY' | 'NIGHT' {
  if (!hasValidCutover(point)) return 'DAY';
  const hour = istanbulCalendarHour(at);
  const { dayStartHour, nightStartHour } = point;
  if (dayStartHour! < nightStartHour!) {
    return hour >= dayStartHour! && hour < nightStartHour! ? 'DAY' : 'NIGHT';
  }
  // Overnight-wrapping day window (e.g. dayStartHour=22, nightStartHour=6).
  return hour >= dayStartHour! || hour < nightStartHour! ? 'DAY' : 'NIGHT';
}

/**
 * Resolves the tariff band shared by every toll pricing/display path.
 * Legacy ALL rows remain valid without point cutover hours. A FERRY that has
 * DAY/NIGHT rows must have a valid cutover; otherwise it is explicitly
 * unconfigured rather than silently priced as DAY.
 */
export function resolveTariffBandForPoint(
  at: Date,
  point: { type?: string | null; dayStartHour: number | null; nightStartHour: number | null },
  tariffs: TariffBandCandidate[],
): TollTariffBandResolution {
  // Ferries use one price per vehicle class + ordered gate pair. Historical
  // DAY/NIGHT rows are intentionally ignored by the ALL resolution instead
  // of making ferry quotes depend on clock time.
  if (point.type === 'FERRY') return { status: 'RESOLVED', band: 'ALL', allOnly: true };
  const hasSpecificBand = tariffs.some((tariff) =>
    tariff.timeBand === 'DAY' || tariff.timeBand === 'NIGHT'
      || (tariff.timeBand == null && tariff.appliesDay !== tariff.appliesNight));
  if (!hasSpecificBand) return { status: 'RESOLVED', band: 'ALL' };
  return { status: 'RESOLVED', band: resolveActiveTimeBandForPoint(at, point) };
}

export function tariffAppliesToBand(
  tariff: TariffBandCandidate,
  resolution: Extract<TollTariffBandResolution, { status: 'RESOLVED' }>,
): boolean {
  if (resolution.band === 'ALL' && resolution.allOnly) {
    return tariff.timeBand === 'ALL' || (tariff.timeBand == null && tariff.appliesDay && tariff.appliesNight);
  }
  if (resolution.band === 'ALL') return tariff.appliesDay || tariff.appliesNight;
  return resolution.band === 'DAY' ? tariff.appliesDay : tariff.appliesNight;
}

export type TollStaleReason = 'AGE' | 'YEAR_ROLLOVER' | 'SOURCE_EFFECTIVE_DATE_OLD' | 'QUERY_DATE_OLD';

/**
 * A tariff is stale when it has not been reviewed (manual edit or automatic
 * source fetch) within the configured window, or — separately — when the
 * calendar year has turned over since its last review and year-rollover
 * warnings are enabled. Inactive tariffs are never flagged.
 *
 * SOURCE_EFFECTIVE_DATE_OLD is a distinct, independent check: even a row
 * that was just re-verified today (manualUpdatedAt/sourceFetchedAt fresh)
 * can quote an official page whose OWN stated effective date
 * (validFrom) is old — e.g. KGM's Yavuz Sultan Selim Köprüsü page, live-
 * fetched, still states a tariff "16/08/2024 saat 00:00'dan itibaren
 * geçerli" two years later. Re-confirming the URL loads does not confirm
 * the tariff itself is current, so this reason is evaluated purely off
 * validFrom age, never off when the row was last touched.
 *
 * QUERY_DATE_OLD is the same idea for a source that states NO effective
 * date at all — e.g. OTOYOL A.Ş.'s or the YSS Köprüsü/Kuzey Marmara
 * Otoyolu operator's live gate-pair calculators, which return a figure
 * with no "yürürlük tarihi" printed anywhere. There, queriedAt (the date
 * an admin/agent personally queried the calculator for that figure) is the
 * only honest baseline, so it is evaluated in validFrom's place — never
 * both at once, since a row with a real validFrom does not need one.
 */
export function evaluateTollTariffStaleness(
  tariff: { active: boolean; manualUpdatedAt: Date | null; sourceFetchedAt: Date | null; createdAt: Date; validFrom?: Date | null; queriedAt?: Date | null },
  settings: TollPricingSettings,
  now: Date,
): { stale: boolean; reasons: TollStaleReason[]; lastReviewedAt: Date } {
  // queriedAt is review evidence too: it records when a calculator was
  // personally checked, even when no source fetch or manual amount edit ran.
  const lastReviewedAt = [tariff.manualUpdatedAt, tariff.sourceFetchedAt, tariff.queriedAt, tariff.createdAt]
    .filter((value): value is Date => value != null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? tariff.createdAt;
  if (!tariff.active) return { stale: false, reasons: [], lastReviewedAt };
  const reasons: TollStaleReason[] = [];
  const ageDays = (now.getTime() - lastReviewedAt.getTime()) / (24 * 60 * 60 * 1000);
  if (ageDays > settings.staleAfterDays) reasons.push('AGE');
  if (settings.warnOnNewYearRollover && now.getFullYear() > lastReviewedAt.getFullYear()) reasons.push('YEAR_ROLLOVER');
  // validFrom is an effective-start boundary, not a freshness timestamp.
  // For date-less calculator tariffs queriedAt is the separate evidence
  // baseline; never invent an effective date.
  if (!tariff.validFrom && tariff.queriedAt) {
    const queryDateAgeDays = (now.getTime() - tariff.queriedAt.getTime()) / (24 * 60 * 60 * 1000);
    if (queryDateAgeDays > settings.staleAfterDays) reasons.push('QUERY_DATE_OLD');
  }
  return { stale: reasons.length > 0, reasons, lastReviewedAt };
}

export type InactiveTollTariffClassification = 'DISPOSABLE_DRAFT' | 'HISTORICAL';

/** Inactive blank scaffolds are safe UI drafts; inactive priced rows are history. */
export function classifyInactiveTollTariff(input: {
  active: boolean;
  amountKurus?: number | null;
  automaticAmountKurus?: number | null;
  manualAmountKurus?: number | null;
}): InactiveTollTariffClassification | null {
  if (input.active) return null;
  const amount = input.amountKurus ?? input.manualAmountKurus ?? input.automaticAmountKurus;
  return amount == null ? 'DISPOSABLE_DRAFT' : 'HISTORICAL';
}

export function effectiveTollAmount(input: {
  automaticAmountKurus?: number | null;
  manualAmountKurus?: number | null;
}): number | null {
  return input.manualAmountKurus ?? input.automaticAmountKurus ?? null;
}

export function parseTollDate(value: string | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('Geçerlilik tarihi geçersiz.');
  return parsed;
}

export function assertTollDateRange(validFrom: Date | null, validUntil: Date | null) {
  if (validFrom && validUntil && validFrom > validUntil) {
    throw new Error('Geçerlilik bitişi başlangıçtan önce olamaz.');
  }
}

export function safeOfficialSourceUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Kaynak adresi geçerli bir URL olmalıdır.');
  }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new Error('Resmî kaynak yalnız kimlik bilgisi içermeyen HTTPS adresi olabilir.');
  }
  return url.toString();
}

/**
 * Only these domains count as an "official source" for a toll tariff:
 * KGM itself (incl. its live toll-query tool) and each bridge/tunnel's own
 * operator. Third-party aggregator sites (e.g. sigortam.net-style pages) are
 * never acceptable, even if their numbers happen to be correct — they are
 * not the authority and can silently drift out of date.
 */
const OFFICIAL_TOLL_SOURCE_DOMAINS = [
  'kgm.gov.tr',
  'vatandas.kgm.gov.tr',
  'avrasyatuneli.com',
  '1915canakkale.com',
  // OTOYOL A.Ş. — operator of Osmangazi Köprüsü and the İstanbul-İzmir
  // Otoyolu (O-5); its public fee-calculator page is the closest thing to
  // an official tariff table for these gate-pair-priced crossings.
  'otoyolas.com.tr',
  'isletme.otoyolas.com.tr',
  // YSS Köprüsü ve Kuzey Marmara Otoyolu'nun işletmecisi — its own
  // "Ücret Hesaplama" gate-pair calculator (registered 2026-08-26) is the
  // authoritative source for the Kuzey Marmara Otoyolu (O-7) highway
  // sections, which KGM's own YSS PDF/aspx pages do not cover at all.
  'ysskoprusuveotoyolu.com.tr',
];

export function isOfficialTollSourceUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  let hostname: string;
  try {
    hostname = new URL(value.trim()).hostname.toLowerCase();
  } catch {
    return false;
  }
  return OFFICIAL_TOLL_SOURCE_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

/**
 * Server-computed verification: an amount may only be saved alongside a
 * matching-domain official source URL. This replaces any admin-ticked
 * checkbox — the admin cannot self-certify a source as official, the server
 * decides from the URL's domain alone.
 */
export function assertVerifiedSourceForAmount(amountKurus: number | null, sourceUrl: string | null): void {
  if (amountKurus == null) return;
  if (!isOfficialTollSourceUrl(sourceUrl)) {
    throw new Error('Bir TRY tutarı yalnızca KGM (vatandas.kgm.gov.tr dahil), Avrasya Tüneli veya 1915 Çanakkale Köprüsü gibi resmî bir kaynak adresiyle birlikte kaydedilebilir.');
  }
}

/**
 * Same verification pattern as amounts: a banned-vehicle-classes claim
 * (including a confirmed-empty "nothing banned here" list) may only be saved
 * alongside a matching-domain official source URL — never self-certified,
 * never left to admin judgement about what counts as "official".
 */
export function assertVerifiedSourceForBan(bannedVehicleClasses: string[] | null, sourceUrl: string | null): void {
  if (bannedVehicleClasses == null) return;
  if (!isOfficialTollSourceUrl(sourceUrl)) {
    throw new Error('Yasaklı araç sınıfları listesi (boş liste dahil) yalnızca resmî bir kaynak adresiyle birlikte kaydedilebilir.');
  }
}

/**
 * Mirrors assertPricingModeMatchesGatePair at the point level: the owner's
 * rule is that bridges/tunnels are always a flat per-crossing fee (open
 * system, summed across genuinely distinct crossings) while ferry and highway
 * segments are priced by entry+exit gate pair. Enforced at write time so
 * the type/pricingMode pairing can never drift apart, even though existing
 * data already happens to be consistent.
 */
export function assertTypeMatchesPricingMode(type: 'BRIDGE' | 'TUNNEL' | 'HIGHWAY' | 'FERRY', pricingMode: TollPricingMode): void {
  if ((type === 'BRIDGE' || type === 'TUNNEL') && pricingMode !== 'FLAT') {
    throw new Error('Köprü ve tünel noktaları her zaman sabit ücretli (FLAT) olmalıdır.');
  }
  if ((type === 'HIGHWAY' || type === 'FERRY') && pricingMode !== 'GATE_PAIR') {
    throw new Error('Otoyol ve feribot noktaları her zaman giriş/çıkış gişe çiftiyle (GATE_PAIR) ücretlendirilmelidir.');
  }
}

/** Ferries and highways have one all-day row per class and ordered gate pair. */
export function assertTariffTimeBandForPointType(
  type: 'BRIDGE' | 'TUNNEL' | 'HIGHWAY' | 'FERRY',
  timeBand: TollTimeBand,
): void {
  if ((type === 'FERRY' || type === 'HIGHWAY') && timeBand !== 'ALL') {
    throw new Error(`${type === 'FERRY' ? 'Feribot' : 'Otoyol'} tarifesi gündüz/gece ayrımı kullanmaz; tek fiyat Tüm Gün olarak kaydedilmelidir.`);
  }
}

/**
 * Same verification pattern again: a tolling-direction claim (ONE_WAY /
 * TWO_WAY_SAME / TWO_WAY_DIRECTIONAL) may only be saved alongside a
 * matching-domain official source URL — never self-certified. Leaving
 * direction null (unconfirmed) never requires a source.
 */
export function assertVerifiedSourceForDirection(tollDirection: string | null, sourceUrl: string | null): void {
  if (tollDirection == null) return;
  if (!isOfficialTollSourceUrl(sourceUrl)) {
    throw new Error('Geçiş yönü bilgisi yalnızca resmî bir kaynak adresiyle birlikte kaydedilebilir.');
  }
}

/**
 * Enforces the two-system separation at the tariff-row level: FLAT points are
 * charged one fixed amount per crossing and must never carry an entry/exit
 * gate pair; GATE_PAIR points are priced by their specific pair and must
 * never be assigned a single flat amount with no pair. Point-type invariants
 * are enforced separately by assertTypeMatchesPricingMode.
 */
export function assertPricingModeMatchesGatePair(
  pricingMode: TollPricingMode,
  entryGateName: string | null | undefined,
  exitGateName: string | null | undefined,
): void {
  const hasGatePair = !!entryGateName && !!exitGateName;
  if (pricingMode === 'FLAT' && hasGatePair) {
    throw new Error('Bu sabit ücretli geçiş noktasıdır — giriş/çıkış gişe çifti girilemez, tek bir tutar geçerlidir.');
  }
  if (pricingMode === 'GATE_PAIR' && !hasGatePair) {
    throw new Error('Bu geçiş noktası gişe çiftiyle ücretlendirilir — tek bir sabit tutar girilemez, giriş ve çıkış gişesi birlikte seçilmelidir.');
  }
}

export function rangesOverlap(
  leftFrom: Date | null,
  leftUntil: Date | null,
  rightFrom: Date | null,
  rightUntil: Date | null,
) {
  const leftStart = leftFrom?.getTime() ?? Number.NEGATIVE_INFINITY;
  const leftEnd = leftUntil?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightStart = rightFrom?.getTime() ?? Number.NEGATIVE_INFINITY;
  const rightEnd = rightUntil?.getTime() ?? Number.POSITIVE_INFINITY;
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

export async function assertNoActiveTariffOverlap(input: {
  tollPointId: string;
  vehicleClass: TollVehicleClass;
  timeBand: TollTimeBand;
  validFrom: Date | null;
  validUntil: Date | null;
  excludeId?: string;
  /**
   * Only meaningful for a GATE_PAIR point: two tariffs at the same point and
   * class can legitimately coexist as long as they price a different gate
   * pair (e.g. Osmangazi Köprüsü(İzmir Yönü)->İzmir vs. the reverse). A FLAT
   * point never sets these, so the null/null vs null/null case still
   * collides exactly as before.
   */
  entryGateName?: string | null;
  exitGateName?: string | null;
}, executor: Pick<typeof db, 'select'> = db) {
  const rows = await executor.select({
    id: tollTariffs.id,
    validFrom: tollTariffs.validFrom,
    validUntil: tollTariffs.validUntil,
    appliesDay: tollTariffs.appliesDay,
    appliesNight: tollTariffs.appliesNight,
    entryGateName: tollTariffs.entryGateName,
    exitGateName: tollTariffs.exitGateName,
  }).from(tollTariffs).where(and(
    eq(tollTariffs.tollPointId, input.tollPointId),
    eq(tollTariffs.vehicleClass, input.vehicleClass),
    eq(tollTariffs.active, true),
  ));
  const incoming = tollTimeBandFlags(input.timeBand);
  const incomingEntry = input.entryGateName ?? null;
  const incomingExit = input.exitGateName ?? null;
  if (rows.some((row) => {
    if (row.id === input.excludeId) return false;
    const gatePairConflict = (row.entryGateName ?? null) === incomingEntry && (row.exitGateName ?? null) === incomingExit;
    if (!gatePairConflict) return false;
    const bandConflict = (row.appliesDay && incoming.appliesDay) || (row.appliesNight && incoming.appliesNight);
    return bandConflict && rangesOverlap(input.validFrom, input.validUntil, row.validFrom, row.validUntil);
  })) {
    throw new Error('Bu araç sınıfı ve gişe çifti için aynı geçerlilik aralığında aktif bir tarife zaten var.');
  }
}

export async function getTollManagementData() {
  const [points, tariffs, alternatives, routes, items, settings] = await Promise.all([
    db.select({
      id: tollPoints.id,
      name: tollPoints.name,
      type: tollPoints.type,
      active: tollPoints.active,
      dayStartHour: tollPoints.dayStartHour,
      nightStartHour: tollPoints.nightStartHour,
      notes: tollPoints.notes,
      classificationLabel: tollPoints.classificationLabel,
      bannedVehicleClasses: tollPoints.bannedVehicleClasses,
      bannedVehicleClassesSourceUrl: tollPoints.bannedVehicleClassesSourceUrl,
      tollDirection: tollPoints.tollDirection,
      tollDirectionSourceUrl: tollPoints.tollDirectionSourceUrl,
      tollDirectionNotes: tollPoints.tollDirectionNotes,
      pricingMode: tollPoints.pricingMode,
      createdAt: tollPoints.createdAt,
      updatedAt: tollPoints.updatedAt,
    }).from(tollPoints).orderBy(asc(tollPoints.displayOrder), asc(tollPoints.name), asc(tollPoints.id)),
    db.select({
      id: tollTariffs.id,
      tollPointId: tollTariffs.tollPointId,
      vehicleClass: tollTariffs.vehicleClass,
      displayOrder: tollTariffs.displayOrder,
      amountKurus: tollTariffs.amountKurus,
      automaticAmountKurus: tollTariffs.automaticAmountKurus,
      manualAmountKurus: tollTariffs.manualAmountKurus,
      sourceName: tollTariffs.sourceName,
      sourceUrl: tollTariffs.sourceUrl,
      sourceVerified: tollTariffs.sourceVerified,
      sourceFetchedAt: tollTariffs.sourceFetchedAt,
      manualUpdatedAt: tollTariffs.manualUpdatedAt,
      queriedAt: tollTariffs.queriedAt,
      timeBand: tollTariffs.timeBand,
      validFrom: tollTariffs.validFrom,
      validUntil: tollTariffs.validUntil,
      active: tollTariffs.active,
      entryGateName: tollTariffs.entryGateName,
      exitGateName: tollTariffs.exitGateName,
      direction: tollTariffs.direction,
      createdAt: tollTariffs.createdAt,
      updatedAt: tollTariffs.updatedAt,
    }).from(tollTariffs).orderBy(asc(tollTariffs.vehicleClass), desc(tollTariffs.updatedAt)),
    db.select({
      id: routeTollAlternatives.id,
      routeId: routeTollAlternatives.routeId,
      name: routeTollAlternatives.name,
      active: routeTollAlternatives.active,
      isDefault: routeTollAlternatives.isDefault,
      displayOrder: routeTollAlternatives.displayOrder,
      needsReview: routeTollAlternatives.needsReview,
      reviewNote: routeTollAlternatives.reviewNote,
    }).from(routeTollAlternatives).orderBy(
      asc(routeTollAlternatives.routeId),
      desc(routeTollAlternatives.isDefault),
      asc(routeTollAlternatives.displayOrder),
      asc(routeTollAlternatives.name),
      asc(routeTollAlternatives.id),
    ),
    db.select({ id: transferRoutes.id, name: transferRoutes.name, active: transferRoutes.active })
      .from(transferRoutes).orderBy(asc(transferRoutes.displayOrder), asc(transferRoutes.name), asc(transferRoutes.id)),
    db.select({
      alternativeId: routeTollAlternativeItems.alternativeId,
      tollPointId: routeTollAlternativeItems.tollPointId,
      displayOrder: routeTollAlternativeItems.displayOrder,
      entryGateName: routeTollAlternativeItems.entryGateName,
      exitGateName: routeTollAlternativeItems.exitGateName,
    }).from(routeTollAlternativeItems).orderBy(asc(routeTollAlternativeItems.displayOrder)),
    getTollPricingSettings(),
  ]);
  const itemsByAlternativeId = new Map<string, typeof items>();
  for (const item of items) {
    const alternativeItems = itemsByAlternativeId.get(item.alternativeId);
    if (alternativeItems) alternativeItems.push(item);
    else itemsByAlternativeId.set(item.alternativeId, [item]);
  }
  for (const alternativeItems of itemsByAlternativeId.values()) {
    alternativeItems.sort((left, right) => left.displayOrder - right.displayOrder);
  }
  const now = new Date();
  return {
    points,
    tariffs: tariffs.map((tariff) => {
      const staleness = evaluateTollTariffStaleness(tariff, settings, now);
      return {
        ...tariff,
        sourceMode: tariff.manualAmountKurus != null ? 'MANUAL_OVERRIDE' : 'AUTOMATIC',
        stale: staleness.stale,
        staleReasons: staleness.reasons,
        lastReviewedAt: staleness.lastReviewedAt,
      };
    }),
    alternatives: alternatives.map((alternative) => ({
      ...alternative,
      ...(() => {
        const alternativeItems = itemsByAlternativeId.get(alternative.id) ?? [];
        const gatePairs: Record<string, { entryGateName: string; exitGateName: string }> = {};
        for (const item of alternativeItems) {
          if (item.entryGateName && item.exitGateName) {
            gatePairs[item.tollPointId] = { entryGateName: item.entryGateName, exitGateName: item.exitGateName };
         }
        }
        return {
          gatePairs,
          pointIds: alternativeItems.map((item) => item.tollPointId),
        };
      })(),
    })),
    routes,
    vehicleClasses: TOLL_VEHICLE_CLASSES,
    settings,
  };
}

export async function getRouteTollAlternatives(routeId: string, vehicleId?: string, pickupAt?: Date) {
  const now = new Date();
  const activeAt = pickupAt ?? now;
  const [route] = await db.select({ id: transferRoutes.id, active: transferRoutes.active })
    .from(transferRoutes).where(eq(transferRoutes.id, routeId)).limit(1);
  if (!route) throw new Error('Güzergâh bulunamadı.');

  const [vehicle] = vehicleId
    ? await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1)
    : [null];
  if (vehicleId && !vehicle) throw new Error('Araç bulunamadı.');

  const alternatives = await db.select().from(routeTollAlternatives).where(and(
    eq(routeTollAlternatives.routeId, routeId),
    eq(routeTollAlternatives.active, true),
  )).orderBy(
    desc(routeTollAlternatives.isDefault),
    asc(routeTollAlternatives.displayOrder),
    asc(routeTollAlternatives.name),
    asc(routeTollAlternatives.id),
  );
  if (!alternatives.length) return { alternatives: [], defaultAlternativeId: null };

  const alternativeIds = alternatives.map((alternative) => alternative.id);
  const items = await db.select().from(routeTollAlternativeItems).where(inArray(routeTollAlternativeItems.alternativeId, alternativeIds))
    .orderBy(asc(routeTollAlternativeItems.displayOrder));
  const pointIds = [...new Set(items.map((item) => item.tollPointId))];
  const points = pointIds.length
    ? await db.select().from(tollPoints).where(inArray(tollPoints.id, pointIds))
    : [];
  const pointById = new Map(points.map((point) => [point.id, point]));
  const pointClasses = new Map<string, string>();
  if (vehicle) {
    const assignments = await db.select({
      tollPointId: vehicleTollPointClasses.tollPointId,
      vehicleClass: vehicleTollPointClasses.vehicleClass,
    }).from(vehicleTollPointClasses).where(and(
      eq(vehicleTollPointClasses.vehicleId, vehicle.id),
      inArray(vehicleTollPointClasses.tollPointId, pointIds),
    ));
    for (const assignment of assignments) pointClasses.set(assignment.tollPointId, assignment.vehicleClass);
  }
  const tariffClasses = [...new Set(pointIds.map((pointId) => pointClasses.get(pointId)).filter((value): value is string => !!value))] as TollVehicleClass[];
  const allTariffs = tariffClasses.length && pointIds.length
    ? await db.select().from(tollTariffs).where(and(
      inArray(tollTariffs.tollPointId, pointIds),
       inArray(tollTariffs.vehicleClass, tariffClasses),
      eq(tollTariffs.active, true),
      or(isNull(tollTariffs.validFrom), lte(tollTariffs.validFrom, now)),
      or(isNull(tollTariffs.validUntil), gte(tollTariffs.validUntil, now)),
    ))
    : [];
  return {
    defaultAlternativeId: alternatives.find((alternative) => alternative.isDefault)?.id ?? null,
    alternatives: alternatives.map((alternative) => {
      const alternativeItems = items.filter((item) => item.alternativeId === alternative.id);
      const missingTariffPointNames: string[] = [];
      const bannedPointNames: string[] = [];
      let totalKurus = 0;
      let hasPricedAmount = true;
      for (const item of alternativeItems) {
        const point = pointById.get(item.tollPointId);
        if (!point) { missingTariffPointNames.push('Bilinmeyen geçiş noktası'); hasPricedAmount = false; continue; }
        if (!point.active) { missingTariffPointNames.push(`${point.name} (pasif)`); hasPricedAmount = false; continue; }
        if (!vehicle) { hasPricedAmount = false; continue; }
         const pointClass = pointClasses.get(point.id);
         const bannedClasses = (point.bannedVehicleClasses ?? []) as string[];
         if (pointClass && bannedClasses.includes(pointClass)) {
          bannedPointNames.push(point.name);
          continue;
        }
         if (!pointClass) { missingTariffPointNames.push(point.name); hasPricedAmount = false; continue; }
        // A GATE_PAIR point (e.g. Osmangazi Köprüsü / O-5) has no single
        // "the" tariff for the point — a matching tariff must also carry the
        // exact entry/exit gate pair configured on this route item.
        if (point.pricingMode === 'GATE_PAIR' && (!item.entryGateName || !item.exitGateName)) {
          missingTariffPointNames.push(`${point.name} (gişe çifti seçilmedi)`);
          hasPricedAmount = false;
          continue;
        }
         const pointTariffs = allTariffs.filter((tariff) =>
           tariff.tollPointId === point.id && tariff.vehicleClass === pointClass);
         const band = resolveTariffBandForPoint(activeAt, point, pointTariffs);
         if (band.status === 'UNCONFIGURED') {
           missingTariffPointNames.push(`${point.name} (gündüz/gece saatleri yapılandırılmadı)`);
           hasPricedAmount = false;
           continue;
         }
         const matchingTariffs = pointTariffs.filter((tariff) => {
           if (!tariffAppliesToBand(tariff, band)) return false;
           if (point.pricingMode !== 'GATE_PAIR') return true;
          return tariff.entryGateName === item.entryGateName && tariff.exitGateName === item.exitGateName;
        });
        // Exactly one match is required for a usable amount — zero is a
        // missing tariff, and more than one is a data-integrity problem
        // (duplicate overlapping rows); neither can be safely summed.
        if (matchingTariffs.length !== 1) { missingTariffPointNames.push(point.name); hasPricedAmount = false; continue; }
        const amount = effectiveTollAmount(matchingTariffs[0]);
        if (amount == null) { missingTariffPointNames.push(point.name); hasPricedAmount = false; continue; }
        totalKurus += amount;
      }
      return {
        id: alternative.id,
        name: alternative.name,
        active: alternative.active,
        isDefault: alternative.isDefault,
        displayOrder: alternative.displayOrder,
        needsReview: alternative.needsReview,
        reviewNote: alternative.reviewNote,
        pointIds: alternativeItems.map((item) => item.tollPointId),
        pointNames: alternativeItems.map((item) => pointById.get(item.tollPointId)?.name ?? 'Bilinmeyen geçiş'),
       gatePairs: Object.fromEntries(alternativeItems
         .filter((item) => item.entryGateName && item.exitGateName)
         .map((item) => [item.tollPointId, { entryGateName: item.entryGateName!, exitGateName: item.exitGateName! }])),
        // A banned point makes this alternative permanently unusable for the
        // vehicle (not just "data incomplete") — surfaced separately so the
        // admin picks a genuinely usable alternative instead of waiting on data entry.
        isBannedForSelectedVehicle: bannedPointNames.length > 0,
        bannedPointNames,
        isPricedForSelectedVehicle: !vehicle || (missingTariffPointNames.length === 0 && bannedPointNames.length === 0),
        missingTariffPointNames,
        // Tek yönlü karşılaştırma tutarı — yalnızca seçili araç için tüm
        // noktalar fiyatlanmış VE yasaklı değilse gerçek bir toplamdır;
        // aksi halde null (asla 0 veya eksik veriyle tahmini bir toplam).
        // Bu bir müşteri teklifi değildir, yalnızca admin karşılaştırması içindir.
        totalKurus: vehicle && hasPricedAmount && bannedPointNames.length === 0 ? totalKurus : null,
      };
    }),
  };
}

export function chooseDefaultRouteTollAlternative(
  alternatives: Array<{ id: string; isDefault: boolean; needsReview: boolean }>,
): string | null {
  if (!alternatives.length) return null;
  const defaults = alternatives.filter((alternative) => alternative.isDefault);
  if (defaults.length === 0 && alternatives.every((alternative) => alternative.needsReview)) {
    return null;
  }
  if (defaults.length !== 1) {
    throw new Error('Bu rota için aktif geçiş alternatifleri var ancak tek bir varsayılan alternatif tanımlı değil. Fiyat üretimi güvenle durduruldu.');
  }
  return defaults[0].id;
}

export async function getDefaultRouteTollAlternative(routeId: string): Promise<string | null> {
  const alternatives = await db.select({
    id: routeTollAlternatives.id,
    isDefault: routeTollAlternatives.isDefault,
    needsReview: routeTollAlternatives.needsReview,
  })
    .from(routeTollAlternatives)
    .where(and(
      eq(routeTollAlternatives.routeId, routeId),
      eq(routeTollAlternatives.active, true),
    ))
    .orderBy(
      desc(routeTollAlternatives.isDefault),
      asc(routeTollAlternatives.displayOrder),
      asc(routeTollAlternatives.name),
      asc(routeTollAlternatives.id),
    );
  return chooseDefaultRouteTollAlternative(alternatives);
}

export async function hasActiveRouteTollAlternatives(routeId: string): Promise<boolean> {
  const [alternative] = await db.select({ id: routeTollAlternatives.id })
    .from(routeTollAlternatives)
    .where(and(
      eq(routeTollAlternatives.routeId, routeId),
      eq(routeTollAlternatives.active, true),
    ))
    .limit(1);
  return Boolean(alternative);
}