import { eq, inArray, like, notLike } from 'drizzle-orm';
import { db } from '../../db';
import { auditLogs, vehiclePricingProfiles, vehicles } from '../../db/schema';
import { expect, test, waitForSettledAdminPage } from './fixtures';

test('vehicle edits keep one identity and formulas are created only in the central formula UI', async ({
  adminPage,
}) => {
  test.setTimeout(180_000);
  const suffix = crypto.randomUUID();
  const slug = `qa-vehicle-formula-boundary-${suffix}`;
  const initialName = `__qa_vehicle_formula_boundary_${suffix}`;
  const realVehiclesBefore = await db.select().from(vehicles).where(notLike(vehicles.slug, 'qa-vehicle-formula-boundary-%'));
  const realProfilesBefore = await db.select().from(vehiclePricingProfiles);
  const realVehicleCount = realVehiclesBefore.length;
  let vehicleId = '';
  let profileIds: string[] = [];

  const waitMutation = (method: string, path: RegExp) =>
    adminPage.waitForResponse(
      (response) => response.request().method() === method && path.test(new URL(response.url()).pathname),
      { timeout: 45_000 },
    );

  try {
    await adminPage.goto('/admin/araclar/yeni');
    await waitForSettledAdminPage(adminPage);
    await adminPage.getByTestId('vehicle-name').fill(initialName);
    await adminPage.getByTestId('vehicle-slug').fill(slug);
    await adminPage.getByTestId('vehicle-toll-class').selectOption('class_2');
    const createPromise = waitMutation('POST', /^\/admin\/api\/vehicles$/);
    await adminPage.getByTestId('vehicle-save-draft').click();
    expect((await createPromise).status()).toBe(201);

    const [created] = await db.select().from(vehicles).where(eq(vehicles.slug, slug));
    vehicleId = created.id;
    expect(created.tollClass).toBe('class_2');
    expect(created.priceCalculationEligible).toBe(false);
    expect((await db.select().from(vehicles)).length).toBe(realVehicleCount + 1);
    expect((await db.select().from(vehiclePricingProfiles)).length).toBe(realProfilesBefore.length);

    for (let edit = 1; edit <= 3; edit += 1) {
      await adminPage.goto(`/admin/araclar/${vehicleId}/duzenle`);
      await waitForSettledAdminPage(adminPage);
      await expect(adminPage.getByTestId('vehicle-name')).toHaveValue(
        edit === 1 ? initialName : `${initialName}_edit_${edit - 1}`,
      );
      await adminPage.getByTestId('vehicle-name').fill(`${initialName}_edit_${edit}`);
      if (edit === 3) {
        await adminPage.getByTestId('vehicle-toll-class').selectOption('class_5');
      }
      const updatePromise = waitMutation('PUT', new RegExp(`/admin/api/vehicles/${vehicleId}$`));
      await adminPage.getByTestId('vehicle-save-draft').click();
      expect((await updatePromise).status()).toBe(200);

      const tempVehicles = await db.select().from(vehicles).where(like(vehicles.slug, 'qa-vehicle-formula-boundary-%'));
      expect(tempVehicles).toHaveLength(1);
      expect(tempVehicles[0].id).toBe(vehicleId);
      expect((await db.select().from(vehicles)).length).toBe(realVehicleCount + 1);
      expect((await db.select().from(vehiclePricingProfiles)).length).toBe(realProfilesBefore.length);
    }

    await adminPage.goto(`/admin/araclar/${vehicleId}/duzenle`);
    await waitForSettledAdminPage(adminPage);
    await expect(adminPage.getByTestId('vehicle-toll-class')).toHaveValue('class_5');
    await expect(adminPage.getByText('Bu araç otomatik fiyat hesaplamasına uygundur')).toHaveCount(0);
    await expect(adminPage.getByText('Resmî kaynak URL')).toHaveCount(0);
    await expect(adminPage.getByText('Kanıt / doğrulama notu')).toHaveCount(0);

    await adminPage.goto('/admin/fiyat-kurallari');
    await waitForSettledAdminPage(adminPage);
    await adminPage.getByRole('button', { name: 'Hesaplama Formülleri', exact: true }).click();
    await adminPage.getByTestId('new-pricing-formula').click();
    await adminPage.getByTestId('formula-vehicle').selectOption(vehicleId);
    let formulaPromise = waitMutation('POST', /^\/admin\/api\/pricing\/profiles$/);
    await adminPage.getByRole('button', { name: 'Oluştur', exact: true }).click();
    expect((await formulaPromise).status()).toBe(201);

    let tempProfiles = await db.select().from(vehiclePricingProfiles).where(eq(vehiclePricingProfiles.vehicleId, vehicleId));
    expect(tempProfiles).toHaveLength(1);
    expect(tempProfiles[0].active).toBe(true);
    profileIds = tempProfiles.map((profile) => profile.id);
    await expect(adminPage.locator('tr').filter({ hasText: `${initialName}_edit_3` })).toBeVisible();

    const formulaRow = adminPage.locator('tr').filter({ hasText: `${initialName}_edit_3` }).first();
    await formulaRow.getByRole('button', { name: 'Yeni Formül Olarak Çoğalt' }).click();
    formulaPromise = waitMutation('POST', /^\/admin\/api\/pricing\/profiles$/);
    await adminPage.getByRole('button', { name: 'Oluştur', exact: true }).click();
    expect((await formulaPromise).status()).toBe(201);

    tempProfiles = await db.select().from(vehiclePricingProfiles).where(eq(vehiclePricingProfiles.vehicleId, vehicleId));
    expect(tempProfiles).toHaveLength(2);
    expect(tempProfiles.filter((profile) => profile.active)).toHaveLength(1);
    expect(tempProfiles.filter((profile) => !profile.active)).toHaveLength(1);
    profileIds = tempProfiles.map((profile) => profile.id);
  } finally {
    if (profileIds.length > 0) {
      await db.delete(auditLogs).where(inArray(auditLogs.entityId, profileIds)).catch(() => {});
      await db.delete(vehiclePricingProfiles).where(inArray(vehiclePricingProfiles.id, profileIds)).catch(() => {});
    }
    if (vehicleId) {
      await db.delete(auditLogs).where(eq(auditLogs.entityId, vehicleId)).catch(() => {});
      await db.delete(vehicles).where(eq(vehicles.id, vehicleId)).catch(() => {});
    }

    const realVehiclesAfter = await db.select().from(vehicles).where(notLike(vehicles.slug, 'qa-vehicle-formula-boundary-%'));
    const realProfilesAfter = await db.select().from(vehiclePricingProfiles);
    expect(realVehiclesAfter.sort((a, b) => a.id.localeCompare(b.id)))
      .toEqual(realVehiclesBefore.sort((a, b) => a.id.localeCompare(b.id)));
    expect(realProfilesAfter.sort((a, b) => a.id.localeCompare(b.id)))
      .toEqual(realProfilesBefore.sort((a, b) => a.id.localeCompare(b.id)));
  }
});