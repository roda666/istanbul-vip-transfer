export type GatePairTariffRow = {
  tollPointId: string;
  active: boolean;
  entryGateName?: string | null;
  exitGateName?: string | null;
};

export type GatePair = {
  entryGateName: string;
  exitGateName: string;
};

/** Trims and collapses user-entered gate whitespace without changing display case. */
export function normalizeGateName(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

/** Canonical gate identity used for duplicate checks, not for display. */
export function canonicalGateName(value: string): string {
  return normalizeGateName(value).toLocaleLowerCase('tr-TR');
}

/** Stable identity for one point/class/gate-pair tariff. */
export function gatePairTariffIdentity(
  tollPointId: string,
  entryGateName: string,
  exitGateName: string,
  vehicleClass: string,
): string {
  return JSON.stringify([
    tollPointId,
    canonicalGateName(entryGateName),
    canonicalGateName(exitGateName),
    vehicleClass.toLocaleLowerCase('tr-TR'),
  ]);
}

export function gatePairKey(entryGateName: string, exitGateName: string) {
  return `${canonicalGateName(entryGateName)}\u0000${canonicalGateName(exitGateName)}`;
}

/** Returns active tariff-backed pairs once, preserving the input row order. */
export function availableGatePairs(pointId: string, tariffs: GatePairTariffRow[]): GatePair[] {
  const seen = new Set<string>();
  const pairs: GatePair[] = [];
  for (const tariff of tariffs) {
    if (!tariff.active || tariff.tollPointId !== pointId || !tariff.entryGateName || !tariff.exitGateName) continue;
    const key = gatePairKey(tariff.entryGateName, tariff.exitGateName);
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ entryGateName: tariff.entryGateName, exitGateName: tariff.exitGateName });
  }
  return pairs;
}

export function isExactGatePair(
  pair: GatePair | null | undefined,
  availablePairs: GatePair[],
) {
  return !!pair && availablePairs.some((candidate) =>
    gatePairKey(candidate.entryGateName, candidate.exitGateName)
      === gatePairKey(pair.entryGateName, pair.exitGateName),
  );
}