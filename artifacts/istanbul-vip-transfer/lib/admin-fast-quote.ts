export type FastQuoteRouteMatch = {
  id: string;
  originLocationId: string | null;
  destinationLocationId: string | null;
  active: boolean;
};

export type FastQuoteTollAlternativeOrder = {
  id: string;
  name: string;
  isDefault: boolean;
  displayOrder: number;
};

export type FastQuoteLocationPoint = {
  id: string;
  latitude: number | null;
  longitude: number | null;
};

/** Only exact direction matches are safe because gate-pair tariffs may be directional. */
export function findExactFastQuoteRoute(
  routes: FastQuoteRouteMatch[],
  originLocationId: string,
  destinationLocationId: string,
): string | null {
  if (!originLocationId || !destinationLocationId) return null;
  return routes.find((route) =>
    route.active
    && route.originLocationId === originLocationId
    && route.destinationLocationId === destinationLocationId,
  )?.id ?? null;
}

export function sortFastQuoteTollAlternatives<T extends FastQuoteTollAlternativeOrder>(alternatives: T[]): T[] {
  const collator = new Intl.Collator('tr-TR', { sensitivity: 'base' });
  return [...alternatives].sort((left, right) =>
    Number(right.isDefault) - Number(left.isDefault)
    || left.displayOrder - right.displayOrder
    || collator.compare(left.name, right.name),
  );
}

export function findNearestFastQuoteLocation(
  locations: FastQuoteLocationPoint[],
  point: { latitude: number; longitude: number },
  maxDistanceKm = 2,
): string | null {
  const toRad = (value: number) => value * Math.PI / 180;
  let best: { id: string; distanceKm: number } | null = null;
  for (const location of locations) {
    if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) continue;
    const latDelta = toRad(location.latitude! - point.latitude);
    const lngDelta = toRad(location.longitude! - point.longitude);
    const a = Math.sin(latDelta / 2) ** 2
      + Math.cos(toRad(point.latitude)) * Math.cos(toRad(location.latitude!)) * Math.sin(lngDelta / 2) ** 2;
    const distanceKm = 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (distanceKm <= maxDistanceKm && (!best || distanceKm < best.distanceKm)) best = { id: location.id, distanceKm };
  }
  return best?.id ?? null;
}