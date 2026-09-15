import { createHash } from 'node:crypto';
import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import { db, closeDatabaseConnection } from '../../db';
import {
  auditLogs,
  routeTollAlternativeItems,
  routeTollAlternatives,
  tollInstitutionApiSettings,
  tollPoints,
  tollTariffs,
  transferRoutes,
} from '../../db/schema';
import {
  assertNoHorizontalOverflow,
  assertTouchTargets,
  expect,
  test,
  waitForSettledAdminPage,
} from './fixtures';

const stableHash = (rows: unknown[]) => createHash('sha256')
  .update(JSON.stringify([...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), (_key, value) =>
    value instanceof Date ? value.toISOString() : value))
  .digest('hex');

const snapshot = async (adminId: string) => {
  const [points, tariffs, routes, alternatives, alternativeItems, settings, audits] = await Promise.all([
    db.select().from(tollPoints),
    db.select().from(tollTariffs),
    db.select().from(transferRoutes),
    db.select().from(routeTollAlternatives),
    db.select().from(routeTollAlternativeItems),
    db.select().from(tollInstitutionApiSettings),
    db.select().from(auditLogs).where(or(
      isNull(auditLogs.adminUserId),
      ne(auditLogs.adminUserId, adminId),
    )),
  ]);
  return {
    points: stableHash(points),
    tariffs: stableHash(tariffs),
    routes: stableHash(routes),
    alternatives: stableHash(alternatives),
    alternativeItems: stableHash(alternativeItems),
    settings: stableHash(settings),
    audits: stableHash(audits),
    settingsRows: settings,
  };
};

test('covers the admin toll point, route alternative, and API settings workflows', async ({
  adminPage,
  adminIdentity,
}) => {
  test.setTimeout(240_000);
  const suffix = crypto.randomUUID();
  const gatePointId = crypto.randomUUID();
  const routeId = crypto.randomUUID();
  const gateTariffIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  const ferryName = `__qa_requested_ferry_${suffix}`;
  const editedFerryName = `${ferryName}_edited`;
  const gatePointName = `__qa_requested_gate_${suffix}`;
  const routeName = `__qa_requested_route_${suffix}`;
  const primaryName = `__qa_requested_primary_${suffix}`;
  const secondaryName = `__qa_requested_secondary_${suffix}`;
  let apiSettingsId: number | null = null;
  const editedPrimaryName = `${primaryName}_saved`;
  const failedPrimaryName = `${primaryName}_failed`;
  const apiOrganization = `__qa_requested_org_${suffix}`;
  const apiUrl = `https://qa-${suffix}.example.invalid/tolls`;
  const apiSecret = `qa-secret-${suffix}`;
  let ferryPointId: string | null = null;
  let primaryAlternativeId: string | null = null;
  let secondaryAlternativeId: string | null = null;
  const before = await snapshot(adminIdentity.id);

  const checkResponsiveControls = async () => {
    for (const width of [1440, 1280, 768, 390]) {
      await adminPage.setViewportSize({ width, height: 900 });
      await assertNoHorizontalOverflow(adminPage);
      await assertTouchTargets(
        adminPage,
        44,
        'button:not(#next-logo), select, input[type="text"], input[type="number"], input[type="url"], input[type="password"]',
      );
    }
  };

  const alternativeCard = (id: string) => adminPage.getByTestId(`alternative-card-${id}`);
  const alternativeEditor = (id: string) => adminPage.getByTestId(`alternative-editor-${id}`);

  const selectAlternativePoint = async (editor: ReturnType<typeof alternativeEditor>, name: string) => {
    const checkbox = editor.locator('label').filter({ hasText: name }).locator('input[type="checkbox"]');
    await checkbox.check();
    return checkbox;
  };

  const createAlternative = async (name: string, includeFerry: boolean) => {
    await adminPage.getByRole('button', { name: 'Yeni Alternatif', exact: true }).click();
    const modal = adminPage.locator('.fixed').last();
    await modal.getByPlaceholder('Örn: 1. Köprü Üzerinden').fill(name);
    if (includeFerry) {
      await modal.locator('label').filter({ hasText: editedFerryName }).locator('input[type="checkbox"]').check();
    }
    await modal.locator('label').filter({ hasText: gatePointName }).locator('input[type="checkbox"]').check();
    const pair = modal.getByLabel(`${gatePointName} gişe çifti`, { exact: true });
    await pair.selectOption({ label: 'QA Entry → QA Exit' });
    const responsePromise = adminPage.waitForResponse((response) =>
      response.url().endsWith('/admin/api/pricing/tolls/alternatives') &&
      response.request().method() === 'POST');
    await modal.getByRole('button', { name: 'Kaydet', exact: true }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const json = await response.json() as { alternative: { id: string } };
    await expect(adminPage.getByText(name, { exact: true })).toBeVisible();
    return json.alternative.id;
  };

  try {
    // These are prerequisites only. The FERRY point and both alternatives are
    // deliberately created through the admin UI below.
    await db.insert(tollPoints).values({
      id: gatePointId,
      name: gatePointName,
      type: 'HIGHWAY',
      active: true,
      pricingMode: 'GATE_PAIR',
      bannedVehicleClasses: [],
      bannedVehicleTypes: [],
      createdBy: adminIdentity.id,
      updatedBy: adminIdentity.id,
    });
    await db.insert(tollTariffs).values([
      {
        id: gateTariffIds[0],
        tollPointId: gatePointId,
        vehicleClass: 'class_1',
        entryGateName: 'QA Entry',
        exitGateName: 'QA Exit',
        amountKurus: 1,
        manualAmountKurus: 1,
        sourceName: 'QA fixture',
        queriedAt: new Date(),
        active: true,
        createdBy: adminIdentity.id,
        updatedBy: adminIdentity.id,
      },
      {
        id: gateTariffIds[1],
        tollPointId: gatePointId,
        vehicleClass: 'class_2',
        entryGateName: 'QA Entry',
        exitGateName: 'QA Exit',
        amountKurus: 2,
        manualAmountKurus: 2,
        sourceName: 'QA fixture',
        queriedAt: new Date(),
        active: true,
        createdBy: adminIdentity.id,
        updatedBy: adminIdentity.id,
      },
      {
        id: gateTariffIds[2],
        tollPointId: gatePointId,
        vehicleClass: 'class_1',
        entryGateName: 'QA Entry 2',
        exitGateName: 'QA Exit 2',
        amountKurus: 3,
        manualAmountKurus: 3,
        sourceName: 'QA fixture',
        queriedAt: new Date(),
        active: true,
        createdBy: adminIdentity.id,
        updatedBy: adminIdentity.id,
      },
    ]);
    await db.insert(transferRoutes).values({
      id: routeId,
      slug: `qa-requested-toll-route-${suffix}`,
      name: routeName,
      origin: 'QA Origin',
      destination: 'QA Destination',
      distanceKm: 1,
      durationMinutes: 1,
      priceVitoMinEur: 1,
      priceVitoMaxEur: 2,
      priceSprinterMinEur: 1,
      priceSprinterMaxEur: 2,
      active: true,
    });

    await adminPage.goto('/admin/yol-gecis-ucretleri');
    await waitForSettledAdminPage(adminPage);

    // Create a temporary FLAT point through the actual form. Dedicated FERRY
    // GATE_PAIR behavior is covered by toll-quick-tariff.spec.ts.
    await adminPage.getByRole('button', { name: 'Yeni Geçiş Noktası', exact: true }).click();
    const pointModal = adminPage.locator('.fixed').last();
    await pointModal.locator('input[type="text"]').first().fill(ferryName);
    await pointModal.locator('select').first().selectOption('BRIDGE');
    const createPointResponse = adminPage.waitForResponse((response) =>
      response.url().endsWith('/admin/api/pricing/tolls') && response.request().method() === 'POST');
    await pointModal.getByRole('button', { name: 'Noktayı Ekle', exact: true }).click();
    const createdPointResponse = await createPointResponse;
    expect(createdPointResponse.status()).toBe(201);
    const createdPoint = await createdPointResponse.json() as { point: { id: string; type: string; pricingMode: string } };
    ferryPointId = createdPoint.point.id;
    expect(createdPoint.point).toMatchObject({ type: 'BRIDGE', pricingMode: 'FLAT' });
    await expect(adminPage.getByText(ferryName, { exact: true })).toBeVisible();
    const ferryAfterCreate = await db.select().from(tollPoints).where(eq(tollPoints.id, ferryPointId));
    expect(ferryAfterCreate).toHaveLength(1);
    expect(ferryAfterCreate[0]).toMatchObject({ type: 'BRIDGE', pricingMode: 'FLAT' });

    // Edit the point and verify its type, pricing mode, and active
    // state are not accidentally changed by the unrelated name update.
    const pointNameInput = adminPage.locator('input[type="text"]').first();
    await expect(pointNameInput).toHaveValue(ferryName);
    await pointNameInput.fill(editedFerryName);
    const activeLabel = adminPage.getByText('Sistemde Kullanılabilir (Aktif)', { exact: true });
    const activeCheckbox = activeLabel.locator('xpath=..').locator('input[type="checkbox"]');
    await expect(activeCheckbox).toBeChecked();
    const pointPatch = adminPage.waitForResponse((response) =>
      response.url().includes(`/admin/api/pricing/tolls/${ferryPointId}`) && response.request().method() === 'PATCH');
    await adminPage.getByRole('button', { name: 'Değişiklikleri Kaydet', exact: true }).click();
    expect((await pointPatch).status()).toBe(200);
    await expect.poll(async () => {
      const [point] = await db.select().from(tollPoints).where(eq(tollPoints.id, ferryPointId!));
      return point ? { name: point.name, type: point.type, pricingMode: point.pricingMode, active: point.active } : null;
    }).toEqual({ name: editedFerryName, type: 'BRIDGE', pricingMode: 'FLAT', active: true });

    // Add a class_1 row in the existing FLAT tariff form. Leaving the
    // amount empty creates a safe, explicitly unsourced fixture row.
    await adminPage.getByTestId('prepare-quick-tariff-class_1').click();
    const tariffModal = adminPage.locator('.fixed').last();
    const tariffPost = adminPage.waitForResponse((response) =>
      response.url().endsWith('/admin/api/pricing/tolls/tariffs') && response.request().method() === 'POST');
    await tariffModal.getByRole('button', { name: 'Tarifeyi Kaydet', exact: true }).click();
    expect((await tariffPost).status()).toBe(201);
    await expect(adminPage.getByTestId('tariff-row-class_1')).toHaveCount(1);
    expect(await db.select().from(tollTariffs).where(and(
      eq(tollTariffs.tollPointId, ferryPointId),
      eq(tollTariffs.vehicleClass, 'class_1'),
    ))).toHaveLength(1);
    await checkResponsiveControls();
    await adminPage.setViewportSize({ width: 1280, height: 900 });

    // Select the temporary route and create two alternatives through the UI.
    await adminPage.getByRole('button', { name: 'Rota Kombinasyonları', exact: true }).click();
    await adminPage.locator('select').first().selectOption(routeId);
    primaryAlternativeId = await createAlternative(primaryName, false);
    secondaryAlternativeId = await createAlternative(secondaryName, false);
    expect(primaryAlternativeId).not.toBe(secondaryAlternativeId);

    // Re-enter from persisted state after the two create-triggered refreshes;
    // this avoids retaining locators from the transient loading render.
    await adminPage.reload();
    await waitForSettledAdminPage(adminPage);
    await adminPage.getByRole('button', { name: 'Rota Kombinasyonları', exact: true }).click();
    await adminPage.locator('select').first().selectOption(routeId);
    const primary = alternativeCard(primaryAlternativeId);
    const secondary = alternativeCard(secondaryAlternativeId);
    await expect(primary).toBeVisible();
    await expect(secondary).toBeVisible();
    await expect(primary).toContainText(`QA Entry → QA Exit`);
    await expect(primary).not.toContainText(/inceleme|review/i);
    await expect(primary).not.toContainText(/notu/i);

    // Inline editor starts with a disabled unchanged save, and opening the
    // other alternative is mutually exclusive.
    await primary.getByRole('button', { name: 'Düzenle', exact: true }).click();
    let editor = alternativeEditor(primaryAlternativeId);
    await expect(editor.getByRole('button', { name: 'Kaydet', exact: true })).toBeDisabled();
    await secondary.getByRole('button', { name: 'Düzenle', exact: true }).click();
    await expect(alternativeEditor(primaryAlternativeId)).toHaveCount(0);
    await expect(alternativeEditor(secondaryAlternativeId)).toHaveCount(1);
    await alternativeEditor(secondaryAlternativeId).getByRole('button', { name: 'Vazgeç', exact: true }).click();
    await expect(secondary).toBeVisible();

    // Add, reorder, remove, and re-add a registered point. The existing gate
    // pair remains selected throughout the editor session.
    await primary.getByRole('button', { name: 'Düzenle', exact: true }).click();
    editor = alternativeEditor(primaryAlternativeId);
    const gateCheckbox = editor.locator('label').filter({ hasText: gatePointName }).locator('input[type="checkbox"]');
    await expect(gateCheckbox).toBeChecked();
    const ferryCheckbox = editor.locator('label').filter({ hasText: editedFerryName }).locator('input[type="checkbox"]');
    await selectAlternativePoint(editor, editedFerryName);
    await editor.getByRole('button', { name: `${editedFerryName} yukarı taşı`, exact: true }).click();
    await expect(editor.getByRole('button', { name: `${editedFerryName} yukarı taşı`, exact: true })).toBeDisabled();
    await expect(ferryCheckbox).toBeChecked();
    await expect(gateCheckbox).toBeChecked();
    await ferryCheckbox.uncheck();
    await ferryCheckbox.check();
    await expect(editor.getByLabel(`${gatePointName} gişe çifti`, { exact: true })).toHaveValue('qa entry\u0000qa exit');
    await expect(editor.getByRole('button', { name: 'Kaydet', exact: true })).toBeEnabled();

    // A failed PATCH keeps edit mode, the entered point selection, and the
    // selected gate pair instead of silently reverting local state.
    await editor.getByPlaceholder('Örn: 1. Köprü Üzerinden').fill(failedPrimaryName);
    await adminPage.route(`**/admin/api/pricing/tolls/alternatives/${primaryAlternativeId}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'QA geçici PATCH hatası' }) });
      } else {
        await route.continue();
      }
    }, { times: 1 });
    await editor.getByRole('button', { name: 'Kaydet', exact: true }).click();
    await expect(editor.getByRole('alert')).toContainText('QA geçici PATCH hatası');
    await expect(ferryCheckbox).toBeChecked();
    await expect(gateCheckbox).toBeChecked();
    await expect(editor.getByLabel(`${gatePointName} gişe çifti`, { exact: true })).toHaveValue('qa entry\u0000qa exit');
    await checkResponsiveControls();
    await adminPage.setViewportSize({ width: 1280, height: 900 });
    await editor.getByRole('button', { name: 'Vazgeç', exact: true }).click();
    await expect(primary).toBeVisible();

    // Double-clicking save is one mutation, closes the editor, and survives a
    // full reload. Keep the request slow enough to exercise the busy state.
    await primary.getByRole('button', { name: 'Düzenle', exact: true }).click();
    editor = alternativeEditor(primaryAlternativeId);
    await editor.getByPlaceholder('Örn: 1. Köprü Üzerinden').fill(editedPrimaryName);
    await selectAlternativePoint(editor, editedFerryName);
    await editor.getByRole('button', { name: `${editedFerryName} yukarı taşı`, exact: true }).click();
    await editor.getByLabel(`${gatePointName} gişe çifti`, { exact: true }).selectOption({ label: 'QA Entry 2 → QA Exit 2' });
    let alternativePatchCount = 0;
    await adminPage.route(`**/admin/api/pricing/tolls/alternatives/${primaryAlternativeId}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        alternativePatchCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      await route.continue();
    }, { times: 1 });
    const alternativePatch = adminPage.waitForResponse((response) =>
      response.url().includes(`/admin/api/pricing/tolls/alternatives/${primaryAlternativeId}`) &&
      response.request().method() === 'PATCH');
    await editor.getByRole('button', { name: 'Kaydet', exact: true }).dblclick();
    expect((await alternativePatch).status()).toBe(200);
    expect(alternativePatchCount).toBe(1);
    await expect(alternativeEditor(primaryAlternativeId)).toHaveCount(0);
    await expect(primary).toContainText(editedPrimaryName);
    await expect(primary).toContainText(editedFerryName);
    await expect(primary).toContainText('QA Entry 2 → QA Exit 2');

    await checkResponsiveControls();
    await adminPage.setViewportSize({ width: 1280, height: 900 });
    await adminPage.reload();
    await waitForSettledAdminPage(adminPage);
    await adminPage.getByRole('button', { name: 'Rota Kombinasyonları', exact: true }).click();
    await adminPage.locator('select').first().selectOption(routeId);
    await expect(adminPage.getByTestId(`alternative-card-${primaryAlternativeId}`)).toContainText(editedPrimaryName);
    await expect(adminPage.getByTestId(`alternative-card-${primaryAlternativeId}`)).toContainText('QA Entry 2 → QA Exit 2');

    // Cancel is side-effect free, while confirm removes only the selected
    // alternative (not its route, the other alternative, or tariffs).
    let deleteCount = 0;
    adminPage.on('request', (request) => {
      if (request.method() === 'DELETE' && request.url().includes('/admin/api/pricing/tolls/alternatives/')) deleteCount += 1;
    });
    const secondaryAfterReload = alternativeCard(secondaryAlternativeId);
    await adminPage.once('dialog', async (dialog) => dialog.dismiss());
    await secondaryAfterReload.getByRole('button', { name: 'Sil', exact: true }).click();
    await expect(secondaryAfterReload).toBeVisible();
    expect(deleteCount).toBe(0);
    await adminPage.once('dialog', async (dialog) => dialog.accept());
    const alternativeDelete = adminPage.waitForResponse((response) =>
      response.url().includes(`/admin/api/pricing/tolls/alternatives/${secondaryAlternativeId}`) &&
      response.request().method() === 'DELETE');
    await secondaryAfterReload.getByRole('button', { name: 'Sil', exact: true }).click();
    expect((await alternativeDelete).status()).toBe(200);
    await expect(alternativeCard(secondaryAlternativeId)).toHaveCount(0);
    await expect(alternativeCard(primaryAlternativeId)).toBeVisible();
    expect(deleteCount).toBe(1);
    expect(await db.select().from(transferRoutes).where(eq(transferRoutes.id, routeId))).toHaveLength(1);
    expect(await db.select().from(routeTollAlternatives).where(eq(routeTollAlternatives.id, primaryAlternativeId))).toHaveLength(1);
    expect(await db.select().from(tollTariffs).where(eq(tollTariffs.tollPointId, gatePointId))).toHaveLength(3);
    expect(await db.select().from(tollTariffs).where(eq(tollTariffs.tollPointId, ferryPointId))).toHaveLength(1);

    // Settings is a separate multi-record list. Add one isolated record,
    // reload it masked, and delete only that record.
    await adminPage.getByRole('main').getByRole('button', { name: 'Ayarlar', exact: true }).click();
    await expect(adminPage.getByText('API Entegrasyonu', { exact: true })).toBeVisible();
    await expect(adminPage.getByText(/Bayat Tarife|Bayatlama Eşiği|Yeni Yıla Girişte Uyar/i)).toHaveCount(0);
    await expect(adminPage.getByText('Araç Sınıfı Tarifeleri', { exact: true })).toHaveCount(0);
    await expect(adminPage.locator('[data-testid^="prepare-quick-tariff-"]')).toHaveCount(0);
    await adminPage.getByRole('button', { name: 'Yeni API Ekle', exact: true }).click();
    await adminPage.getByTestId('integration-organization').fill(apiOrganization);
    await adminPage.getByTestId('integration-service-url').fill(apiUrl);
    await adminPage.getByTestId('integration-api-code').fill(apiSecret);
    const settingsSaveButton = adminPage.getByTestId('integration-save');
    await expect(settingsSaveButton).toBeEnabled();
    const settingsPost = adminPage.waitForResponse((response) =>
      response.url().endsWith('/admin/api/pricing/tolls/integration-settings') &&
      response.request().method() === 'POST');
    await settingsSaveButton.click();
    const settingsPostResponse = await settingsPost;
    expect(settingsPostResponse.status()).toBe(201);
    const settingsPostBody = await settingsPostResponse.json();
    apiSettingsId = settingsPostBody.integration.id;
    expect(JSON.stringify(settingsPostBody)).not.toContain(apiSecret);
    const settingsCard = adminPage.getByTestId(`integration-card-${apiSettingsId}`);
    await expect(settingsCard).toContainText('••••');
    await expect(adminPage.locator('body')).not.toContainText(apiSecret);
    const storedSettings = await db.select().from(tollInstitutionApiSettings).where(eq(tollInstitutionApiSettings.id, apiSettingsId!));
    expect(storedSettings).toHaveLength(1);
    expect(storedSettings[0]).toMatchObject({ organizationName: apiOrganization, serviceUrl: apiUrl });
    expect(storedSettings[0].apiCodeCiphertext).not.toContain(apiSecret);
    const settingAudits = await db.select().from(auditLogs).where(and(
      eq(auditLogs.adminUserId, adminIdentity.id),
      eq(auditLogs.entityType, 'TollInstitutionApiSettings'),
    ));
    expect(JSON.stringify(settingAudits)).not.toContain(apiSecret);

    await adminPage.reload();
    await waitForSettledAdminPage(adminPage);
    await adminPage.getByRole('main').getByRole('button', { name: 'Ayarlar', exact: true }).click();
    const reloadedSettingsCard = adminPage.getByTestId(`integration-card-${apiSettingsId}`);
    await expect(reloadedSettingsCard).toContainText('••••');
    await expect(reloadedSettingsCard).toContainText(apiOrganization);
    await expect(reloadedSettingsCard).toContainText(apiUrl);
    await expect(adminPage.locator('body')).not.toContainText(apiSecret);
    await checkResponsiveControls();

    let settingsDeleteCount = 0;
    adminPage.on('request', (request) => {
      if (request.method() === 'DELETE' && request.url().endsWith(`/admin/api/pricing/tolls/integration-settings/${apiSettingsId}`)) settingsDeleteCount += 1;
    });
    await adminPage.once('dialog', async (dialog) => dialog.dismiss());
    await reloadedSettingsCard.getByRole('button', { name: 'Sil', exact: true }).click();
    await expect(reloadedSettingsCard.getByRole('button', { name: 'Sil', exact: true })).toBeVisible();
    expect(settingsDeleteCount).toBe(0);
    adminPage.once('dialog', async (dialog) => dialog.accept());
    const settingsDelete = adminPage.waitForResponse((response) =>
      response.url().endsWith(`/admin/api/pricing/tolls/integration-settings/${apiSettingsId}`) &&
      response.request().method() === 'DELETE');
    await reloadedSettingsCard.getByRole('button', { name: 'Sil', exact: true }).click();
    expect((await settingsDelete).status()).toBe(200);
    expect(settingsDeleteCount).toBe(1);
    await expect(reloadedSettingsCard).toHaveCount(0);
    expect(await db.select().from(tollInstitutionApiSettings).where(eq(tollInstitutionApiSettings.id, apiSettingsId!))).toHaveLength(0);
  } finally {
    // Remove dependent rows first, then restore the singleton settings row
    // byte-for-byte. Never delete or mutate unrelated production records.
    const discoveredFerryIds = await db.select({ id: tollPoints.id }).from(tollPoints)
      .where(inArray(tollPoints.name, [ferryName, editedFerryName]));
    const ferryIds = [...new Set([ferryPointId, ...discoveredFerryIds.map((row) => row.id)].filter((id): id is string => !!id))];
    const temporaryAlternativeIds = await db.select({ id: routeTollAlternatives.id })
      .from(routeTollAlternatives).where(eq(routeTollAlternatives.routeId, routeId));
    const temporaryAuditEntityIds = [
      routeId,
      gatePointId,
      ...ferryIds,
      ...gateTariffIds,
      ...temporaryAlternativeIds.map((row) => row.id),
    ];
    await db.delete(routeTollAlternativeItems).where(inArray(
      routeTollAlternativeItems.alternativeId,
      temporaryAlternativeIds.map((row) => row.id),
    )).catch(() => {});
    await db.delete(routeTollAlternatives).where(eq(routeTollAlternatives.routeId, routeId)).catch(() => {});
    await db.delete(tollTariffs).where(or(
      eq(tollTariffs.tollPointId, gatePointId),
      ferryIds.length > 0 ? inArray(tollTariffs.tollPointId, ferryIds) : eq(tollTariffs.tollPointId, crypto.randomUUID()),
    )).catch(() => {});
    await db.delete(tollPoints).where(or(
      eq(tollPoints.id, gatePointId),
      ferryIds.length > 0 ? inArray(tollPoints.id, ferryIds) : eq(tollPoints.id, crypto.randomUUID()),
    )).catch(() => {});
    await db.delete(transferRoutes).where(eq(transferRoutes.id, routeId)).catch(() => {});
    await db.delete(auditLogs).where(or(
      eq(auditLogs.adminUserId, adminIdentity.id),
      temporaryAuditEntityIds.length > 0 ? inArray(auditLogs.entityId, temporaryAuditEntityIds) : eq(auditLogs.entityId, crypto.randomUUID()),
    )).catch(() => {});

    if (apiSettingsId) await db.delete(tollInstitutionApiSettings).where(eq(tollInstitutionApiSettings.id, apiSettingsId)).catch(() => {});

    try {
      const after = await snapshot(adminIdentity.id);
      expect(after.points).toBe(before.points);
      expect(after.tariffs).toBe(before.tariffs);
      expect(after.routes).toBe(before.routes);
      expect(after.alternatives).toBe(before.alternatives);
      expect(after.alternativeItems).toBe(before.alternativeItems);
      expect(after.settings).toBe(before.settings);
      expect(after.audits).toBe(before.audits);
    } finally {
      await closeDatabaseConnection().catch(() => {});
    }
  }
});