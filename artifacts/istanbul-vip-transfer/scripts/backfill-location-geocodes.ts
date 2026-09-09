import 'server-only';

import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { auditLogs, locations } from '../db/schema';
import {
  geocodeLocationAddress,
  GoogleGeocodingError,
} from '../lib/google-maps-geocoding';

const EXPECTED_LOCATION_COUNT = 134;
const REQUEST_DELAY_MS = 250;
const REPORT_DATE = new Date().toISOString().slice(0, 10);
const REPORT_DIR = path.resolve(process.cwd(), 'reports');
const FINAL_REPORT = path.join(REPORT_DIR, `location-geocoding-audit-${REPORT_DATE}.csv`);
const PREFLIGHT_REPORT = path.join(REPORT_DIR, `location-geocoding-audit-${REPORT_DATE}.preflight.csv`);
const APPLY = process.argv.includes('--apply');

type LocationRow = {
  id: string;
  slug: string;
  name: string;
  city: string;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  coordinateSource: string | null;
};

type AuditRow = {
  id: string;
  slug: string;
  name: string;
  city: string;
  district: string;
  query: string;
  oldLatitude: number | null;
  oldLongitude: number | null;
  oldCoordinateSource: string;
  newLatitude: number | null;
  newLongitude: number | null;
  newCoordinateSource: string;
  formattedAddress: string;
  resultType: string;
  confidence: 'HIGH' | 'LOWER_PRECISION' | 'NONE';
  status: 'UPDATED' | 'READY' | 'FAILED';
  errorCode: string;
  errorMessage: string;
};

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows: AuditRow[]): string {
  const headers: Array<keyof AuditRow> = [
    'id', 'slug', 'name', 'city', 'district', 'query',
    'oldLatitude', 'oldLongitude', 'oldCoordinateSource',
    'newLatitude', 'newLongitude', 'newCoordinateSource',
    'formattedAddress', 'resultType', 'confidence', 'status',
    'errorCode', 'errorMessage',
  ];
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\n') + '\n';
}

function buildQuery(location: LocationRow): string {
  return Array.from(new Set([
    location.name.trim(),
    location.district?.trim(),
    location.city.trim(),
    'Türkiye',
  ].filter((part): part is string => Boolean(part)))).join(', ');
}

async function geocodeWithRetry(query: string) {
  const retryableCodes = new Set(['NETWORK_ERROR', 'UNKNOWN_ERROR', 'OVER_QUERY_LIMIT', 'HTTP_429']);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await geocodeLocationAddress(query);
    } catch (error) {
      if (!(error instanceof GoogleGeocodingError) || !retryableCodes.has(error.code) || attempt === 3) throw error;
      await sleep(attempt * 1_000);
    }
  }
  throw new Error('Unreachable');
}

async function main() {
  const sourceRows = await db.select({
    id: locations.id,
    slug: locations.slug,
    name: locations.name,
    city: locations.city,
    district: locations.district,
    latitude: locations.latitude,
    longitude: locations.longitude,
    coordinateSource: locations.coordinateSource,
  }).from(locations).orderBy(locations.name, locations.slug);

  if (sourceRows.length !== EXPECTED_LOCATION_COUNT) {
    throw new Error(`Safety check failed: expected ${EXPECTED_LOCATION_COUNT} locations, found ${sourceRows.length}.`);
  }

  await mkdir(REPORT_DIR, { recursive: true });
  const reportRows: AuditRow[] = [];

  for (const [index, location] of sourceRows.entries()) {
    const query = buildQuery(location);
    try {
      const result = await geocodeWithRetry(query);
      reportRows.push({
        id: location.id,
        slug: location.slug,
        name: location.name,
        city: location.city,
        district: location.district ?? '',
        query,
        oldLatitude: location.latitude,
        oldLongitude: location.longitude,
        oldCoordinateSource: location.coordinateSource ?? '',
        newLatitude: result.latitude,
        newLongitude: result.longitude,
        newCoordinateSource: 'Google Maps (otomatik)',
        formattedAddress: result.formattedAddress,
        resultType: result.locationType,
        confidence: result.locationType === 'ROOFTOP' ? 'HIGH' : 'LOWER_PRECISION',
        status: 'READY',
        errorCode: '',
        errorMessage: '',
      });
    } catch (error) {
      const geocodingError = error instanceof GoogleGeocodingError ? error : null;
      reportRows.push({
        id: location.id,
        slug: location.slug,
        name: location.name,
        city: location.city,
        district: location.district ?? '',
        query,
        oldLatitude: location.latitude,
        oldLongitude: location.longitude,
        oldCoordinateSource: location.coordinateSource ?? '',
        newLatitude: null,
        newLongitude: null,
        newCoordinateSource: '',
        formattedAddress: '',
        resultType: '',
        confidence: 'NONE',
        status: 'FAILED',
        errorCode: geocodingError?.code ?? 'UNEXPECTED_ERROR',
        errorMessage: geocodingError?.message ?? 'Beklenmeyen hata',
      });
    }
    console.log(`[${index + 1}/${sourceRows.length}] ${location.name}: ${reportRows.at(-1)?.status}`);
    if (index < sourceRows.length - 1) await sleep(REQUEST_DELAY_MS);
  }

  await writeFile(PREFLIGHT_REPORT, toCsv(reportRows), 'utf8');
  const readyRows = reportRows.filter((row) => row.status === 'READY');
  const failedRows = reportRows.filter((row) => row.status === 'FAILED');

  if (!APPLY) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      total: reportRows.length,
      ready: readyRows.length,
      failed: failedRows.length,
      lowerPrecision: readyRows.filter((row) => row.confidence === 'LOWER_PRECISION').length,
      report: path.relative(process.cwd(), PREFLIGHT_REPORT),
    }));
    return;
  }

  await db.transaction(async (tx) => {
    for (const row of readyRows) {
      const [updated] = await tx.update(locations).set({
        latitude: row.newLatitude,
        longitude: row.newLongitude,
        coordinateSource: row.newCoordinateSource,
        updatedAt: new Date(),
      }).where(eq(locations.id, row.id)).returning({ id: locations.id });
      if (!updated) throw new Error(`Location disappeared before update: ${row.id}`);
      await tx.insert(auditLogs).values({
        action: 'LOCATION_GEOCODE_BACKFILL',
        entityType: 'Location',
        entityId: row.id,
        metadata: {
          name: row.name,
          query: row.query,
          oldLatitude: row.oldLatitude,
          oldLongitude: row.oldLongitude,
          oldCoordinateSource: row.oldCoordinateSource || null,
          newLatitude: row.newLatitude,
          newLongitude: row.newLongitude,
          newCoordinateSource: row.newCoordinateSource,
          formattedAddress: row.formattedAddress,
          resultType: row.resultType,
          confidence: row.confidence,
        },
      });
      row.status = 'UPDATED';
    }
  });

  await writeFile(`${FINAL_REPORT}.tmp`, toCsv(reportRows), 'utf8');
  await rename(`${FINAL_REPORT}.tmp`, FINAL_REPORT);

  const persistedRows = await db.select({
    id: locations.id,
    latitude: locations.latitude,
    longitude: locations.longitude,
    coordinateSource: locations.coordinateSource,
  }).from(locations);
  const persistedById = new Map(persistedRows.map((row) => [row.id, row]));
  for (const row of readyRows) {
    const persisted = persistedById.get(row.id);
    if (
      persisted?.latitude !== row.newLatitude
      || persisted.longitude !== row.newLongitude
      || persisted.coordinateSource !== row.newCoordinateSource
    ) {
      throw new Error(`Post-write verification failed for ${row.id}`);
    }
  }

  console.log(JSON.stringify({
    mode: 'applied',
    total: reportRows.length,
    updated: readyRows.length,
    failedUntouched: failedRows.length,
    lowerPrecision: readyRows.filter((row) => row.confidence === 'LOWER_PRECISION').length,
    report: path.relative(process.cwd(), FINAL_REPORT),
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});