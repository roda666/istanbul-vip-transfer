import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  transaction: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock('@/db', () => ({
  db: {
    transaction: mocks.transaction,
    insert: mocks.insert,
  },
}));

import { DELETE } from '../../app/admin/api/pricing/tolls/tariffs/[id]/route';
import { POST } from '../../app/admin/api/pricing/tolls/tariffs/order/route';

const id = '00000000-0000-4000-8000-000000000001';
const adjacentId = '00000000-0000-4000-8000-000000000002';
const pointId = '00000000-0000-4000-8000-000000000010';
const adminId = '00000000-0000-4000-8000-000000000099';
const request = (body: unknown) => new Request('http://localhost/admin/api/pricing/tolls/tariffs/order', {
  method: 'POST',
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
}) as never;

const chain = <T>(value: T) => {
  const result = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    orderBy: vi.fn(),
    returning: vi.fn(),
    values: vi.fn(),
    set: vi.fn(),
  };
  result.from.mockReturnValue(result);
  result.where.mockReturnValue(result);
  result.limit.mockResolvedValue(value);
  result.orderBy.mockResolvedValue(value);
  result.returning.mockResolvedValue(value);
  result.values.mockResolvedValue(value);
  result.set.mockReturnValue(result);
  return result;
};

describe('tariff row action API contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ adminId });
    mocks.insert.mockReturnValue(chain(undefined));
  });

  it('requires an authenticated admin for DELETE', async () => {
    mocks.requireAdminSession.mockRejectedValue(new Error('no session'));
    const response = await DELETE(new Request('http://localhost') as never, { params: Promise.resolve({ id }) });
    expect(response.status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('returns 404 without audit or delete when DELETE target is missing', async () => {
    const select = chain([]);
    const tx = { select: vi.fn().mockReturnValue(select), delete: mocks.delete, update: mocks.update, execute: mocks.execute };
    mocks.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
    const response = await DELETE(new Request('http://localhost') as never, { params: Promise.resolve({ id }) });
    expect(response.status).toBe(404);
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('deletes and audits the exact tariff after a successful DELETE', async () => {
    const tariff = { id, tollPointId: pointId, vehicleClass: 'class_1', timeBand: 'ALL', amountKurus: 1234 };
    const select = chain([tariff]);
    const deleted = chain([tariff]);
    mocks.delete.mockReturnValue(deleted);
    const tx = { select: vi.fn().mockReturnValue(select), delete: mocks.delete, update: mocks.update, execute: mocks.execute };
    mocks.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
    const audit = chain(undefined);
    mocks.insert.mockReturnValue(audit);
    const response = await DELETE(new Request('http://localhost') as never, { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    expect(mocks.delete).toHaveBeenCalled();
    expect(audit.values).toHaveBeenCalledWith(expect.objectContaining({
      adminUserId: adminId,
      action: 'DELETE',
      entityType: 'TollTariff',
      entityId: id,
    }));
  });

  it('swaps only adjacent rows within one point/class and returns refreshed order', async () => {
    const rows = [
      { id, displayOrder: 0 },
      { id: adjacentId, displayOrder: 1 },
    ];
    const current = { id, tollPointId: pointId, vehicleClass: 'class_1', displayOrder: 0 };
    const currentSelect = chain([current]);
    const groupSelect = chain(rows);
    const refreshed = chain([{ ...current, id: adjacentId, displayOrder: 0 }, { ...current, displayOrder: 1 }]);
    const tx = {
      select: vi.fn()
        .mockReturnValueOnce(currentSelect)
        .mockReturnValueOnce(groupSelect)
        .mockReturnValueOnce(refreshed),
      update: vi.fn().mockReturnValue(chain(undefined)),
      execute: mocks.execute,
    };
    mocks.execute.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
    const response = await POST(request({ id, direction: 'down' }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ boundary: false, tariffs: [{ id: adjacentId }, { id }] });
    expect(tx.update).toHaveBeenCalledTimes(2);
  });

  it('returns a boundary order without updating at the first/last row', async () => {
    const current = { id, tollPointId: pointId, vehicleClass: 'class_1', displayOrder: 0 };
    const currentSelect = chain([current]);
    const groupSelect = chain([{ id, displayOrder: 0 }, { id: adjacentId, displayOrder: 1 }]);
    const refreshed = chain([current, { ...current, id: adjacentId, displayOrder: 1 }]);
    const tx = {
      select: vi.fn().mockReturnValueOnce(currentSelect).mockReturnValueOnce(groupSelect).mockReturnValueOnce(refreshed),
      update: vi.fn().mockReturnValue(chain(undefined)),
      execute: mocks.execute,
    };
    mocks.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
    const response = await POST(request({ id, direction: 'up' }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ boundary: true });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('rejects a caller that supplies another vehicle class or point', async () => {
    const select = chain([{ id, tollPointId: pointId, vehicleClass: 'class_1', displayOrder: 0 }]);
    const tx = { select: vi.fn().mockReturnValue(select), update: mocks.update, execute: mocks.execute };
    mocks.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
    const response = await POST(request({ id, direction: 'down', vehicleClass: 'class_2', tollPointId: pointId }));
    expect(response.status).toBe(422);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});

describe('tariff display-order schema and create contracts', () => {
  const schema = readFileSync(new URL('../../db/schema.ts', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../../drizzle/migrations/0103_toll_tariff_display_order.sql', import.meta.url), 'utf8');
  const createRoute = readFileSync(new URL('../../app/admin/api/pricing/tolls/tariffs/route.ts', import.meta.url), 'utf8');
  const quickRoute = readFileSync(new URL('../../app/admin/api/pricing/tolls/tariffs/quick/route.ts', import.meta.url), 'utf8');

  it('declares a safe default and deterministic order index', () => {
    expect(schema).toContain("displayOrder: integer('display_order').default(0).notNull()");
    expect(schema).toContain("index('toll_tariffs_order_idx')");
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "display_order" integer NOT NULL DEFAULT 0');
    expect(migration).toContain('PARTITION BY toll_point_id, vehicle_class');
    expect(migration).toContain('ORDER BY display_order, id');
  });

  it('appends newly-created rows after the current point/class group', () => {
    expect(createRoute).toContain('max(tollTariffs.displayOrder)');
    expect(createRoute).toContain('displayOrder: (lastOrder?.value ?? -1) + 1');
    expect(quickRoute).toContain('displayOrder: (await tx.select');
  });
});