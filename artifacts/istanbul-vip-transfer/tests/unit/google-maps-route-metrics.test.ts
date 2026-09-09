import { describe, expect, it } from 'vitest';
import { parseGoogleRoutesMetrics } from '@/lib/google-maps-distance';

describe('Google Routes metrics parsing', () => {
  it('maps distance metres and protobuf duration to rounded-up business units', () => {
    expect(parseGoogleRoutesMetrics({
      routes: [{ distanceMeters: 41_046, duration: '2886s' }],
    })).toEqual({ distanceKm: 42, durationMinutes: 49 });
  });

  it.each([
    [null],
    [{}],
    [{ routes: [] }],
    [{ routes: [{ distanceMeters: 1000 }] }],
    [{ routes: [{ distanceMeters: 1000, duration: 'invalid' }] }],
    [{ routes: [{ distanceMeters: 0, duration: '60s' }] }],
  ])('rejects incomplete or invalid payload %#', (payload) => {
    expect(parseGoogleRoutesMetrics(payload)).toBeNull();
  });
});