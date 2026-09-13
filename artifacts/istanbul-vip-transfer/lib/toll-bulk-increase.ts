import { createHash } from 'node:crypto';

export type BulkIncreaseTariff = {
  id: string;
  vehicleClass: string;
  timeBand: string;
  amountKurus: number | null;
  manualAmountKurus: number | null;
  automaticAmountKurus: number | null;
  updatedAt: Date | string;
};

export type BulkIncreasePreviewRow = {
  tariffId: string;
  vehicleClass: string;
  timeBand: string;
  oldAmountKurus: number;
  newAmountKurus: number;
};

const PERCENT_SCALE = 10_000;
const MULTIPLIER_SCALE = 100 * PERCENT_SCALE;

export function parseBulkIncreasePercentage(input: string): {
  percentageUnits: number;
  normalizedPercentage: string;
} {
  const normalized = input.trim().replace(',', '.');
  if (!/^\d{1,4}(?:\.\d{1,4})?$/.test(normalized)) {
    throw new Error('Zam oranını yüzde olarak virgül veya nokta ile girin.');
  }
  const [whole, fraction = ''] = normalized.split('.');
  const percentageUnits = Number(whole) * PERCENT_SCALE + Number(fraction.padEnd(4, '0'));
  if (!Number.isSafeInteger(percentageUnits) || percentageUnits <= 0 || percentageUnits > 1_000 * PERCENT_SCALE) {
    throw new Error('Zam oranı %0’dan büyük ve en fazla %1000 olmalıdır.');
  }
  return {
    percentageUnits,
    normalizedPercentage: (percentageUnits / PERCENT_SCALE).toString(),
  };
}

export function increaseKurus(amountKurus: number, percentageUnits: number): number {
  const numerator = BigInt(amountKurus) * BigInt(MULTIPLIER_SCALE + percentageUnits);
  return Number((numerator + BigInt(MULTIPLIER_SCALE / 2)) / BigInt(MULTIPLIER_SCALE));
}

export function buildBulkIncreasePreview(
  tariffs: BulkIncreaseTariff[],
  percentageInput: string,
): {
  percentageUnits: number;
  normalizedPercentage: string;
  rows: BulkIncreasePreviewRow[];
  skippedEmptyCount: number;
  previewHash: string;
} {
  const parsed = parseBulkIncreasePercentage(percentageInput);
  const ordered = [...tariffs].sort((a, b) => a.id.localeCompare(b.id));
  const rows = ordered
    .filter((tariff): tariff is BulkIncreaseTariff & { amountKurus: number } => tariff.amountKurus != null)
    .map((tariff) => ({
      tariffId: tariff.id,
      vehicleClass: tariff.vehicleClass,
      timeBand: tariff.timeBand,
      oldAmountKurus: tariff.amountKurus,
      newAmountKurus: increaseKurus(tariff.amountKurus, parsed.percentageUnits),
    }));
  const snapshot = ordered.map((tariff) => ({
    id: tariff.id,
    amountKurus: tariff.amountKurus,
    manualAmountKurus: tariff.manualAmountKurus,
    automaticAmountKurus: tariff.automaticAmountKurus,
    updatedAt: new Date(tariff.updatedAt).toISOString(),
  }));
  const previewHash = createHash('sha256')
    .update(JSON.stringify({ percentageUnits: parsed.percentageUnits, snapshot }))
    .digest('hex');
  return {
    ...parsed,
    rows,
    skippedEmptyCount: ordered.length - rows.length,
    previewHash,
  };
}