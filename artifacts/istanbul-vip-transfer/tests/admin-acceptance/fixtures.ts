import { expect, test as base, type BrowserContext, type Page } from '@playwright/test';
import { and, eq, or } from 'drizzle-orm';
import { db } from '../../db';
import { adminUsers, auditLogs, vehicles, drivers, locations, navigationItems } from '../../db/schema';
import { hashPassword } from '../../lib/auth/password';
import { cleanupAdminAcceptanceAccounts } from '../../scripts/cleanup-admin-acceptance';

const transientStatuses = new Set([502, 503]);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type AdminIdentity = { id: string; email: string; password: string };

export async function assertNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
}

export async function assertTouchTargets(
  page: Page,
  min = 44,
  selector = '[data-admin] button, [data-admin] a, [data-admin] input, [data-admin] select, [data-admin] textarea, [data-admin] [role="button"]',
) {
  const tooSmall = await page.locator(selector).evaluateAll((elements, minimum) => {
    const results: Array<{ selector: string; name: string; width: number; height: number }> = [];
    for (const element of elements) {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      // The native checkbox/radio glyph is intentionally small. Its label (or
      // an explicit clickable wrapper) is the actual touch target.
      let target = element;
      if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
        target = element.closest('label, [role="checkbox"], [role="radio"]') ?? element;
      }
      const box = target.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0 || (box.width >= minimum && box.height >= minimum)) continue;
      const name = element.getAttribute('aria-label') ||
        element.getAttribute('name') ||
        (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 80) ||
        element.tagName.toLowerCase();
      results.push({
        selector: element.tagName.toLowerCase() + (element.id ? `#${element.id}` : ''),
        name,
        width: Math.round(box.width),
        height: Math.round(box.height),
      });
    }
    return results;
  }, min);
  expect(tooSmall, `Touch targets smaller than ${min}px (selector/name/size)`).toEqual([]);
}

/** Wait for the DOM and app loading indicators, without a network-idle loop. */
export async function waitForSettledAdminPage(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('[aria-busy="true"], [data-loading="true"], [role="progressbar"]')
    .first()
    .waitFor({ state: 'hidden', timeout: 15_000 })
    .catch(() => {});
  await page.waitForFunction(() => {
    const loadingText = /^\s*yükleniyor(?:…|\.\.\.)\s*$/i;
    return !Array.from(document.querySelectorAll('body *')).some((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' &&
        box.width > 0 && box.height > 0 && loadingText.test(element.textContent ?? '');
    });
  }, undefined, { timeout: 15_000 }).catch(() => {});
}

export async function screenshotEvidence(page: Page, name: string) {
  const safeName = name.replace(/[^a-z0-9._-]+/gi, '-');
  const path = `test-results/admin-acceptance/${safeName}-${Date.now()}.png`;
  await page.screenshot({
    path,
    fullPage: false,
  });
  return path;
}

type AdminFixtures = {
  adminPage: Page;
};

type AdminWorkerFixtures = {
  adminIdentity: AdminIdentity;
  adminContext: BrowserContext;
};

export const test = base.extend<AdminFixtures, AdminWorkerFixtures>({
  adminIdentity: [async ({}, use) => {
    const id = crypto.randomUUID();
    const email = `playwright-admin-${id}@example.invalid`;
    const password = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
    await db.insert(adminUsers).values({
      id,
      email,
      passwordHash: await hashPassword(password),
      name: 'Playwright Acceptance Admin',
      role: 'SUPER_ADMIN',
      active: true,
    });
    // Keep the responsive action matrix independent from the shared database's
    // current catalog. Vehicles and drivers are commonly empty in development,
    // so provision one disposable row per worker and remove it before the
    // disposable admin. The prefixed slugs/names make cleanup deterministic.
    const vehicleId = crypto.randomUUID();
    const driverId = crypto.randomUUID();
    const locationId = crypto.randomUUID();
    const menuId = crypto.randomUUID();
    const fixtureSuffix = id.slice(0, 8);
    await db.insert(vehicles).values({
      id: vehicleId,
      name: `Acceptance Vehicle ${fixtureSuffix}`,
      slug: `playwright-acceptance-vehicle-${fixtureSuffix}`,
      vehicleType: 'VAN',
      passengerCapacity: 7,
      luggageCapacity: 7,
      displayOrder: 999999,
      createdBy: id,
      updatedBy: id,
    });
    await db.insert(drivers).values({
      id: driverId,
      name: `Acceptance Driver ${fixtureSuffix}`,
      displayOrder: 999999,
      createdBy: id,
      updatedBy: id,
    });
    await db.insert(locations).values({
      id: locationId,
      name: `Acceptance Location ${fixtureSuffix}`,
      slug: `playwright-acceptance-location-${fixtureSuffix}`,
      city: 'İstanbul',
      displayOrder: 999999,
      createdBy: id,
      updatedBy: id,
    });
    await db.insert(navigationItems).values({
      id: menuId,
      label: `Acceptance Menu ${fixtureSuffix}`,
      href: `/playwright-acceptance-${fixtureSuffix}`,
      location: 'HEADER',
      sortOrder: 999999,
      active: true,
    });
    try {
      await use({ id, email, password });
    } finally {
      // Transfer-operation references are nullable, but explicitly clear any
      // rows created by a browser run before deleting the disposable records.
      await db.delete(locations).where(eq(locations.id, locationId)).catch(() => {});
      await db.delete(navigationItems).where(eq(navigationItems.id, menuId)).catch(() => {});
      await db.delete(drivers).where(eq(drivers.id, driverId)).catch(() => {});
      await db.delete(vehicles).where(eq(vehicles.id, vehicleId)).catch(() => {});
      // Delete our audit trail before removing the account. The second
      // predicate also catches AdminUser entity rows written by older routes.
      await db.delete(auditLogs).where(or(
        eq(auditLogs.adminUserId, id),
        and(eq(auditLogs.entityType, 'AdminUser'), eq(auditLogs.entityId, id)),
      )).catch(() => {});
      await db.delete(adminUsers).where(and(eq(adminUsers.id, id), eq(adminUsers.email, email)))
        .catch(() => {});
      await cleanupAdminAcceptanceAccounts().catch(() => {});
    }
    },
    { scope: 'worker' }],
  adminContext: [async ({ browser, adminIdentity }, use) => {
    const context = await browser.newContext();
    try {
      const request = context.request;
      const baseURL = process.env.BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? '26004'}`;
      let response;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          response = await request.post(new URL('/admin/api/login', baseURL).toString(), {
            data: { email: adminIdentity.email, password: adminIdentity.password },
            headers: { 'content-type': 'application/json' },
            timeout: 45_000,
          });
          if (!transientStatuses.has(response.status())) break;
        } catch (error) {
          if (attempt === 2) throw error;
        }
        await sleep(250 * (attempt + 1));
      }
      expect(response?.status(), 'Admin API login must succeed').toBe(200);
      await use(context);
    } finally {
      await context.close().catch(() => {});
    }
  }, { scope: 'worker' }],
  adminPage: async ({ adminContext }, use) => {
    const page = await adminContext.newPage();
    try {
      await use(page);
    } finally {
      await page.close().catch(() => {});
    }
  },
});

export { expect };