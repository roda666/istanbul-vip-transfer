import 'server-only';

type CoordinateLocation = {
  latitude: number | null;
  longitude: number | null;
};

/**
 * Returns a real Google Routes API road distance when the deployment is
 * credentialed. Network and provider failures intentionally resolve to null:
 * callers then retain their existing verified-route/coordinate behaviour.
 */
export async function getGoogleMapsRoadDistance(
  origin: CoordinateLocation,
  destination: CoordinateLocation,
): Promise<number | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
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
        'X-Goog-FieldMask': 'routes.distanceMeters',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } } },
        destination: { location: { latLng: { latitude: destination.latitude, longitude: destination.longitude } } },
        travelMode: 'DRIVE',
      }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { routes?: Array<{ distanceMeters?: number }> };
    const metres = payload.routes?.[0]?.distanceMeters;
    return Number.isFinite(metres) && metres! > 0 ? Math.ceil(metres! / 1000) : null;
  } catch {
    return null;
  }
}