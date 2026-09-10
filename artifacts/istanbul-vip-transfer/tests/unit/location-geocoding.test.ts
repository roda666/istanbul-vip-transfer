import { describe, expect, it } from 'vitest';
import {
  applyGeocodingResultToForm,
  googleGeocodingErrorMessage,
  parseGoogleGeocodingPayload,
  parseGoogleGeocodingResults,
} from '@/lib/location-geocoding';

const successfulPayload = {
  status: 'OK',
  results: [{
    formatted_address: 'Tayakadın, Terminal Cad. No:1, Arnavutköy/İstanbul, Türkiye',
    place_id: 'test-place-id',
    geometry: {
      location: { lat: 41.275278, lng: 28.751944 },
      location_type: 'ROOFTOP',
    },
  }],
};

describe('location geocoding presentation', () => {
  it('parses a successful Google response and fills editable form fields', () => {
    const result = parseGoogleGeocodingPayload(successfulPayload);
    expect(result).toEqual({
      formattedAddress: successfulPayload.results[0].formatted_address,
      placeId: 'test-place-id',
      latitude: 41.275278,
      longitude: 28.751944,
      locationType: 'ROOFTOP',
      partialMatch: false,
    });

    const form = applyGeocodingResultToForm({
      name: 'İstanbul Havalimanı',
      latitude: '',
      longitude: '',
      coordinateSource: '',
      coordinateAccuracyMeters: '50',
    }, result!);
    expect(form).toEqual({
      name: 'İstanbul Havalimanı',
      latitude: '41.275278',
      longitude: '28.751944',
      coordinateSource: 'Google Maps (otomatik)',
      coordinateAccuracyMeters: '',
    });
  });

  it('rejects incomplete OK responses instead of filling invalid coordinates', () => {
    expect(parseGoogleGeocodingPayload({ status: 'OK', results: [{}] })).toBeNull();
  });

  it('returns only coordinate-backed autocomplete suggestions and respects the limit', () => {
    const results = parseGoogleGeocodingResults({
      status: 'OK',
      results: [
        successfulPayload.results[0],
        { formatted_address: 'Koordinatsız sonuç', place_id: 'invalid' },
        {
          formatted_address: 'Taksim, İstanbul, Türkiye',
          place_id: 'taksim',
          geometry: { location: { lat: 41.0369, lng: 28.985 }, location_type: 'GEOMETRIC_CENTER' },
        },
      ],
    }, 2);
    expect(results.map(result => result.placeId)).toEqual(['test-place-id', 'taksim']);
    expect(results.every(result => Number.isFinite(result.latitude) && Number.isFinite(result.longitude))).toBe(true);
  });

  it.each([
    ['REQUEST_DENIED', 'erişimi reddedildi'],
    ['ZERO_RESULTS', 'sonucu bulunamadı'],
    ['OVER_QUERY_LIMIT', 'kotası aşıldı'],
    ['INVALID_REQUEST', 'sorgusu geçersiz'],
  ])('maps provider status %s to a clear Turkish message', (status, phrase) => {
    expect(googleGeocodingErrorMessage(status)).toContain(phrase);
  });
});