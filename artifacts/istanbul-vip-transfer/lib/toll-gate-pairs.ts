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

export function gatePairKey(entryGateName: string, exitGateName: string) {
  return `${entryGateName}\u0000${exitGateName}`;
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
    candidate.entryGateName === pair.entryGateName &&
    candidate.exitGateName === pair.exitGateName,
  );
}