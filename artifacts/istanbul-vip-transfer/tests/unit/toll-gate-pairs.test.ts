import { describe, expect, it } from 'vitest';
import { availableGatePairs, isExactGatePair } from '../../lib/toll-gate-pairs';

describe('gate-pair option contract', () => {
  it('filters inactive rows and dedupes exact pairs without changing tariff order', () => {
    const pairs = availableGatePairs('point', [
      { tollPointId: 'other', active: true, entryGateName: 'Wrong', exitGateName: 'Point' },
      { tollPointId: 'point', active: false, entryGateName: 'Inactive', exitGateName: 'Pair' },
      { tollPointId: 'point', active: true, entryGateName: 'Odayeri', exitGateName: 'Kurnaköy' },
      { tollPointId: 'point', active: true, entryGateName: 'Odayeri', exitGateName: 'Kurnaköy' },
      { tollPointId: 'point', active: true, entryGateName: 'Riva', exitGateName: 'Kurnaköy' },
      { tollPointId: 'point', active: true, entryGateName: null, exitGateName: 'Incomplete' },
    ]);

    expect(pairs).toEqual([
      { entryGateName: 'Odayeri', exitGateName: 'Kurnaköy' },
      { entryGateName: 'Riva', exitGateName: 'Kurnaköy' },
    ]);
  });

  it('accepts only an exact entry-to-exit match', () => {
    const pairs = [{ entryGateName: 'Odayeri', exitGateName: 'Kurnaköy' }];
    expect(isExactGatePair(pairs[0], pairs)).toBe(true);
    expect(isExactGatePair({ entryGateName: 'Kurnaköy', exitGateName: 'Odayeri' }, pairs)).toBe(false);
    expect(isExactGatePair({ entryGateName: 'Old Gate', exitGateName: 'Old Exit' }, pairs)).toBe(false);
    expect(isExactGatePair(undefined, pairs)).toBe(false);
  });
});