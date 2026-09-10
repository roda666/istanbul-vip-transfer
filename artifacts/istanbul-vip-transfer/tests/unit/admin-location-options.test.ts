import { describe, expect, it } from 'vitest';
import {
  groupManagedLocationOptions,
  ISTANBUL_DISTRICTS,
  type ManagedLocationOption,
} from '@/lib/admin-location-options';

const option = (
  name: string,
  type: ManagedLocationOption['type'],
  city: string,
  displayOrder = 0,
): ManagedLocationOption => ({
  id: `${type}-${name}`,
  name,
  city,
  district: type === 'DISTRICT' ? name : null,
  type,
  displayOrder,
});

describe('admin route location option order', () => {
  it('defines every official Istanbul district exactly once', () => {
    expect(ISTANBUL_DISTRICTS).toHaveLength(39);
    expect(new Set(ISTANBUL_DISTRICTS).size).toBe(39);
    expect(ISTANBUL_DISTRICTS).toContain('Sarıyer');
    expect(ISTANBUL_DISTRICTS).toContain('Adalar');
  });

  it('groups airports, alphabetic districts, then alphabetic external provinces', () => {
    const groups = groupManagedLocationOptions([
      option('Sinop', 'PROVINCE', 'Sinop'),
      option('Sabiha Gökçen Havalimanı (SAW)', 'AIRPORT', 'İstanbul', 2),
      option('Zeytinburnu', 'DISTRICT', 'İstanbul'),
      option('İstanbul Havalimanı (IST)', 'AIRPORT', 'İstanbul', 1),
      option('Adalar', 'DISTRICT', 'İstanbul'),
      option('Sakarya', 'PROVINCE', 'Sakarya'),
    ]);
    expect(groups.map(group => group.label)).toEqual([
      'İstanbul Havalimanları', 'İstanbul İlçeleri', 'Diğer İller',
    ]);
    expect(groups[0].items.map(item => item.name)).toEqual([
      'İstanbul Havalimanı (IST)', 'Sabiha Gökçen Havalimanı (SAW)',
    ]);
    expect(groups[1].items.map(item => item.name)).toEqual(['Adalar', 'Zeytinburnu']);
    expect(groups[2].items.map(item => item.name)).toEqual(['Sakarya', 'Sinop']);
  });
});