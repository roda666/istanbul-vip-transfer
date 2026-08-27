import 'server-only';

import { and, asc, desc, eq, inArray, isNull, lte, or, gte } from 'drizzle-orm';
import { db } from '@/db';
import {
  adminUsers,
  routeTollAlternativeItems,
  routeTollAlternatives,
  tollPoints,
  tollPricingSettings,
  tollTariffs,
  transferRoutes,
  vehicleTollPointClasses,
  vehicles,
} from '@/db/schema';
import { VEHICLE_TYPE_OPTIONS, VEHICLE_TYPE_VALUES, type VehicleType } from '@/lib/vehicle-options';

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
  warnOnNewYearRollover: true,
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

/**
 * Which time band is in effect for a given instant, per a toll point's own
 * day/night cutover hours. A point with no day/night hours configured has no
 * differentiation — everything on it is treated as the DAY band, since its
 * tariffs are entered as ALL/DAY and there is never a NIGHT-only row to miss.
 */
export function resolveActiveTimeBandForPoint(at: Date, point: { dayStartHour: number | null; nightStartHour: number | null }): 'DAY' | 'NIGHT' {
  const { dayStartHour, nightStartHour } = point;
  if (dayStartHour == null || nightStartHour == null || dayStartHour === nightStartHour) return 'DAY';
  const hour = at.getHours();
  if (dayStartHour < nightStartHour) {
    return hour >= dayStartHour && hour < nightStartHour ? 'DAY' : 'NIGHT';
  }
  // Overnight-wrapping day window (e.g. dayStartHour=22, nightStartHour=6).
  return hour >= dayStartHour || hour < nightStartHour ? 'DAY' : 'NIGHT';
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
  const lastReviewedAt = [tariff.manualUpdatedAt, tariff.sourceFetchedAt, tariff.createdAt]
    .filter((value): value is Date => value != null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? tariff.createdAt;
  if (!tariff.active) return { stale: false, reasons: [], lastReviewedAt };
  const reasons: TollStaleReason[] = [];
  const ageDays = (now.getTime() - lastReviewedAt.getTime()) / (24 * 60 * 60 * 1000);
  if (ageDays > settings.staleAfterDays) reasons.push('AGE');
  if (settings.warnOnNewYearRollover && now.getFullYear() > lastReviewedAt.getFullYear()) reasons.push('YEAR_ROLLOVER');
  if (tariff.validFrom) {
    const effectiveDateAgeDays = (now.getTime() - tariff.validFrom.getTime()) / (24 * 60 * 60 * 1000);
    if (effectiveDateAgeDays > settings.staleAfterDays) reasons.push('SOURCE_EFFECTIVE_DATE_OLD');
  } else if (tariff.queriedAt) {
    const queryDateAgeDays = (now.getTime() - tariff.queriedAt.getTime()) / (24 * 60 * 60 * 1000);
    if (queryDateAgeDays > settings.staleAfterDays) reasons.push('QUERY_DATE_OLD');
  }
  return { stale: reasons.length > 0, reasons, lastReviewedAt };
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
 * The fleet vehicle-TYPE taxonomy (minivan/minibus/midibus/bus, from
 * vehicles.pricingClass — see lib/vehicle-options.ts), reused here ONLY as
 * the value set for a toll point's bannedVehicleTypes field. This is a
 * categorical ban independent of TOLL_VEHICLE_CLASSES: an operator can ban
 * "Otobüs" outright even though a 2-axle bus would otherwise share
 * class_1/class_2 with an allowed car. Never derive one list from the other.
 */
export const TOLL_VEHICLE_TYPES = VEHICLE_TYPE_VALUES;
export type TollVehicleType = VehicleType;
export const TOLL_VEHICLE_TYPE_LABELS: Record<TollVehicleType, string> = Object.fromEntries(
  VEHICLE_TYPE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<TollVehicleType, string>;

/**
 * Same verification pattern as assertVerifiedSourceForBan, for the separate
 * vehicle-TYPE ban axis (see bannedVehicleTypes on toll_points).
 */
export function assertVerifiedSourceForVehicleTypeBan(bannedVehicleTypes: string[] | null, sourceUrl: string | null): void {
  if (bannedVehicleTypes == null) return;
  if (!isOfficialTollSourceUrl(sourceUrl)) {
    throw new Error('Yasaklı araç tipleri listesi (boş liste dahil) yalnızca resmî bir kaynak adresiyle birlikte kaydedilebilir.');
  }
}

/**
 * Mirrors assertPricingModeMatchesGatePair at the point level: the owner's
 * rule is that bridges/tunnels are always a flat per-crossing fee (open
 * system, summed across genuinely distinct crossings) while highway
 * segments are always priced by entry+exit gate pair (closed system,
 * intermediate stations never separately summed). Enforced at write time so
 * the type/pricingMode pairing can never drift apart, even though existing
 * data already happens to be consistent.
 */
export function assertTypeMatchesPricingMode(type: 'BRIDGE' | 'TUNNEL' | 'HIGHWAY', pricingMode: TollPricingMode): void {
  if ((type === 'BRIDGE' || type === 'TUNNEL') && pricingMode !== 'FLAT') {
    throw new Error('Köprü/tünel noktaları her zaman sabit ücretli (FLAT) olmalıdır — açık sistemde her geçiş kendi başına ücretlendirilir.');
  }
  if (type === 'HIGHWAY' && pricingMode !== 'GATE_PAIR') {
    throw new Error('Otoyol kesimleri her zaman giriş/çıkış gişe çiftiyle (GATE_PAIR) ücretlendirilmelidir — kapalı sistemde ara istasyonlar ayrı ayrı toplanmaz.');
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
 * Enforces the two-system separation the owner requires: a bridge/tunnel
 * (pricingMode FLAT) is charged one fixed amount per crossing and must never
 * carry an entry/exit gate pair; a highway segment (pricingMode GATE_PAIR)
 * is priced by its specific entry+exit gate pair and must never be assigned
 * a single flat amount with no gate pair. Both directions of the mismatch
 * are rejected outright — never silently coerced.
 */
export function assertPricingModeMatchesGatePair(
  pricingMode: TollPricingMode,
  entryGateName: string | null | undefined,
  exitGateName: string | null | undefined,
): void {
  const hasGatePair = !!entryGateName && !!exitGateName;
  if (pricingMode === 'FLAT' && hasGatePair) {
    throw new Error('Bu bir sabit ücretli (köprü/tünel) geçiş noktasıdır — giriş/çıkış gişe çifti girilemez, tek bir tutar geçerlidir.');
  }
  if (pricingMode === 'GATE_PAIR' && !hasGatePair) {
    throw new Error('Bu bir otoyol kesimidir — tek bir sabit tutar girilemez, giriş ve çıkış gişesi birlikte seçilmelidir.');
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
}) {
  const rows = await db.select({
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
    throw new Error('Bu araç sınıfı, zaman dilimi ve gişe çifti için aynı geçerlilik aralığında aktif bir tarife zaten var.');
  }
}

export async function getTollManagementData() {
  const [points, tariffs, alternatives, routes, items, admins, settings] = await Promise.all([
    db.select().from(tollPoints).orderBy(asc(tollPoints.name)),
    db.select().from(tollTariffs).orderBy(asc(tollTariffs.vehicleClass), desc(tollTariffs.updatedAt)),
    db.select().from(routeTollAlternatives).orderBy(asc(routeTollAlternatives.routeId), desc(routeTollAlternatives.isDefault), asc(routeTollAlternatives.displayOrder)),
    db.select({ id: transferRoutes.id, name: transferRoutes.name, active: transferRoutes.active })
      .from(transferRoutes).orderBy(asc(transferRoutes.name)),
    db.select().from(routeTollAlternativeItems).orderBy(asc(routeTollAlternativeItems.displayOrder)),
    db.select({ id: adminUsers.id, name: adminUsers.name }).from(adminUsers),
    getTollPricingSettings(),
  ]);
  const adminNames = new Map(admins.map((admin) => [admin.id, admin.name]));
  const now = new Date();
  return {
    points: points.map((point) => ({
      ...point,
      createdByName: point.createdBy ? adminNames.get(point.createdBy) ?? null : null,
      updatedByName: point.updatedBy ? adminNames.get(point.updatedBy) ?? null : null,
    })),
    tariffs: tariffs.map((tariff) => {
      const staleness = evaluateTollTariffStaleness(tariff, settings, now);
      return {
        ...tariff,
        sourceMode: tariff.manualAmountKurus != null ? 'MANUAL_OVERRIDE' : 'AUTOMATIC',
        updatedByName: tariff.updatedBy ? adminNames.get(tariff.updatedBy) ?? null : null,
        createdByName: tariff.createdBy ? adminNames.get(tariff.createdBy) ?? null : null,
        stale: staleness.stale,
        staleReasons: staleness.reasons,
        lastReviewedAt: staleness.lastReviewedAt,
      };
    }),
    alternatives: alternatives.map((alternative) => ({
      ...alternative,
      pointIds: items
        .filter((item) => item.alternativeId === alternative.id)
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((item) => item.tollPointId),
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
    ? await db.select({ id: vehicles.id, pricingClass: vehicles.pricingClass }).from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1)
    : [null];
  if (vehicleId && !vehicle) throw new Error('Araç bulunamadı.');

  const alternatives = await db.select().from(routeTollAlternatives).where(and(
    eq(routeTollAlternatives.routeId, routeId),
    eq(routeTollAlternatives.active, true),
  )).orderBy(desc(routeTollAlternatives.isDefault), asc(routeTollAlternatives.displayOrder));
  if (!alternatives.length) return { alternatives: [], defaultAlternativeId: null };

  const alternativeIds = alternatives.map((alternative) => alternative.id);
  const items = await db.select().from(routeTollAlternativeItems).where(inArray(routeTollAlternativeItems.alternativeId, alternativeIds))
    .orderBy(asc(routeTollAlternativeItems.displayOrder));
  const pointIds = [...new Set(items.map((item) => item.tollPointId))];
  const points = pointIds.length
    ? await db.select().from(tollPoints).where(inArray(tollPoints.id, pointIds))
    : [];
  // A vehicle's class is assigned per toll point (not globally), since
  // different operators can classify vehicles differently.
  const vehiclePointClasses = vehicle && pointIds.length
    ? await db.select().from(vehicleTollPointClasses).where(and(
      eq(vehicleTollPointClasses.vehicleId, vehicle.id),
      inArray(vehicleTollPointClasses.tollPointId, pointIds),
    ))
    : [];
  const classByPointId = new Map(vehiclePointClasses.map((row) => [row.tollPointId, row.vehicleClass]));
  const pointById = new Map(points.map((point) => [point.id, point]));
  // Each point may have its own day/night cutover, so the active band is
  // resolved per point rather than with one shared band filter.
  const pointBand = new Map(points.map((point) => [point.id, resolveActiveTimeBandForPoint(activeAt, point)]));

  const assignedClasses = [...new Set(vehiclePointClasses.map((row) => row.vehicleClass))];
  const allTariffs = assignedClasses.length && pointIds.length
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
        // Vehicle-TYPE ban (e.g. Avrasya Tüneli categorically bans "Otobüs")
        // is a separate, independent axis from the axle-based class ban
        // below — both must be checked, neither substitutes for the other.
        const bannedTypes = (point.bannedVehicleTypes ?? []) as string[];
        if (vehicle.pricingClass && bannedTypes.includes(vehicle.pricingClass)) {
          bannedPointNames.push(point.name);
          continue;
        }
        const vehicleClassAtPoint = classByPointId.get(point.id);
        const bannedClasses = (point.bannedVehicleClasses ?? []) as string[];
        if (vehicleClassAtPoint && bannedClasses.includes(vehicleClassAtPoint)) {
          bannedPointNames.push(point.name);
          continue;
        }
        if (!vehicleClassAtPoint) { missingTariffPointNames.push(point.name); hasPricedAmount = false; continue; }
        // A GATE_PAIR point (e.g. Osmangazi Köprüsü / O-5) has no single
        // "the" tariff for the point — a matching tariff must also carry the
        // exact entry/exit gate pair configured on this route item.
        if (point.pricingMode === 'GATE_PAIR' && (!item.entryGateName || !item.exitGateName)) {
          missingTariffPointNames.push(`${point.name} (gişe çifti seçilmedi)`);
          hasPricedAmount = false;
          continue;
        }
        const matchingTariffs = tariffs.filter((tariff) => {
          if (tariff.tollPointId !== point.id) return false;
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

export async function getDefaultRouteTollAlternative(routeId: string): Promise<string | null> {
  const alternatives = await db.select({ id: routeTollAlternatives.id, isDefault: routeTollAlternatives.isDefault })
    .from(routeTollAlternatives)
    .where(and(
      eq(routeTollAlternatives.routeId, routeId),
      eq(routeTollAlternatives.active, true),
    ))
    .orderBy(desc(routeTollAlternatives.isDefault), asc(routeTollAlternatives.displayOrder));
  if (!alternatives.length) return null;
  const defaults = alternatives.filter((alternative) => alternative.isDefault);
  if (defaults.length !== 1) {
    throw new Error('Bu rota için aktif geçiş alternatifleri var ancak tek bir varsayılan alternatif tanımlı değil. Fiyat üretimi güvenle durduruldu.');
  }
  return defaults[0].id;
}