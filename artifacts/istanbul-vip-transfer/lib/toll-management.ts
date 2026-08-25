import 'server-only';

import { and, asc, desc, eq, inArray, isNull, lte, or, gte } from 'drizzle-orm';
import { db } from '@/db';
import {
  adminUsers,
  routeTollAlternativeItems,
  routeTollAlternatives,
  tollPoints,
  tollTariffs,
  transferRoutes,
  vehicles,
} from '@/db/schema';

export const TOLL_VEHICLE_CLASSES = ['minivan', 'minibus', 'midibus', 'bus'] as const;
export type TollVehicleClass = (typeof TOLL_VEHICLE_CLASSES)[number];

export function isTollVehicleClass(value: string): value is TollVehicleClass {
  return (TOLL_VEHICLE_CLASSES as readonly string[]).includes(value);
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
  validFrom: Date | null;
  validUntil: Date | null;
  excludeId?: string;
}) {
  const rows = await db.select({
    id: tollTariffs.id,
    validFrom: tollTariffs.validFrom,
    validUntil: tollTariffs.validUntil,
  }).from(tollTariffs).where(and(
    eq(tollTariffs.tollPointId, input.tollPointId),
    eq(tollTariffs.vehicleClass, input.vehicleClass),
    eq(tollTariffs.active, true),
  ));
  if (rows.some((row) => row.id !== input.excludeId && rangesOverlap(
    input.validFrom,
    input.validUntil,
    row.validFrom,
    row.validUntil,
  ))) {
    throw new Error('Bu araç sınıfı için aynı geçerlilik aralığında aktif bir tarife zaten var.');
  }
}

export async function getTollManagementData() {
  const [points, tariffs, alternatives, routes, items, admins] = await Promise.all([
    db.select().from(tollPoints).orderBy(asc(tollPoints.name)),
    db.select().from(tollTariffs).orderBy(asc(tollTariffs.vehicleClass), desc(tollTariffs.updatedAt)),
    db.select().from(routeTollAlternatives).orderBy(asc(routeTollAlternatives.routeId), desc(routeTollAlternatives.isDefault), asc(routeTollAlternatives.displayOrder)),
    db.select({ id: transferRoutes.id, name: transferRoutes.name, active: transferRoutes.active })
      .from(transferRoutes).orderBy(asc(transferRoutes.name)),
    db.select().from(routeTollAlternativeItems).orderBy(asc(routeTollAlternativeItems.displayOrder)),
    db.select({ id: adminUsers.id, name: adminUsers.name }).from(adminUsers),
  ]);
  const adminNames = new Map(admins.map((admin) => [admin.id, admin.name]));
  return {
    points: points.map((point) => ({
      ...point,
      createdByName: point.createdBy ? adminNames.get(point.createdBy) ?? null : null,
      updatedByName: point.updatedBy ? adminNames.get(point.updatedBy) ?? null : null,
    })),
    tariffs: tariffs.map((tariff) => ({
      ...tariff,
      sourceMode: tariff.manualAmountKurus != null ? 'MANUAL_OVERRIDE' : 'AUTOMATIC',
      updatedByName: tariff.updatedBy ? adminNames.get(tariff.updatedBy) ?? null : null,
      createdByName: tariff.createdBy ? adminNames.get(tariff.createdBy) ?? null : null,
    })),
    alternatives: alternatives.map((alternative) => ({
      ...alternative,
      pointIds: items
        .filter((item) => item.alternativeId === alternative.id)
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((item) => item.tollPointId),
    })),
    routes,
    vehicleClasses: TOLL_VEHICLE_CLASSES,
  };
}

export async function getRouteTollAlternatives(routeId: string, vehicleId?: string) {
  const now = new Date();
  const [route] = await db.select({ id: transferRoutes.id, active: transferRoutes.active })
    .from(transferRoutes).where(eq(transferRoutes.id, routeId)).limit(1);
  if (!route) throw new Error('Güzergâh bulunamadı.');

  const [vehicle] = vehicleId
    ? await db.select({ id: vehicles.id, pricingClass: vehicles.pricingClass })
      .from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1)
    : [null];
  if (vehicleId && !vehicle) throw new Error('Araç bulunamadı.');

  const alternatives = await db.select().from(routeTollAlternatives).where(and(
    eq(routeTollAlternatives.routeId, routeId),
    eq(routeTollAlternatives.active, true),
  )).orderBy(desc(routeTollAlternatives.isDefault), asc(routeTollAlternatives.displayOrder));
  if (!alternatives.length) return { alternatives: [], defaultAlternativeId: null, vehicleClass: vehicle?.pricingClass ?? null };

  const alternativeIds = alternatives.map((alternative) => alternative.id);
  const items = await db.select().from(routeTollAlternativeItems).where(inArray(routeTollAlternativeItems.alternativeId, alternativeIds))
    .orderBy(asc(routeTollAlternativeItems.displayOrder));
  const pointIds = [...new Set(items.map((item) => item.tollPointId))];
  const points = pointIds.length
    ? await db.select().from(tollPoints).where(inArray(tollPoints.id, pointIds))
    : [];
  const tariffs = vehicle?.pricingClass && pointIds.length
    ? await db.select().from(tollTariffs).where(and(
      inArray(tollTariffs.tollPointId, pointIds),
      eq(tollTariffs.vehicleClass, vehicle.pricingClass),
      eq(tollTariffs.active, true),
      or(isNull(tollTariffs.validFrom), lte(tollTariffs.validFrom, now)),
      or(isNull(tollTariffs.validUntil), gte(tollTariffs.validUntil, now)),
    ))
    : [];

  return {
    defaultAlternativeId: alternatives.find((alternative) => alternative.isDefault)?.id ?? null,
    vehicleClass: vehicle?.pricingClass ?? null,
    alternatives: alternatives.map((alternative) => {
      const alternativeItems = items.filter((item) => item.alternativeId === alternative.id);
      const missingTariffPointNames = alternativeItems.flatMap((item) => {
        const point = points.find((candidate) => candidate.id === item.tollPointId);
        if (!point) return ['Bilinmeyen geçiş noktası'];
        if (!point.active) return [`${point.name} (pasif)`];
        const matchingTariffs = tariffs.filter((tariff) => tariff.tollPointId === point.id);
        return matchingTariffs.length ? [] : [point.name];
      });
      return {
        id: alternative.id,
        name: alternative.name,
        active: alternative.active,
        isDefault: alternative.isDefault,
        displayOrder: alternative.displayOrder,
        pointIds: alternativeItems.map((item) => item.tollPointId),
        pointNames: alternativeItems.map((item) => points.find((point) => point.id === item.tollPointId)?.name ?? 'Bilinmeyen geçiş'),
        isPricedForSelectedVehicle: !vehicle || missingTariffPointNames.length === 0,
        missingTariffPointNames,
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