import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import {
  buildControlledLocationOrder,
  LOCATION_ORDER_GROUPS,
  type LocationOrderRow,
} from '../lib/location-ordering';

const BASELINE_PATH = path.resolve('reports/location-order-baseline-2026-09-13.json');
const RESULT_PATH = path.resolve('reports/location-order-result-2026-09-13.json');
const EXPECTED_COUNT = 133;
const LOCK_KEY = 'locations-display-order';

type StoredRow = LocationOrderRow & {
  updatedAt: string;
  updatedBy: string | null;
  archivedAt: string | null;
  isActive: boolean;
  pickupEnabled: boolean;
  dropoffEnabled: boolean;
  latitude: number | null;
  longitude: number | null;
  coordinateSource: string | null;
  coordinateAccuracyMeters: number | null;
  translations: unknown;
};

type Baseline = {
  rowCount: number;
  uniqueIdCount: number;
  sha256: string;
  rows: StoredRow[];
};

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

function normalizeRows(rows: Record<string, unknown>[]): StoredRow[] {
  return rows.map((row) => ({
    ...row,
    updatedAt: row.updatedAt instanceof Date
      ? row.updatedAt.toISOString()
      : String(row.updatedAt),
    archivedAt: row.archivedAt instanceof Date
      ? row.archivedAt.toISOString()
      : row.archivedAt === null ? null : String(row.archivedAt),
  })) as StoredRow[];
}

function stableRows(rows: StoredRow[]) {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id));
}

function baselineProjection(rows: StoredRow[], includeOrder: boolean) {
  return stableRows(rows).map(({
    city: _classificationOnlyCity,
    displayOrder,
    ...row
  }) => includeOrder ? { ...row, displayOrder } : row);
}

function assertInvariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function selectLockedRows(tx: postgres.TransactionSql) {
  return normalizeRows(await tx`
    select id::text as id, name, slug, city, type, scope,
           display_order as "displayOrder", updated_at as "updatedAt",
           updated_by::text as "updatedBy", archived_at as "archivedAt",
           is_active as "isActive", pickup_enabled as "pickupEnabled",
           dropoff_enabled as "dropoffEnabled", latitude, longitude,
           coordinate_source as "coordinateSource",
           coordinate_accuracy_meters as "coordinateAccuracyMeters", translations
    from locations
    where archived_at is null
    order by id
    for update
  `);
}

async function main() {
  const baseline = JSON.parse(await readFile(BASELINE_PATH, 'utf8')) as Baseline;
  assertInvariant(
    baseline.rowCount === EXPECTED_COUNT &&
    baseline.uniqueIdCount === EXPECTED_COUNT &&
    new Set(baseline.rows.map((row) => row.id)).size === EXPECTED_COUNT,
    'Baseline must contain 133 unique locations.',
  );

  const result = await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${LOCK_KEY}))`;
    const totalBefore = await tx`select count(*)::int as count from locations`;
    assertInvariant(totalBefore[0]?.count === EXPECTED_COUNT, 'Total location count changed before ordering.');

    const current = await selectLockedRows(tx);
    assertInvariant(current.length === EXPECTED_COUNT, 'Active location count changed before ordering.');
    assertInvariant(
      JSON.stringify(baselineProjection(current, true)) ===
      JSON.stringify(baselineProjection(baseline.rows, true)),
      'Current locations no longer match the permanent baseline; transaction rolled back.',
    );

    const plan = buildControlledLocationOrder(current);
    assertInvariant(
      plan.unclassified.length === 0,
      `Unclassified locations: ${plan.unclassified.map((row) => `${row.id}:${row.name}`).join(', ')}`,
    );
    assertInvariant(plan.ordered.length === EXPECTED_COUNT, 'Ordering plan is incomplete.');

    for (const row of plan.ordered) {
      if (row.displayOrder === row.nextDisplayOrder) continue;
      await tx`
        update locations
        set display_order = ${row.nextDisplayOrder}
        where id = ${row.id}::uuid
      `;
    }

    const after = await selectLockedRows(tx);
    const totalAfter = await tx`select count(*)::int as count from locations`;
    assertInvariant(totalAfter[0]?.count === EXPECTED_COUNT, 'Total location count changed during ordering.');
    assertInvariant(after.length === EXPECTED_COUNT, 'Active location count changed during ordering.');
    assertInvariant(
      JSON.stringify(baselineProjection(after, false)) ===
      JSON.stringify(baselineProjection(baseline.rows, false)),
      'A protected location field changed; transaction rolled back.',
    );
    const orders = after.map((row) => row.displayOrder);
    assertInvariant(
      new Set(orders).size === EXPECTED_COUNT &&
      Math.min(...orders) === 0 &&
      Math.max(...orders) === EXPECTED_COUNT - 1,
      'Display orders are not unique and contiguous; transaction rolled back.',
    );

    return { plan, after };
  });

  const groupEvidence = LOCATION_ORDER_GROUPS.map((group) => {
    const rows = result.plan.ordered.filter((row) => row.group === group.id);
    return {
      id: group.id,
      label: group.label,
      count: rows.length,
      startDisplayOrder: rows[0]?.nextDisplayOrder ?? null,
      endDisplayOrder: rows.at(-1)?.nextDisplayOrder ?? null,
      firstFive: rows.slice(0, 5).map(({ id, name, nextDisplayOrder }) => ({ id, name, displayOrder: nextDisplayOrder })),
      lastFive: rows.slice(-5).map(({ id, name, nextDisplayOrder }) => ({ id, name, displayOrder: nextDisplayOrder })),
    };
  });
  const orderedRows = [...result.after].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id),
  );
  const report = {
    schemaVersion: 1,
    appliedAt: new Date().toISOString(),
    baselinePath: path.relative(process.cwd(), BASELINE_PATH),
    baselineSha256: baseline.sha256,
    rowCountBefore: EXPECTED_COUNT,
    rowCountAfter: result.after.length,
    uniqueIdCount: new Set(result.after.map((row) => row.id)).size,
    protectedStateSha256: createHash('sha256')
      .update(JSON.stringify(baselineProjection(result.after, false)))
      .digest('hex'),
    unclassified: result.plan.unclassified,
    groups: groupEvidence,
    firstFive: orderedRows.slice(0, 5).map(({ id, name, type, scope, displayOrder }) => ({ id, name, type, scope, displayOrder })),
    lastFive: orderedRows.slice(-5).map(({ id, name, type, scope, displayOrder }) => ({ id, name, type, scope, displayOrder })),
  };
  await writeFile(RESULT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main()
  .finally(() => sql.end())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });