import { describe, expect, it } from 'vitest';
import { currentlyApplicable } from '@/lib/admin-pricing-service';
import {
  assertBosphorusSelectionRequirement,
  chooseDefaultRouteTollAlternative,
  isOppositeIstanbulSide,
} from '@/lib/toll-management';

describe('Istanbul cross-side eligibility', () => {
  it('accepts only European-to-Asian or Asian-to-European pairs', () => {
    expect(isOppositeIstanbulSide('EUROPEAN', 'ASIAN')).toBe(true);
    expect(isOppositeIstanbulSide('ASIAN', 'EUROPEAN')).toBe(true);
    expect(isOppositeIstanbulSide('EUROPEAN', 'EUROPEAN')).toBe(false);
    expect(isOppositeIstanbulSide('NONE', 'ASIAN')).toBe(false);
  });

  it('requires a selected crossing for an unregistered opposite-side pair', () => {
    expect(() => assertBosphorusSelectionRequirement({
      hasExactOrSelectedRoute: false,
      crossingRequired: true,
    })).toThrow('bir Boğaz geçişi seçilmelidir');
  });

  it('rejects a generic crossing when an exact or selected route exists', () => {
    expect(() => assertBosphorusSelectionRequirement({
      hasExactOrSelectedRoute: true,
      crossingRequired: false,
      bosphorusTollPointId: 'crossing-id',
    })).toThrow('güzergâh ile birlikte kullanılamaz');
  });

  it('does not require a crossing for same-side or unclassified pairs', () => {
    expect(() => assertBosphorusSelectionRequirement({
      hasExactOrSelectedRoute: false,
      crossingRequired: false,
    })).not.toThrow();
  });
});

describe('fixed price override validity selection', () => {
  const now = new Date('2026-08-24T12:00:00.000Z');

  it('does not let expired or future overrides replace the active formula price', () => {
    const expired = {
      id: 'expired',
      validFrom: new Date('2026-08-01T00:00:00.000Z'),
      validUntil: new Date('2026-08-23T23:59:59.999Z'),
    };
    const future = {
      id: 'future',
      validFrom: new Date('2026-08-25T00:00:00.000Z'),
      validUntil: null,
    };
    expect(currentlyApplicable([expired, future], now)).toBeUndefined();
  });

  it('uses the newest currently valid override when one exists', () => {
    const older = {
      id: 'older',
      validFrom: new Date('2026-08-01T00:00:00.000Z'),
      validUntil: new Date('2026-08-31T23:59:59.999Z'),
    };
    const current = {
      id: 'current',
      validFrom: new Date('2026-08-20T00:00:00.000Z'),
      validUntil: null,
    };
    expect(currentlyApplicable([older, current], now)?.id).toBe('current');
  });
});

describe('route toll alternative default selection', () => {
  it('allows all-review routes to remain intentionally without a default', () => {
    expect(chooseDefaultRouteTollAlternative([
      { id: 'review-a', isDefault: false, needsReview: true },
      { id: 'review-b', isDefault: false, needsReview: true },
    ])).toBeNull();
  });

  it('still rejects a missing default once any active option is operational', () => {
    expect(() => chooseDefaultRouteTollAlternative([
      { id: 'review-a', isDefault: false, needsReview: true },
      { id: 'ready-b', isDefault: false, needsReview: false },
    ])).toThrow('tek bir varsayılan alternatif');
  });

  it('returns the one configured default', () => {
    expect(chooseDefaultRouteTollAlternative([
      { id: 'default-a', isDefault: true, needsReview: false },
      { id: 'other-b', isDefault: false, needsReview: true },
    ])).toBe('default-a');
  });
});