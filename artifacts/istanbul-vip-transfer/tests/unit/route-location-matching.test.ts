import { describe, expect, it } from 'vitest';
import {
  canonicalLocationName,
  matchRouteEndpointToLocation,
} from '@/lib/route-location-matching';

const locations = [
  { id: 'ist', name: 'İstanbul Havalimanı (IST)' },
  { id: 'saw', name: 'Sabiha Gökçen Havalimanı (SAW)' },
  { id: 'taksim', name: 'Taksim Meydanı' },
  { id: 'sultanahmet', name: 'Sultanahmet Meydanı' },
  { id: 'istanbul', name: 'İstanbul' },
];

describe('route endpoint location matching', () => {
  it.each([
    ['İstanbul Havalimanı', 'ist'],
    ['Sabiha Gökçen Havalimanı', 'saw'],
    ['Taksim', 'taksim'],
    ['Sultanahmet', 'sultanahmet'],
    ['İstanbul', 'istanbul'],
  ])('matches safe name variant %s', (endpoint, expectedId) => {
    expect(matchRouteEndpointToLocation(endpoint, locations)?.id).toBe(expectedId);
  });

  it('rejects a combined ambiguous endpoint', () => {
    expect(matchRouteEndpointToLocation('İstanbul Havalimanı / Sabiha Gökçen', locations)).toBeNull();
  });

  it('returns null when no catalogue location matches', () => {
    expect(matchRouteEndpointToLocation('Boğaz Otelleri (Tarabya)', locations)).toBeNull();
  });

  it('normalizes Turkish characters and airport codes deterministically', () => {
    expect(canonicalLocationName('İstanbul Havalimanı (IST)')).toBe('istanbul havalimani');
  });
});