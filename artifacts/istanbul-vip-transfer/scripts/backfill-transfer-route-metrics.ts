import 'server-only';

import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { auditLogs, locations, transferRoutes } from '../db/schema';
import { getGoogleMapsRouteMetrics } from '../lib/google-maps-distance';
import { matchRouteEndpointToLocation } from '../lib/route-location-matching';

const EXPECTED_ROUTE_COUNT = 15;
const REQUEST_DELAY_MS = 250;
const APPLY = process.argv.includes('--apply');
const REPORT_DATE = new Date().toISOString().slice(0, 10);
const REPORT_DIR = path.resolve(process.cwd(), 'reports');
const FINAL_REPORT = path.join(REPORT_DIR, `transfer-route-google-metrics-audit-${REPORT_DATE}.csv`);
const PREFLIGHT_REPORT = path.join(REPORT_DIR, `transfer-route-google-metrics-audit-${REPORT_DATE}.preflight.csv`);

type AuditRow = {
  id: string;
  slug: string;
  routeName: string;
  originText: string;
  destinationText: string;
  matchedOriginLocation: string;
  matchedDestinationLocation: string;
  oldOriginLocationId: string;
  oldDestinationLocationId: string;
  newOriginLocationId: string;
  newDestinationLocationId: string;
  oldDistanceKm: number;
  newDistanceKm: number | null;
  oldDurationMinutes: number;
  newDurationMinutes: number | null;
  oldDistanceSource: string;
  newDistanceSource: string;
  status: 'READY' | 'UPDATED' | 'SKIPPED';
  skipReason: string;
};

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows: AuditRow[]): string {
  const headers: Array<keyof AuditRow> = [
    'id', 'slug', 'routeName', 'originText', 'destinationText',
    'matchedOriginLocation', 'matchedDestinationLocation',
    'oldOriginLocationId', 'oldDestinationLocationId',
    'newOriginLocationId', 'newDestinationLocationId',
    'oldDistanceKm', 'newDistanceKm', 'oldDurationMinutes', 'newDurationMinutes',
    'oldDistanceSource', 'newDistanceSource', 'status', 'skipReason',
  ];
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\n') + '\n';
}

async function main() {
  const [routeRows, locationRows] = await Promise.all([
    db.select({
      id: transferRoutes.id,
      slug: transferRoutes.slug,
      name: transferRoutes.name,
      origin: transferRoutes.origin,
      destination: transferRoutes.destination,
      originLocationId: transferRoutes.originLocationId,
      destinationLocationId: transferRoutes.destinationLocationId,
      distanceKm: transferRoutes.distanceKm,
      durationMinutes: transferRoutes.durationMinutes,
      distanceSource: transferRoutes.distanceSource,
    }).from(transferRoutes).orderBy(transferRoutes.slug),
    db.select({
      id: locations.id,
      name: locations.name,
      latitude: locations.latitude,
      longitude: locations.longitude,
    }).from(locations).orderBy(locations.name),
  ]);

  if (routeRows.length !== EXPECTED_ROUTE_COUNT) {
    throw new Error(`Safety check failed: expected ${EXPECTED_ROUTE_COUNT} routes, found ${routeRows.length}.`);
  }

  await mkdir(REPORT_DIR, { recursive: true });
  const auditRows: AuditRow[] = [];

  for (const [index, route] of routeRows.entries()) {
    const origin = matchRouteEndpointToLocation(route.origin, locationRows);
    const destination = matchRouteEndpointToLocation(route.destination, locationRows);
    const base = {
      id: route.id,
      slug: route.slug,
      routeName: route.name,
      originText: route.origin,
      destinationText: route.destination,
      matchedOriginLocation: origin?.name ?? '',
      matchedDestinationLocation: destination?.name ?? '',
      oldOriginLocationId: route.originLocationId ?? '',
      oldDestinationLocationId: route.destinationLocationId ?? '',
      newOriginLocationId: origin?.id ?? '',
      newDestinationLocationId: destination?.id ?? '',
      oldDistanceKm: route.distanceKm,
      oldDurationMinutes: route.durationMinutes,
      oldDistanceSource: route.distanceSource,
    };

    if (!origin || !destination) {
      auditRows.push({
        ...base,
        newDistanceKm: null,
        newDurationMinutes: null,
        newDistanceSource: '',
        status: 'SKIPPED',
        skipReason: !origin && !destination
          ? 'Kalkış ve varış için tekil lokasyon eşleşmesi bulunamadı.'
          : !origin
            ? 'Kalkış için tekil lokasyon eşleşmesi bulunamadı.'
            : 'Varış için tekil lokasyon eşleşmesi bulunamadı.',
      });
    } else if (
      !Number.isFinite(origin.latitude)
      || !Number.isFinite(origin.longitude)
      || !Number.isFinite(destination.latitude)
      || !Number.isFinite(destination.longitude)
    ) {
      auditRows.push({
        ...base,
        newDistanceKm: null,
        newDurationMinutes: null,
        newDistanceSource: '',
        status: 'SKIPPED',
        skipReason: 'Eşleşen lokasyonlardan en az birinde koordinat eksik.',
      });
    } else {
      const metrics = await getGoogleMapsRouteMetrics(
        { latitude: origin.latitude!, longitude: origin.longitude! },
        { latitude: destination.latitude!, longitude: destination.longitude! },
      );
      auditRows.push(metrics ? {
        ...base,
        newDistanceKm: metrics.distanceKm,
        newDurationMinutes: metrics.durationMinutes,
        newDistanceSource: 'ADMIN_VERIFIED',
        status: 'READY',
        skipReason: '',
      } : {
        ...base,
        newDistanceKm: null,
        newDurationMinutes: null,
        newDistanceSource: '',
        status: 'SKIPPED',
        skipReason: 'Google Maps Routes mesafe/süre sonucu alınamadı.',
      });
      await sleep(REQUEST_DELAY_MS);
    }

    console.log(`[${index + 1}/${routeRows.length}] ${route.name}: ${auditRows.at(-1)?.status}`);
  }

  await writeFile(PREFLIGHT_REPORT, toCsv(auditRows), 'utf8');
  const readyRows = auditRows.filter((row) => row.status === 'READY');
  const skippedRows = auditRows.filter((row) => row.status === 'SKIPPED');

  if (!APPLY) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      total: auditRows.length,
      ready: readyRows.length,
      skipped: skippedRows.length,
      report: path.relative(process.cwd(), PREFLIGHT_REPORT),
    }));
    return;
  }

  const verifiedAt = new Date();
  await db.transaction(async (tx) => {
    for (const row of readyRows) {
      const [updated] = await tx.update(transferRoutes).set({
        originLocationId: row.newOriginLocationId,
        destinationLocationId: row.newDestinationLocationId,
        distanceKm: row.newDistanceKm!,
        durationMinutes: row.newDurationMinutes!,
        distanceSource: 'ADMIN_VERIFIED',
        distanceVerifiedAt: verifiedAt,
        distanceVerifiedBy: null,
        updatedAt: verifiedAt,
      }).where(eq(transferRoutes.id, row.id)).returning({ id: transferRoutes.id });
      if (!updated) throw new Error(`Route disappeared before update: ${row.id}`);

      await tx.insert(auditLogs).values({
        action: 'TRANSFER_ROUTE_GOOGLE_METRICS_BACKFILL',
        entityType: 'TransferRoute',
        entityId: row.id,
        metadata: {
          routeName: row.routeName,
          matchedOriginLocation: row.matchedOriginLocation,
          matchedDestinationLocation: row.matchedDestinationLocation,
          oldOriginLocationId: row.oldOriginLocationId || null,
          oldDestinationLocationId: row.oldDestinationLocationId || null,
          newOriginLocationId: row.newOriginLocationId,
          newDestinationLocationId: row.newDestinationLocationId,
          oldDistanceKm: row.oldDistanceKm,
          newDistanceKm: row.newDistanceKm,
          oldDurationMinutes: row.oldDurationMinutes,
          newDurationMinutes: row.newDurationMinutes,
          oldDistanceSource: row.oldDistanceSource,
          newDistanceSource: row.newDistanceSource,
        },
      });
      row.status = 'UPDATED';
    }
  });

  await writeFile(`${FINAL_REPORT}.tmp`, toCsv(auditRows), 'utf8');
  await rename(`${FINAL_REPORT}.tmp`, FINAL_REPORT);

  const persisted = await db.select({
    id: transferRoutes.id,
    originLocationId: transferRoutes.originLocationId,
    destinationLocationId: transferRoutes.destinationLocationId,
    distanceKm: transferRoutes.distanceKm,
    durationMinutes: transferRoutes.durationMinutes,
    distanceSource: transferRoutes.distanceSource,
  }).from(transferRoutes);
  const byId = new Map(persisted.map((row) => [row.id, row]));
  for (const row of readyRows) {
    const saved = byId.get(row.id);
    if (
      saved?.originLocationId !== row.newOriginLocationId
      || saved.destinationLocationId !== row.newDestinationLocationId
      || saved.distanceKm !== row.newDistanceKm
      || saved.durationMinutes !== row.newDurationMinutes
      || saved.distanceSource !== 'ADMIN_VERIFIED'
    ) throw new Error(`Post-write verification failed for ${row.id}`);
  }

  console.log(JSON.stringify({
    mode: 'applied',
    total: auditRows.length,
    updated: readyRows.length,
    skippedUntouched: skippedRows.length,
    report: path.relative(process.cwd(), FINAL_REPORT),
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});