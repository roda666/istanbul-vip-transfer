import { describe, expect, it } from 'vitest';
import { selectVerifiedRoute, type RouteDistanceCandidate } from '@/lib/location-distance';

const origin = { id: 'origin', name: 'İstanbul' };
const destination = { id: 'destination', name: 'Bursa' };

function route(overrides: Partial<RouteDistanceCandidate>): RouteDistanceCandidate {
  return {
    id: 'route',
    origin: origin.name,
    destination: destination.name,
    originLocationId: origin.id,
    destinationLocationId: destination.id,
    distanceKm: 155,
    distanceSource: 'ADMIN_VERIFIED',
    distanceVerifiedAt: new Date('2026-08-24T00:00:00.000Z'),
    ...overrides,
  };
}

describe('verified route distance selection', () => {
  it('does not let a newer unverified duplicate hide an older verified route', () => {
    const selected = selectVerifiedRoute([
      route({ id: 'new-unverified', distanceSource: 'COORDINATE_ESTIMATE', distanceKm: 120 }),
      route({ id: 'older-verified', distanceKm: 155 }),
    ], origin, destination);
    expect(selected?.id).toBe('older-verified');
  });

  it('prefers a verified location-ID route over a name-only legacy match', () => {
    const selected = selectVerifiedRoute([
      route({ id: 'legacy', originLocationId: null, destinationLocationId: null, distanceKm: 140 }),
      route({ id: 'id-route', distanceKm: 155 }),
    ], origin, destination);
    expect(selected?.id).toBe('id-route');
  });
});