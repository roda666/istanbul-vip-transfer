import { describe, expect, it } from 'vitest';
import { classifyLocationPairTollSource } from '@/lib/toll-management';

describe('location-pair toll precedence', () => {
  const base = { originSide: 'EUROPEAN' as const, destinationSide: 'NONE' as const, destinationType: 'PROVINCE', hasCorridor: true };

  it('prefers an exact registered route', () => {
    expect(classifyLocationPairTollSource({ ...base, hasRegisteredRoute: true })).toBe('EXACT_ROUTE');
  });

  it('prefers a Bosphorus crossing for opposite Istanbul sides', () => {
    expect(classifyLocationPairTollSource({ ...base, destinationSide: 'ASIAN' })).toBe('BOSPHORUS');
  });

  it('uses a corridor only for a European Istanbul province trip', () => {
    expect(classifyLocationPairTollSource(base)).toBe('CORRIDOR');
    expect(classifyLocationPairTollSource({ ...base, originSide: 'ASIAN' })).toBe('NONE');
    expect(classifyLocationPairTollSource({ ...base, originSide: 'ASIAN', destinationSide: 'EUROPEAN' })).toBe('BOSPHORUS');
  });

  it('does not invent a corridor for SAW/Asian origins or missing provinces', () => {
    expect(classifyLocationPairTollSource({ ...base, originSide: 'ASIAN' })).toBe('NONE');
    expect(classifyLocationPairTollSource({ ...base, destinationType: 'DISTRICT' })).toBe('NONE');
    expect(classifyLocationPairTollSource({ ...base, hasCorridor: false })).toBe('NONE');
  });
});