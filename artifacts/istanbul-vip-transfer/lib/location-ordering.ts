export type LocationOrderDirection = 'up' | 'down';

export type LocationOrderRow = {
  id: string;
  name: string;
  slug: string;
  city: string;
  type: string;
  scope: string;
  displayOrder: number;
};

export const LOCATION_ORDER_GROUPS = [
  { id: 'AIRPORT', label: 'Havalimanları' },
  { id: 'ISTANBUL_DISTRICT', label: 'İstanbul ilçeleri' },
  { id: 'ISTANBUL_PLACE', label: 'İstanbul bölgeleri ve özel noktaları' },
  { id: 'PROVINCE', label: 'Diğer iller' },
] as const;

export type LocationOrderGroupId = (typeof LOCATION_ORDER_GROUPS)[number]['id'];

const turkishCollator = new Intl.Collator('tr-TR', {
  sensitivity: 'base',
  numeric: true,
  usage: 'sort',
});

const AIRPORT_PRIORITY = new Map([
  ['ist-havalimani', 0],
  ['saw-sabiha-gokcen', 1],
]);

export function classifyLocationOrderGroup(
  row: Pick<LocationOrderRow, 'city' | 'type'>,
): LocationOrderGroupId | null {
  if (row.type === 'AIRPORT') return 'AIRPORT';
  if (row.type === 'DISTRICT' && row.city === 'İstanbul') return 'ISTANBUL_DISTRICT';
  if (
    row.city === 'İstanbul' &&
    ['REGION', 'HOTEL_ZONE', 'CUSTOM'].includes(row.type)
  ) {
    return 'ISTANBUL_PLACE';
  }
  if (row.type === 'PROVINCE') return 'PROVINCE';
  return null;
}

function compareRows(a: LocationOrderRow, b: LocationOrderRow): number {
  const byName = turkishCollator.compare(a.name, b.name);
  return byName || a.id.localeCompare(b.id);
}

export function buildControlledLocationOrder(rows: LocationOrderRow[]) {
  const grouped = new Map<LocationOrderGroupId, LocationOrderRow[]>(
    LOCATION_ORDER_GROUPS.map((group) => [group.id, []]),
  );
  const unclassified: LocationOrderRow[] = [];

  for (const row of rows) {
    const group = classifyLocationOrderGroup(row);
    if (!group) {
      unclassified.push(row);
      continue;
    }
    grouped.get(group)!.push(row);
  }

  const ordered: Array<LocationOrderRow & {
    group: LocationOrderGroupId;
    groupLabel: string;
    nextDisplayOrder: number;
  }> = [];

  for (const group of LOCATION_ORDER_GROUPS) {
    const groupRows = grouped.get(group.id)!;
    groupRows.sort((a, b) => {
      if (group.id === 'AIRPORT') {
        const aPriority = AIRPORT_PRIORITY.get(a.slug) ?? Number.MAX_SAFE_INTEGER;
        const bPriority = AIRPORT_PRIORITY.get(b.slug) ?? Number.MAX_SAFE_INTEGER;
        if (aPriority !== bPriority) return aPriority - bPriority;
      }
      return compareRows(a, b);
    });
    for (const row of groupRows) {
      ordered.push({
        ...row,
        group: group.id,
        groupLabel: group.label,
        nextDisplayOrder: ordered.length,
      });
    }
  }

  return { ordered, unclassified: unclassified.sort(compareRows) };
}

export function planAdjacentLocationSwap(
  rows: Array<Pick<LocationOrderRow, 'id' | 'displayOrder'>>,
  targetId: string,
  direction: LocationOrderDirection,
) {
  const sorted = [...rows].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id),
  );
  const index = sorted.findIndex((row) => row.id === targetId);
  if (index < 0) {
    return { ok: false as const, error: 'Bulunamadı.', status: 404 as const };
  }

  const peerIndex = direction === 'up' ? index - 1 : index + 1;
  if (peerIndex < 0 || peerIndex >= sorted.length) {
    return {
      ok: false as const,
      error: 'Daha fazla hareket ettirilemiyor.',
      status: 400 as const,
    };
  }

  const current = sorted[index];
  const peer = sorted[peerIndex];
  return {
    ok: true as const,
    current: { id: current.id, displayOrder: peer.displayOrder },
    peer: { id: peer.id, displayOrder: current.displayOrder },
    metadata: {
      direction,
      from: current.displayOrder,
      to: peer.displayOrder,
      peerId: peer.id,
    },
  };
}