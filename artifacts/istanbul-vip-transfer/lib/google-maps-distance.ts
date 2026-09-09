import 'server-only';
import { resolveIntegrationSecret } from './integration-secrets';

type CoordinateLocation = {
  latitude: number | null;
  longitude: number | null;
};

export type GoogleMapsRouteMetrics = {
  distanceKm: number;
  durationMinutes: number;
};

export function parseGoogleRoutesMetrics(payload: unknown): GoogleMapsRouteMetrics | null {
  const route = (payload as { routes?: Array<{ distanceMeters?: unknown; duration?: unknown }> } | null)?.routes?.[0];
  const distanceMeters = route?.distanceMeters;
  const durationMatch = typeof route?.duration === 'string' ? /^(\d+(?:\.\d+)?)s$/.exec(route.duration) : null;
  const durationSeconds = durationMatch ? Number(durationMatch[1]) : NaN;
  if (
    typeof distanceMeters !== 'number'
    || !Number.isFinite(distanceMeters)
    || distanceMeters <= 0
    || !Number.isFinite(durationSeconds)
    || durationSeconds <= 0
  ) return null;
  return {
    distanceKm: Math.ceil(distanceMeters / 1000),
    durationMinutes: Math.ceil(durationSeconds / 60),
  };
}

/**
 * Returns real Google Routes API road distance and duration when the deployment is
 * credentialed. Network and provider failures intentionally resolve to null:
 * callers then retain their existing verified-route/coordinate behaviour.
 */
export async function getGoogleMapsRouteMetrics(
  origin: CoordinateLocation,
  destination: CoordinateLocation,
): Promise<GoogleMapsRouteMetrics | null> {
  const apiKey = await resolveIntegrationSecret('GOOGLE_MAPS_API_KEY');
  if (!apiKey
    || !Number.isFinite(origin.latitude) || !Number.isFinite(origin.longitude)
    || !Number.isFinite(destination.latitude) || !Number.isFinite(destination.longitude)) {
    return null;
  }

  try {
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } } },
        destination: { location: { latLng: { latitude: destination.latitude, longitude: destination.longitude } } },
        travelMode: 'DRIVE',
      }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    return parseGoogleRoutesMetrics(await response.json());
  } catch {
    return null;
  }
}

export async function getGoogleMapsRoadDistance(
  origin: CoordinateLocation,
  destination: CoordinateLocation,
): Promise<number | null> {
  return (await getGoogleMapsRouteMetrics(origin, destination))?.distanceKm ?? null;
}