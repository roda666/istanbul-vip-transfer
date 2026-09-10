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