import 'server-only';

import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { locations, siteSettings, transferRoutes } from '@/db/schema';

export type LocationDistanceResult =
  | {
    state: 'DEFINED_ROUTE';
    distanceKm: number;
    source: 'defined_route';
    routeId: string;
    verifiedAt: string | null;
    calculatedAt: string;
  }
  | {
    state: 'ESTIMATED';
    distanceKm: number;
    source: 'coordinate_estimate';
    roadDistanceMultiplier: number;
    calculatedAt: string;
  }
  | {
    state: 'UNAVAILABLE';
    reason: 'SAME_LOCATION' | 'LOCATION_NOT_FOUND' | 'MISSING_COORDINATES' | 'COINCIDENT_COORDINATES';
    calculatedAt: string;
  };

type ResolvableLocation = {
  id: string;
  name: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
};

export type RouteDistanceCandidate = {
  id: string;
  origin: string;
  destination: string;
  originLocationId: string | null;
  destinationLocationId: string | null;
  distanceKm: number;
  distanceSource: string;
  distanceVerifiedAt: Date | null;
};

/** Chooses a verified route deterministically: ID pairs outrank name-only legacy records. */
export function selectVerifiedRoute(
  activeRoutes: RouteDistanceCandidate[],
  origin: Pick<ResolvableLocation, 'id' | 'name'>,
  destination: Pick<ResolvableLocation, 'id' | 'name'>,
): RouteDistanceCandidate | undefined {
  const isVerifiedPositive = (candidate: RouteDistanceCandidate) =>
    candidate.distanceSource === 'ADMIN_VERIFIED' && candidate.distanceKm > 0;
  const directIdMatches = activeRoutes.filter((candidate) =>
    candidate.originLocationId === origin.id && candidate.destinationLocationId === destination.id);
  const reverseIdMatches = activeRoutes.filter((candidate) =>
    candidate.originLocationId === destination.id && candidate.destinationLocationId === origin.id);
  const legacyNameMatches = activeRoutes.filter((candidate) =>
    (candidate.origin === origin.name && candidate.destination === destination.name)
    || (candidate.origin === destination.name && candidate.destination === origin.name));
  return [...directIdMatches, ...reverseIdMatches, ...legacyNameMatches].find(isVerifiedPositive);
}

function isCoordinatePair(location: ResolvableLocation): location is ResolvableLocation & {
  latitude: number;
  longitude: number;
} {
  return Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
    && Math.abs(location.latitude!) <= 90
    && Math.abs(location.longitude!) <= 180;
}

function haversineKm(origin: ResolvableLocation & { latitude: number; longitude: number }, destination: ResolvableLocation & { latitude: number; longitude: number }): number {
  const earthRadiusKm = 6371.0088;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(origin.latitude))
      * Math.cos(toRadians(destination.latitude))
      * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Resolves a distance strictly for authenticated operations. An admin-verified
 * route always wins (even if a newer unverified duplicate exists); coordinates
 * are only a transparent fallback and never yield 0.
 */
export async function resolveLocationDistance(input: {
  originLocationId: string;
  destinationLocationId: string;
  at?: Date;
}): Promise<LocationDistanceResult> {
  const calculatedAt = (input.at ?? new Date()).toISOString();
  if (input.originLocationId === input.destinationLocationId) {
    return { state: 'UNAVAILABLE', reason: 'SAME_LOCATION', calculatedAt };
  }

  const selectedLocations = await db
    .select({
      id: locations.id,
      name: locations.name,
      city: locations.city,
      latitude: locations.latitude,
      longitude: locations.longitude,
    })
    .from(locations)
    .where(and(
      inArray(locations.id, [input.originLocationId, input.destinationLocationId]),
      eq(locations.isActive, true),
      isNull(locations.archivedAt),
    ));

  const origin = selectedLocations.find((location) => location.id === input.originLocationId);
  const destination = selectedLocations.find((location) => location.id === input.destinationLocationId);
  if (!origin || !destination) {
    return { state: 'UNAVAILABLE', reason: 'LOCATION_NOT_FOUND', calculatedAt };
  }

  const activeRoutes = await db
    .select({
      id: transferRoutes.id,
      origin: transferRoutes.origin,
      destination: transferRoutes.destination,
      originLocationId: transferRoutes.originLocationId,
      destinationLocationId: transferRoutes.destinationLocationId,
      distanceKm: transferRoutes.distanceKm,
      distanceSource: transferRoutes.distanceSource,
      distanceVerifiedAt: transferRoutes.distanceVerifiedAt,
    })
    .from(transferRoutes)
    .where(eq(transferRoutes.active, true))
    .orderBy(desc(transferRoutes.updatedAt));

  const route = selectVerifiedRoute(activeRoutes, origin, destination);

  if (route) {
    return {
      state: 'DEFINED_ROUTE',
      distanceKm: route.distanceKm,
      source: 'defined_route',
      routeId: route.id,
      verifiedAt: route.distanceVerifiedAt?.toISOString() ?? null,
      calculatedAt,
    };
  }

  if (!isCoordinatePair(origin) || !isCoordinatePair(destination)) {
    return { state: 'UNAVAILABLE', reason: 'MISSING_COORDINATES', calculatedAt };
  }

  const settings = await db
    .select({ roadDistanceMultiplier: siteSettings.roadDistanceMultiplier })
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1);
  const storedMultiplier = settings[0]?.roadDistanceMultiplier ?? 1.25;
  const roadDistanceMultiplier = storedMultiplier >= 1 && storedMultiplier <= 3
    ? storedMultiplier
    : 1.25;
  const straightLineKm = haversineKm(origin, destination);
  if (!Number.isFinite(straightLineKm) || straightLineKm <= 0) {
    return { state: 'UNAVAILABLE', reason: 'COINCIDENT_COORDINATES', calculatedAt };
  }
  const distanceKm = Math.ceil(straightLineKm * roadDistanceMultiplier);
  if (distanceKm <= 0) {
    return { state: 'UNAVAILABLE', reason: 'COINCIDENT_COORDINATES', calculatedAt };
  }

  return {
    state: 'ESTIMATED',
    distanceKm,
    source: 'coordinate_estimate',
    roadDistanceMultiplier,
    calculatedAt,
  };
}