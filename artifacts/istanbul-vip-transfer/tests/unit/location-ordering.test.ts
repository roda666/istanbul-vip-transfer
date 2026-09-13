import { describe, expect, it } from 'vitest';
import {
  buildControlledLocationOrder,
  planAdjacentLocationSwap,
  type LocationOrderRow,
} from '@/lib/location-ordering';

describe('location ordering safety', () => {
  it('plans an adjacent swap that changes only two of 133 rows', () => {
    const rows = Array.from({ length: 133 }, (_, index) => ({
      id: `location-${String(index).padStart(3, '0')}`,
      displayOrder: index,
    }));

    const result = planAdjacentLocationSwap(rows, 'location-066', 'up');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect([result.current, result.peer]).toEqual([
      { id: 'location-066', displayOrder: 65 },
      { id: 'location-065', displayOrder: 66 },
    ]);
    expect(rows.filter((row) => !['location-066', 'location-065'].includes(row.id)))
      .toHaveLength(131);
    expect(rows.every((row, index) => row.displayOrder === index)).toBe(true);
  });

  it('builds the requested Turkish group order without inventing classifications', () => {
    const rows: LocationOrderRow[] = [
      { id: 'p2', name: 'İzmir', slug: 'il-izmir', city: 'İzmir', type: 'PROVINCE', scope: 'INTERCITY', displayOrder: 0 },
      { id: 'r2', name: 'İstiklal Caddesi', slug: 'istiklal-caddesi', city: 'İstanbul', type: 'REGION', scope: 'LOCAL', displayOrder: 1 },
      { id: 'd2', name: 'Şişli', slug: 'sisli', city: 'İstanbul', type: 'DISTRICT', scope: 'BOTH', displayOrder: 2 },
      { id: 'a2', name: 'Sabiha Gökçen Havalimanı', slug: 'saw-sabiha-gokcen', city: 'İstanbul', type: 'AIRPORT', scope: 'BOTH', displayOrder: 3 },
      { id: 'a1', name: 'İstanbul Havalimanı', slug: 'ist-havalimani', city: 'İstanbul', type: 'AIRPORT', scope: 'BOTH', displayOrder: 4 },
      { id: 'd1', name: 'Çatalca', slug: 'catalca', city: 'İstanbul', type: 'DISTRICT', scope: 'BOTH', displayOrder: 5 },
      { id: 'r1', name: 'Ayasofya', slug: 'ayasofya', city: 'İstanbul', type: 'REGION', scope: 'LOCAL', displayOrder: 6 },
      { id: 'p1', name: 'Çanakkale', slug: 'il-canakkale', city: 'Çanakkale', type: 'PROVINCE', scope: 'INTERCITY', displayOrder: 7 },
      { id: 'x1', name: 'Belirsiz', slug: 'belirsiz', city: 'Bursa', type: 'CUSTOM', scope: 'LOCAL', displayOrder: 8 },
    ];

    const result = buildControlledLocationOrder(rows);
    expect(result.ordered.map((row) => row.id)).toEqual([
      'a1', 'a2', 'd1', 'd2', 'r1', 'r2', 'p1', 'p2',
    ]);
    expect(result.ordered.map((row) => row.nextDisplayOrder)).toEqual(
      Array.from({ length: 8 }, (_, index) => index),
    );
    expect(result.unclassified.map((row) => row.id)).toEqual(['x1']);
  });
});