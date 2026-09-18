import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { drivers, transferOperations, vehicles } from '../../db/schema';
import { expect, test } from './fixtures';

test('transfer create API returns JSON, persists the assignment, and cleans up', async ({
  adminIdentity,
  adminPage: page,
}) => {
  test.setTimeout(120_000);
  const marker = `Playwright Transfer API ${adminIdentity.id.slice(0, 8)}`;
  const [driver] = await db.select({ id: drivers.id }).from(drivers)
    .where(eq(drivers.createdBy, adminIdentity.id)).limit(1);
  const [vehicle] = await db.select({ id: vehicles.id }).from(vehicles)
    .where(eq(vehicles.createdBy, adminIdentity.id)).limit(1);
  expect(driver).toBeTruthy();
  expect(vehicle).toBeTruthy();

  try {
    const origin = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? '26004'}`;
    const response = await page.request.post('/admin/api/transfers', {
      headers: { Origin: origin },
      data: {
        plannedPickupAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        pickupLocationSummary: 'SAW',
        dropoffLocationSummary: 'IST',
        routeSummary: 'SAW → IST',
        customerSummary: marker,
        driverId: driver!.id,
        vehicleId: vehicle!.id,
      },
      timeout: 60_000,
    });

    expect(response.status()).toBe(201);
    expect(response.headers()['content-type']).toContain('application/json');
    const payload = await response.json() as { item?: { id?: string; customerSummary?: string } };
    expect(payload.item?.id).toBeTruthy();
    expect(payload.item?.customerSummary).toBe(marker);

    const [stored] = await db.select({
      id: transferOperations.id,
      driverId: transferOperations.driverId,
      vehicleId: transferOperations.vehicleId,
      status: transferOperations.status,
    }).from(transferOperations).where(and(
      eq(transferOperations.customerSummary, marker),
      eq(transferOperations.createdBy, adminIdentity.id),
    )).limit(1);
    expect(stored).toMatchObject({
      id: payload.item!.id,
      driverId: driver!.id,
      vehicleId: vehicle!.id,
      status: 'ASSIGNED',
    });
  } finally {
    await db.delete(transferOperations).where(and(
      eq(transferOperations.customerSummary, marker),
      eq(transferOperations.createdBy, adminIdentity.id),
    ));
  }
});