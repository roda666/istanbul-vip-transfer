import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { drivers, transferOperations, vehicles } from '../../db/schema';
import {
  assertNoHorizontalOverflow,
  assertTouchTargets,
  expect,
  screenshotEvidence,
  test,
  waitForSettledAdminPage,
} from './fixtures';

test('transfer form validates, creates a real assigned record, renders responsively, and cleans up', async ({
  adminIdentity,
  adminPage: page,
}) => {
  test.setTimeout(120_000);
  const marker = `Playwright Transfer ${adminIdentity.id.slice(0, 8)}`;
  const pickup = 'Acceptance Pickup';
  const dropoff = 'Acceptance Dropoff';
  const route = `${pickup} → ${dropoff}`;
  const planned = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  planned.setUTCMinutes(0, 0, 0);
  const localInput = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(planned).replace(' ', 'T');

  const [driver] = await db.select({ id: drivers.id, name: drivers.name }).from(drivers)
    .where(eq(drivers.createdBy, adminIdentity.id)).limit(1);
  const [vehicle] = await db.select({ id: vehicles.id, name: vehicles.name }).from(vehicles)
    .where(eq(vehicles.createdBy, adminIdentity.id)).limit(1);
  expect(driver).toBeTruthy();
  expect(vehicle).toBeTruthy();

  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/admin/transferler', { waitUntil: 'domcontentloaded' });
    await waitForSettledAdminPage(page);
    await page.getByRole('button', { name: 'Yeni Transfer' }).click();

    const form = page.getByRole('form', { name: 'Yeni transfer oluşturma formu' });
    await page.getByRole('button', { name: 'Transfer Oluştur' }).click();
    expect(await form.locator(':invalid').count(), 'Required fields must block an empty transfer').toBeGreaterThan(0);

    await expect(form).toBeVisible();
    await form.getByLabel('Alış Zamanı').fill(localInput, { force: true });
    await form.getByLabel('Alış Konumu').fill(pickup, { force: true });
    await form.getByLabel('Varış Konumu').fill(dropoff, { force: true });
    await form.getByLabel('Rota Özeti').fill(route, { force: true });
    await form.getByLabel('Müşteri Özeti').fill(marker, { force: true });
    await form.getByLabel('Sürücü (İsteğe Bağlı)').selectOption({ label: driver!.name }, { force: true });
    await form.getByLabel('Araç (İsteğe Bağlı)').selectOption({ label: vehicle!.name }, { force: true });

    const createResponse = page.waitForResponse(response =>
      response.url().endsWith('/admin/api/transfers') &&
      response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Transfer Oluştur' }).click();
    const response = await createResponse;
    expect(response.status()).toBe(201);
    expect(response.headers()['content-type']).toContain('application/json');
    await expect(page.getByRole('status')).toContainText('Transfer başarıyla oluşturuldu.');
    await expect(page.getByText(marker, { exact: true }).first()).toBeVisible();
    await expect(page.locator('span').filter({ hasText: /^Atandı$/ }).first()).toBeVisible();

    for (const viewport of [
      { name: 'desktop', width: 1440, height: 1000 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'mobile', width: 390, height: 844 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await assertNoHorizontalOverflow(page);
      await assertTouchTargets(page);
      await screenshotEvidence(page, `transfer-operations/${viewport.name}`);
    }
  } finally {
    await db.delete(transferOperations).where(and(
      eq(transferOperations.customerSummary, marker),
      eq(transferOperations.createdBy, adminIdentity.id),
    ));
    const remaining = await db.select({ id: transferOperations.id }).from(transferOperations).where(and(
      eq(transferOperations.customerSummary, marker),
      eq(transferOperations.createdBy, adminIdentity.id),
    ));
    expect(remaining).toHaveLength(0);
  }
});