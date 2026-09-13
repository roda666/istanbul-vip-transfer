import { and, eq, like } from 'drizzle-orm';
import { db } from '../../db';
import { auditLogs, locations, optionalServices, vehicles } from '../../db/schema';
import { expect, test, waitForSettledAdminPage } from './fixtures';

test('archived never-published vehicle can be restored and permanently deleted through the UI', async ({
  adminPage,
  adminIdentity,
}) => {
  test.setTimeout(120_000);
  const id = crypto.randomUUID();
  const suffix = crypto.randomUUID();
  const name = `__qa_final_vehicle_lifecycle_${suffix}`;

  await db.insert(vehicles).values({
    id,
    name,
    slug: `qa-final-vehicle-${suffix}`,
    isActive: false,
    status: 'DRAFT',
    displayOrder: -100,
    passengerCapacity: 6,
    luggageCapacity: 4,
    createdBy: adminIdentity.id,
    updatedBy: adminIdentity.id,
  });

  const row = () => adminPage.locator('tr').filter({ hasText: name });
  const confirmAction = async (
    actionLabel: string,
    confirmLabel: string,
    method: 'POST' | 'DELETE',
  ) => {
    await row().getByRole('button', { name: actionLabel, exact: true }).dispatchEvent('click');
    await expect(adminPage.getByRole('button', { name: confirmLabel, exact: true }).last()).toBeVisible();
    const responsePromise = adminPage.waitForResponse((response) =>
      new URL(response.url()).pathname === `/admin/api/vehicles/${id}` &&
      response.request().method() === method,
    { timeout: 45_000 });
    await adminPage.getByRole('button', { name: confirmLabel, exact: true }).last().click({ timeout: 45_000 });
    const response = await responsePromise;
    expect(response.status()).toBe(200);
  };

  try {
    await adminPage.goto('/admin/araclar');
    await waitForSettledAdminPage(adminPage);
    await expect(row()).toBeVisible({ timeout: 30_000 });

    await confirmAction('Arşivle', 'Arşivle', 'POST');
    const archivedFilter = adminPage.locator('select').filter({
      has: adminPage.locator('option[value="ARCHIVED"]'),
    });
    await archivedFilter.selectOption('ARCHIVED');
    await expect(row()).toBeVisible();
    await expect(row().getByRole('button', { name: 'Arşivden Çıkar', exact: true })).toBeEnabled();
    await expect(row().getByRole('button', { name: 'Sil', exact: true })).toBeEnabled();

    await confirmAction('Arşivden Çıkar', 'Geri Yükle', 'POST');
    await archivedFilter.selectOption('');
    await expect(row()).toBeVisible();

    await confirmAction('Arşivle', 'Arşivle', 'POST');
    await archivedFilter.selectOption('ARCHIVED');
    await expect(row()).toBeVisible();
    await confirmAction('Sil', 'Kalıcı Sil', 'DELETE');
    await expect(row()).toHaveCount(0);

    const actions = await db
      .select({ action: auditLogs.action })
      .from(auditLogs)
      .where(eq(auditLogs.entityId, id));
    const counts = actions.reduce<Record<string, number>>((all, { action }) => ({
      ...all,
      [action]: (all[action] ?? 0) + 1,
    }), {});
    expect(counts).toEqual({ ARCHIVE: 2, RESTORE: 1, DELETE: 1 });
  } finally {
    await db.delete(auditLogs).where(eq(auditLogs.entityId, id)).catch(() => {});
    await db.delete(vehicles).where(eq(vehicles.id, id)).catch(() => {});
  }
});

test('optional service complete UI lifecycle preserves the real catalog', async ({ adminPage, adminIdentity }) => {
  test.setTimeout(180_000);
  const suffix = crypto.randomUUID();
  const key = `QA_FINAL_${suffix.replaceAll('-', '').toUpperCase()}`;
  const peerKey = `${key}_PEER`;
  const name = `__qa_final_optional_${suffix}`;
  const editedName = `${name}_edited`;
  const peerId = crypto.randomUUID();
  let id = '';

  const original = await db.select().from(optionalServices).where(and(
    like(optionalServices.key, '%'),
  ));
  await db.insert(optionalServices).values({
    id: peerId,
    key: peerKey,
    name: `${name}_peer`,
    unitAmount: 100,
    active: false,
    customerVisible: false,
    displayOrder: 9001,
    createdBy: adminIdentity.id,
    updatedBy: adminIdentity.id,
  });

  const row = (label: string) => adminPage.locator('tr').filter({ hasText: label });
  const serviceRow = () => row(key).filter({ hasNotText: peerKey });
  const waitMutation = (method: string, path: RegExp) =>
    adminPage.waitForResponse(
      (response) => method === response.request().method() && path.test(new URL(response.url()).pathname),
      { timeout: 45_000 },
    );

  try {
    await adminPage.goto('/admin/fiyat-kurallari?tab=ek-hizmetler');
    await waitForSettledAdminPage(adminPage);
    await adminPage.getByRole('button', { name: 'Yeni hizmet' }).click({ timeout: 45_000 });
    const dialog = adminPage.getByRole('dialog', { name: 'Yeni ek hizmet' });
    await dialog.getByLabel('Türkçe hizmet adı').fill(name);
    await dialog.getByLabel('Türkçe kısa açıklama').fill('QA geçici açıklama');
    await dialog.getByLabel('Sabit anahtar').fill(key);
    await dialog.getByLabel('Birim ücret').fill('1');
    await dialog.getByLabel('Sıralama').fill('9000');
    const createPromise = waitMutation('POST', /^\/admin\/api\/ek-hizmetler$/);
    await dialog.getByRole('button', { name: 'Hizmet oluştur' }).click();
    expect((await createPromise).status()).toBe(201);
    const createRefreshPromise = waitMutation('GET', /^\/admin\/api\/ek-hizmetler$/);
    expect((await createRefreshPromise).status()).toBe(200);
    const [created] = await db.select({ id: optionalServices.id })
      .from(optionalServices)
      .where(eq(optionalServices.key, key));
    id = created.id;
    await expect(serviceRow()).toBeVisible();

    await serviceRow().getByRole('button', { name: 'Düzenle', exact: true }).click();
    const editDialog = adminPage.getByRole('dialog', { name: 'Ek hizmeti düzenle' });
    await editDialog.getByLabel('Türkçe hizmet adı').fill(editedName);
    const updatePromise = waitMutation('PATCH', /^\/admin\/api\/ek-hizmetler\/[^/]+$/);
    await editDialog.getByRole('button', { name: 'Kaydet' }).click();
    const updateResponse = await updatePromise;
    expect(updateResponse.status(), await updateResponse.text()).toBe(200);
    const reloadPromise = waitMutation('GET', /^\/admin\/api\/ek-hizmetler$/);
    await adminPage.goto('/admin/fiyat-kurallari?tab=ek-hizmetler', {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    expect((await reloadPromise).status()).toBe(200);
    await expect(serviceRow()).toBeVisible({ timeout: 30_000 });

    const [stateAfterEdit] = await db.select({ active: optionalServices.active })
      .from(optionalServices)
      .where(eq(optionalServices.id, id));
    const stateTransitions = stateAfterEdit.active
      ? ([['Pasifleştir', false], ['Aktifleştir', true]] as const)
      : ([['Aktifleştir', true], ['Pasifleştir', false]] as const);
    for (const [label, expected] of stateTransitions) {
      const responsePromise = waitMutation('PATCH', new RegExp(`/admin/api/ek-hizmetler/${id}$`));
      const refreshPromise = waitMutation('GET', /^\/admin\/api\/ek-hizmetler$/);
      await serviceRow().getByText(label, { exact: true }).click();
      expect((await responsePromise).status()).toBe(200);
      expect((await refreshPromise).status()).toBe(200);
      await expect.poll(async () => (await db.select({ active: optionalServices.active }).from(optionalServices).where(eq(optionalServices.id, id)))[0]?.active)
        .toBe(expected);
    }

    const peerRow = row(`${name}_peer`);
    for (const [label, direction] of [['Yukarı', 'up'], ['Aşağı', 'down']] as const) {
      const responsePromise = waitMutation('POST', new RegExp(`/admin/api/ek-hizmetler/${peerId}/reorder$`));
      await peerRow.getByRole('button', { name: label, exact: true }).click();
      expect((await responsePromise).status()).toBe(200);
    }

    await serviceRow().getByRole('button', { name: 'Arşivle', exact: true }).dispatchEvent('click');
    await expect(adminPage.getByText('Hizmeti Arşivle')).toBeVisible();
    let responsePromise = waitMutation('PATCH', new RegExp(`/admin/api/ek-hizmetler/${id}$`));
    await adminPage.getByRole('button', { name: 'Arşivle', exact: true }).last().dispatchEvent('click');
    expect((await responsePromise).status()).toBe(200);
    let filterRefreshPromise = waitMutation('GET', /^\/admin\/api\/ek-hizmetler$/);
    await adminPage.getByLabel('Arşivdekileri göster').check();
    expect((await filterRefreshPromise).status()).toBe(200);
    await expect(serviceRow()).toBeVisible();
    responsePromise = waitMutation('PATCH', new RegExp(`/admin/api/ek-hizmetler/${id}$`));
    await serviceRow().getByRole('button', { name: 'Arşivden Çıkar', exact: true }).click();
    expect((await responsePromise).status()).toBe(200);
    filterRefreshPromise = waitMutation('GET', /^\/admin\/api\/ek-hizmetler$/);
    await adminPage.getByLabel('Arşivdekileri göster').uncheck();
    expect((await filterRefreshPromise).status()).toBe(200);
    await expect(serviceRow()).toBeVisible();

    await serviceRow().getByRole('button', { name: 'Arşivle', exact: true }).dispatchEvent('click');
    await expect(adminPage.getByText('Hizmeti Arşivle')).toBeVisible();
    responsePromise = waitMutation('PATCH', new RegExp(`/admin/api/ek-hizmetler/${id}$`));
    await adminPage.getByRole('button', { name: 'Arşivle', exact: true }).last().dispatchEvent('click');
    expect((await responsePromise).status()).toBe(200);
    filterRefreshPromise = waitMutation('GET', /^\/admin\/api\/ek-hizmetler$/);
    await adminPage.getByLabel('Arşivdekileri göster').check();
    expect((await filterRefreshPromise).status()).toBe(200);
    await serviceRow().getByRole('button', { name: 'Sil', exact: true }).dispatchEvent('click');
    await expect(adminPage.getByText('Hizmeti Kalıcı Sil')).toBeVisible();
    const deletePromise = waitMutation('DELETE', new RegExp(`/admin/api/ek-hizmetler/${id}$`));
    await adminPage.getByRole('button', { name: 'Kalıcı Sil', exact: true }).dispatchEvent('click');
    expect((await deletePromise).status()).toBe(200);
    await expect(serviceRow()).toHaveCount(0);
  } finally {
    await db.delete(auditLogs).where(eq(auditLogs.adminUserId, adminIdentity.id)).catch(() => {});
    await db.delete(optionalServices).where(like(optionalServices.key, `${key}%`)).catch(() => {});
    const current = await db.select().from(optionalServices);
    expect(current.sort((a, b) => a.id.localeCompare(b.id)))
      .toEqual(original.sort((a, b) => a.id.localeCompare(b.id)));
  }
});

test('archived temporary location is permanently deleted through the browser', async ({ adminPage, adminIdentity }) => {
  test.setTimeout(120_000);
  const id = crypto.randomUUID();
  const suffix = crypto.randomUUID();
  const name = `__qa_final_location_delete_${suffix}`;
  const original = await db.select().from(locations);
  await db.insert(locations).values({
    id,
    name,
    slug: `qa-final-location-${suffix}`,
    type: 'DISTRICT',
    scope: 'LOCAL',
    isActive: false,
    displayOrder: 10000,
    createdBy: adminIdentity.id,
    updatedBy: adminIdentity.id,
  });
  const row = () => adminPage.locator('tr').filter({ hasText: name });
  try {
    await adminPage.goto('/admin/rezervasyon-ayarlari');
    await waitForSettledAdminPage(adminPage);
    const locationsTab = adminPage.getByRole('button', { name: 'Lokasyonlar' });
    await expect(locationsTab).toBeVisible({ timeout: 30_000 });
    await locationsTab.click();
    await expect(row()).toBeVisible();
    await row().getByRole('button', { name: 'Arşivle', exact: true }).dispatchEvent('click');
    await expect(adminPage.getByText('Lokasyonu Arşivle')).toBeVisible();
    let responsePromise = adminPage.waitForResponse((response) =>
      new URL(response.url()).pathname === `/admin/api/locations/${id}` && response.request().method() === 'PATCH',
    { timeout: 45_000 });
    const refreshPromise = adminPage.waitForResponse((response) =>
      new URL(response.url()).pathname === '/admin/api/locations' && response.request().method() === 'GET',
    { timeout: 45_000 });
    await adminPage.getByRole('button', { name: 'Arşivle', exact: true }).last().click({ timeout: 45_000 });
    expect((await responsePromise).status()).toBe(200);
    expect((await refreshPromise).status()).toBe(200);
    await expect(adminPage.getByText('Lokasyonu Arşivle')).toBeHidden();
    const archivedListPromise = adminPage.waitForResponse((response) =>
      new URL(response.url()).pathname === '/admin/api/locations' &&
      new URL(response.url()).searchParams.get('archived') === 'true' &&
      response.request().method() === 'GET',
    { timeout: 45_000 });
    await adminPage.getByLabel('Arşivlenenleri Göster').dispatchEvent('click');
    expect((await archivedListPromise).status()).toBe(200);
    await expect(row()).toBeVisible();
    await expect(row().getByRole('button', { name: 'Sil', exact: true })).toBeEnabled();
    await row().getByRole('button', { name: 'Sil', exact: true }).dispatchEvent('click');
    await expect(adminPage.getByText('Lokasyonu Kalıcı Sil')).toBeVisible();
    responsePromise = adminPage.waitForResponse((response) =>
      new URL(response.url()).pathname === `/admin/api/locations/${id}` && response.request().method() === 'DELETE',
    { timeout: 45_000 });
    await adminPage.getByRole('button', { name: 'Kalıcı Sil', exact: true }).click({ timeout: 45_000 });
    expect((await responsePromise).status()).toBe(200);
    await expect(row()).toHaveCount(0);
  } finally {
    await db.delete(auditLogs).where(eq(auditLogs.entityId, id)).catch(() => {});
    await db.delete(locations).where(eq(locations.id, id)).catch(() => {});
    const current = await db.select().from(locations);
    expect(current.sort((a, b) => a.id.localeCompare(b.id)))
      .toEqual(original.sort((a, b) => a.id.localeCompare(b.id)));
  }
});