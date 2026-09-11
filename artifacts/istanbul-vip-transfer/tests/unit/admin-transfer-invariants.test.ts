import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { hasResourceCollision, isTransferStatusTransitionValid } from '@/lib/operations';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const base = { status: 'ASSIGNED', plannedPickupAt: new Date('2025-04-10T10:00:00Z') };

describe('transfer assignment collision invariants', () => {
  it('rejects a collision when only the driver matches', () => {
    expect(hasResourceCollision({ ...base, driverId: 'driver-1', vehicleId: 'vehicle-new' }, [{ ...base, driverId: 'driver-1', vehicleId: 'vehicle-old' }])).toBe(true);
  });
  it('rejects a collision when only the vehicle matches', () => {
    expect(hasResourceCollision({ ...base, driverId: 'driver-new', vehicleId: 'vehicle-1' }, [{ ...base, driverId: 'driver-old', vehicleId: 'vehicle-1' }])).toBe(true);
  });
  it('ignores completed and cancelled operations', () => {
    expect(hasResourceCollision({ ...base, driverId: 'driver-1', vehicleId: null }, [{ ...base, status: 'COMPLETED', driverId: 'driver-1', vehicleId: null }])).toBe(false);
  });
});

describe('transfer status and route contracts', () => {
  it('preserves status when PATCH omits status and uses explicit transitions', () => {
    const source = read('app/admin/api/transfers/[id]/route.ts');
    expect(source).toContain('const status = next.status ?? current.status');
    expect(isTransferStatusTransitionValid('PLANNED', 'ASSIGNED')).toBe(true);
    expect(isTransferStatusTransitionValid('ASSIGNED', 'IN_PROGRESS')).toBe(true);
    expect(isTransferStatusTransitionValid('IN_PROGRESS', 'COMPLETED')).toBe(true);
    expect(isTransferStatusTransitionValid('COMPLETED', 'ASSIGNED')).toBe(false);
    expect(isTransferStatusTransitionValid('CANCELLED', 'PLANNED')).toBe(false);
  });
  it('checks either driver or vehicle in every write path', () => {
    for (const file of [
      'app/admin/api/transfers/route.ts',
      'app/admin/api/transfers/[id]/route.ts',
      'app/admin/api/requests/[id]/convert-to-transfer/route.ts',
    ]) expect(read(file)).toContain('or(...resources)');
  });
  it('rejects terminal assignment edits', () => {
    const source = read('app/admin/api/transfers/[id]/route.ts');
    expect(source).toContain('TERMINAL_ASSIGNMENT');
    expect(source).toContain("current.status === 'COMPLETED'");
    expect(source).toContain("current.status === 'CANCELLED'");
  });
});