import { createHash } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import sharp from 'sharp';
import { Storage } from '@google-cloud/storage';
import type { Page, Route } from '@playwright/test';
import { eq, inArray } from 'drizzle-orm';
import {
  content,
  contentTranslations,
  fixedPriceOverrides as routeFixedPriceOverrides,
  routePriceRules,
  transferRouteTranslations,
  transferRoutes,
  vehiclePricingProfiles,
  vehicles,
} from '../../db/schema';
import { db } from '../../db';
import {
  assertNoHorizontalOverflow,
  assertTouchTargets,
  expect,
  test,
  waitForSettledAdminPage,
} from './fixtures';

/**
 * This is intentionally one focused acceptance test.  In particular, the
 * browser context is not split between a visual test, an API test, and a
 * storage test: the before/after fingerprints below prove that all of the
 * disposable work is gone when the one journey finishes.
 */
test.describe('@route-package transfer-route admin acceptance', () => {
  test.describe.configure({ retries: 0 });
  test('one context covers the route editor, media lifecycle, translation locks, and quote selectors', async ({
    adminPage,
  }) => {
    test.setTimeout(120_000);

    const routeId = crypto.randomUUID();
    const primaryVehicleId = crypto.randomUUID();
    const secondaryVehicleId = crypto.randomUUID();
    const primaryProfileId = crypto.randomUUID();
    const secondaryProfileId = crypto.randomUUID();
    const routeSlug = `qa-route-package-${routeId}`;
    const primaryVehicleSlug = `qa-route-package-primary-${primaryVehicleId}`;
    const secondaryVehicleSlug = `qa-route-package-secondary-${secondaryVehicleId}`;
    const createdImagePaths: string[] = [];
    const createdFile = `/tmp/admin-acceptance-route-${routeId}.png`;
    const mockedGeneratedImagePath =
      `/api/storage/objects/transfer-routes/qa-route-package/${routeId}.webp`;
    const imageDeleteRequests: string[] = [];

    const expectFormValue = async (page: Page, expected: string): Promise<void> => {
      const found = await page.locator('input, textarea').evaluateAll((elements, expectedValue) =>
        elements.some((element) => {
          if (element instanceof HTMLInputElement) return element.value === expectedValue;
          if (element instanceof HTMLTextAreaElement) return element.value === expectedValue;
          return false;
        }),
        expected,
      );
      expect(found, `form control value "${expected}"`).toBe(true);
    };

    const apiJson = async (
      page: Page,
      args: {
        path: string;
        method?: string;
        body?: Record<string, unknown>;
      },
    ): Promise<{ status: number; payload: Record<string, unknown> }> => page.evaluate(
      async (requestArgs) => {
        const response = await fetch(requestArgs.path, {
          method: requestArgs.method ?? 'GET',
          headers: requestArgs.body ? { 'content-type': 'application/json' } : undefined,
          body: requestArgs.body ? JSON.stringify(requestArgs.body) : undefined,
          credentials: 'same-origin',
        });
        const text = await response.text();
        let payload: Record<string, unknown> = {};
        try {
          const parsed: unknown = text ? JSON.parse(text) : {};
          if (parsed && typeof parsed === 'object') payload = parsed as Record<string, unknown>;
        } catch {
          payload = { raw: text };
        }
        return { status: response.status, payload };
      },
      args,
    ),

    multipartUpload = async (
      page: Page,
      bytes: number[],
      origin: string,
      destination: string,
      fileName = 'route.png',
      mimeType = 'image/png',
    ) =>
      page.evaluate(
        async (uploadArgs) => {
          const form = new FormData();
          form.append('action', 'upload');
          form.append(
            'file',
            new File(
              [Uint8Array.from(uploadArgs.bytes)],
              uploadArgs.fileName,
              { type: uploadArgs.mimeType },
            ),
          );
          form.append('origin', uploadArgs.origin);
          form.append('destination', uploadArgs.destination);
          form.append('altText', 'QA route image');
          const response = await fetch('/admin/api/transfer-routes/image', {
            method: 'POST',
            body: form,
            credentials: 'same-origin',
          });
          const text = await response.text();
          let payload: Record<string, unknown> = {};
          try {
            const parsed: unknown = text ? JSON.parse(text) : {};
            if (parsed && typeof parsed === 'object') payload = parsed as Record<string, unknown>;
          } catch {
            payload = { raw: text };
          }
          return { status: response.status, payload };
        },
        { bytes, origin, destination, fileName, mimeType },
      );

    const storageDirectory = (): { bucketName: string; prefix: string } => {
      const rawDirectory = process.env.PRIVATE_OBJECT_DIR?.trim();
      if (!rawDirectory) throw new Error('PRIVATE_OBJECT_DIR is required for route storage inventory');
      const cleanedDirectory = rawDirectory.replace(/^gs:\/\//, '').replace(/^\/+/, '');
      if (rawDirectory.startsWith('/')) {
        return {
          bucketName: process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID?.trim() ?? '',
          prefix: cleanedDirectory,
        };
      }
      const separator = cleanedDirectory.indexOf('/');
      return separator < 0
        ? { bucketName: cleanedDirectory, prefix: '' }
        : {
          bucketName: cleanedDirectory.slice(0, separator),
          prefix: cleanedDirectory.slice(separator + 1),
        };
    };

    const storageClient = (): Storage => {
      const sidecar = process.env.REPLIT_SIDECAR_ENDPOINT ?? 'http://127.0.0.1:1106';
      return new Storage({
        credentials: {
          audience: 'replit',
          subject_token_type: 'access_token',
          token_url: `${sidecar}/token`,
          type: 'external_account',
          credential_source: {
            url: `${sidecar}/credential`,
            format: { type: 'json', subject_token_field_name: 'access_token' },
          },
          universe_domain: 'googleapis.com',
        },
        projectId: '',
      });
    };

    const objectInventory = async (): Promise<string[]> => {
      const { bucketName, prefix } = storageDirectory();
      if (!bucketName) throw new Error('Object storage bucket is required for route inventory');
      const objectPrefix = [prefix.replace(/\/+$/, ''), 'transfer-routes/'].filter(Boolean).join('/');
      const [files] = await storageClient().bucket(bucketName).getFiles({ prefix: objectPrefix });
      return files.map((file) => file.name).sort();
    };

    const storageObjectName = (imagePath: string): string => {
      const relativePath = imagePath.replace(/^\/api\/storage\/objects\//, '');
      const { prefix } = storageDirectory();
      return [prefix.replace(/^\/+|\/+$/g, ''), relativePath].filter(Boolean).join('/');
    };

    const canonicalValue = (value: unknown): unknown => {
      if (value instanceof Date) return value.toISOString();
      if (Array.isArray(value)) return value.map(canonicalValue);
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [key, canonicalValue(item)]),
        );
      }
      return value;
    };

    const tableHash = async (): Promise<Record<string, string>> => {
      const tables = {
        route: await db.select().from(transferRoutes),
        translation: await db.select().from(transferRouteTranslations),
        vehicle: await db.select().from(vehicles),
        vehiclePricing: await db.select().from(vehiclePricingProfiles),
        price: await db.select().from(routePriceRules),
        routeFixedPrice: await db.select().from(routeFixedPriceOverrides),
        content: await db.select().from(content),
        contentTranslation: await db.select().from(contentTranslations),
      };
      return Object.fromEntries(Object.entries(tables).map(([name, rows]) => {
        const serializedRows = rows
          .map((row) => JSON.stringify(canonicalValue(row)))
          .sort()
          .join('\n');
        return [name, createHash('sha256').update(serializedRows).digest('hex')];
      }));
    };

    const beforeHashes = await tableHash();
    const beforeObjects = await objectInventory();

    const routeRecord = {
      id: routeId,
      slug: routeSlug,
      name: `QA Route ${routeId.slice(0, 8)}`,
      origin: 'Istanbul Airport',
      destination: 'Kadıköy',
      distanceKm: 31,
      distanceSource: 'LEGACY_UNVERIFIED',
      durationMinutes: 54,
      priceVitoMinEur: 90,
      priceVitoMaxEur: 110,
      priceSprinterMinEur: 130,
      priceSprinterMaxEur: 160,
      defaultVehicleId: primaryVehicleId,
      active: true,
      displayOrder: 9000,
      description: 'QA source description',
      introParagraph: 'QA source introduction',
      relatedServiceSlug: null,
      indexable: false,
    } as const;
    const translationLocales = ['en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl'] as const;
    const lockedTranslation = {
      routeId,
      languageCode: 'en',
      title: 'Locked en',
      description: 'Locked description en',
      seoTitle: 'Locked SEO en',
      seoDescription: 'Locked SEO description en',
      ogTitle: 'Locked OG en',
      ogDescription: 'Locked OG description en',
      introParagraph: 'Locked intro en',
      transportOptions: [{ name: 'Locked', summary: 'Locked summary', downside: 'Locked downside' }],
      routeNotes: ['Locked note en'],
      faqItems: [{ question: 'Locked question?', answer: 'Locked answer.' }],
      status: 'DRAFT' as const,
      isManuallyLocked: true,
    };
    const initialTranslationPayload = translationLocales.map((languageCode) => (
      languageCode === 'en'
        ? { ...lockedTranslation }
        : {
          routeId,
          languageCode,
          title: `Initial ${languageCode}`,
          description: `Initial description ${languageCode}`,
          seoTitle: `Initial SEO ${languageCode}`,
          seoDescription: `Initial SEO description ${languageCode}`,
          ogTitle: `Initial OG ${languageCode}`,
          ogDescription: `Initial OG description ${languageCode}`,
          introParagraph: `Initial intro ${languageCode}`,
          transportOptions: [{ name: 'Initial', summary: 'Initial summary', downside: 'Initial downside' }],
          routeNotes: [`Initial note ${languageCode}`],
          faqItems: [{ question: `Initial ${languageCode}?`, answer: `Initial answer ${languageCode}.` }],
          status: 'DRAFT' as const,
          isManuallyLocked: false,
        }
    ));

    try {
      await db.insert(vehicles).values([
        {
          id: primaryVehicleId,
          name: `QA Primary ${primaryVehicleId.slice(0, 8)}`,
          slug: primaryVehicleSlug,
          priceCalculationEligible: true,
          isActive: true,
          displayOrder: 7000,
          status: 'PUBLISHED',
        },
        {
          id: secondaryVehicleId,
          name: `QA Secondary ${secondaryVehicleId.slice(0, 8)}`,
          slug: secondaryVehicleSlug,
          priceCalculationEligible: true,
          isActive: true,
          displayOrder: 6000,
          status: 'PUBLISHED',
        },
      ]);
      await db.insert(vehiclePricingProfiles).values([
        {
          id: primaryProfileId,
          vehicleId: primaryVehicleId,
          mode: 'DISTANCE',
          active: true,
          distanceOpeningKurus: 1000,
          distanceFirstKmKurus: 100,
          distanceThresholdKm: 100,
          distanceSecondKmKurus: 100,
        },
        {
          id: secondaryProfileId,
          vehicleId: secondaryVehicleId,
          mode: 'DISTANCE',
          active: true,
          distanceOpeningKurus: 900,
          distanceFirstKmKurus: 90,
          distanceThresholdKm: 100,
          distanceSecondKmKurus: 90,
        },
      ]);
      await db.insert(transferRoutes).values(routeRecord);
      await db.insert(transferRouteTranslations).values([lockedTranslation]);

      await adminPage.route('**/admin/api/transfer-routes/ai-fill', async (route: Route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            distanceKm: 31,
            durationMinutes: 54,
            distanceSource: 'ADMIN_VERIFIED',
            content: {
              description: 'Nested AI description',
              introParagraph: 'Nested AI introduction',
              transportOptions: [
                { name: 'Economy', summary: 'Nested summary', downside: 'Nested downside' },
                { name: 'Comfort', summary: 'Nested comfort', downside: 'Nested comfort downside' },
                { name: 'Private', summary: 'Nested private', downside: 'Nested private downside' },
              ],
              routeNotes: ['Nested route note'],
              faqItems: Array.from({ length: 6 }, (_, index) => ({
                question: `Nested question ${index + 1}?`,
                answer: `Nested answer ${index + 1}.`,
              })),
              seoTitle: 'Nested AI SEO',
              seoDescription: 'Nested AI SEO description',
              ogTitle: 'Nested AI OG',
              ogDescription: 'Nested AI OG description',
              relatedServiceSlug: null,
            },
            verification: { source: 'google_maps', distanceKm: 31, durationMinutes: 54 },
          }),
        });
      });
      await adminPage.route('**/admin/api/transfer-routes/image', async (route: Route) => {
        const request = route.request();
        if (request.method() !== 'POST' && request.method() !== 'DELETE') {
          await route.continue();
          return;
        }
        const requestContentType = (await request.headerValue('content-type')) ?? '';
        if (request.method() === 'POST' && requestContentType.includes('application/json')) {
          const requestBody = (request.postDataJSON() ?? {}) as Record<string, unknown>;
          if (requestBody.action === 'generate') {
            await route.fulfill({
              status: 201,
              contentType: 'application/json',
              headers: { 'x-route-image-source': 'controlled-acceptance-mock' },
              body: JSON.stringify({
                imagePath: mockedGeneratedImagePath,
                altText: 'Controlled generated route image',
                image: { imagePath: mockedGeneratedImagePath, altText: 'Controlled generated route image' },
              }),
            });
            return;
          }
        }
        if (request.method() === 'DELETE') {
          const requestBody = (request.postDataJSON() ?? {}) as Record<string, unknown>;
          if (requestBody.imagePath === mockedGeneratedImagePath) {
            imageDeleteRequests.push(mockedGeneratedImagePath);
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ ok: true, deleted: true }),
            });
            return;
          }
          // Real uploaded/imported objects must reach the application and
          // object storage; only the controlled AI path is browser-mocked.
          await route.continue();
          return;
        }
        await route.continue();
      });
      // Keep any browser-visible provider probes deterministic as well.  The
      // route PUT below has all eight locked locales, so no server-side
      // translation provider request is made (and no paid provider is needed).
      await adminPage.route('https://api.openai.com/**', async (route: Route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ choices: [{ message: { content: '{}' } }] }),
        });
      });
      await adminPage.route('https://translation.googleapis.com/**', async (route: Route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { translations: [] } }),
        });
      });

      const pngSource = await sharp({
        create: {
          width: 96,
          height: 96,
          channels: 3,
          background: { r: 30, g: 110, b: 190 },
        },
      }).png().toBuffer();
      await sharp(pngSource).png().toFile(createdFile);
      const pngBytes = Array.from(await readFile(createdFile));
      const jpegBytes = Array.from(await sharp(pngSource).jpeg({ quality: 85 }).toBuffer());
      const uploadInOpenModal = async (): Promise<string> => {
        await adminPage.getByRole('button', { name: 'Bilgisayardan Yükle' }).click();
        const fileInput = adminPage.locator('input[type="file"]');
        await expect(fileInput).toBeAttached();
        const responsePromise = adminPage.waitForResponse((response) =>
          response.request().method() === 'POST'
          && new URL(response.url()).pathname === '/admin/api/transfer-routes/image');
        await fileInput.setInputFiles(createdFile);
        const response = await responsePromise;
        expect(response.status()).toBe(201);
        const payload = await response.json() as Record<string, unknown>;
        const image = (payload.image ?? payload) as Record<string, unknown>;
        const path = String(image.imagePath);
        expect(path).toMatch(/^\/api\/storage\/objects\/transfer-routes\/.+\.webp$/);
        createdImagePaths.push(path);
        return path;
      };

      await adminPage.setViewportSize({ width: 390, height: 844 });
      const listResponse = await adminPage.goto('/admin/transfer-rotalari');
      expect(listResponse?.status()).toBe(200);
      await waitForSettledAdminPage(adminPage);
      await expect(adminPage).not.toHaveURL(/\/admin\/login/);

      await adminPage.getByRole('button', { name: 'Yeni Güzergah Ekle' }).click();
      const createHeading = adminPage.getByRole('heading', { name: 'Yeni Güzergah Ekle' });
      await expect(createHeading).toBeVisible();
      const mobileModal = adminPage.locator('div[style*="position: fixed"]').filter({ has: createHeading }).last();
      const mobileModalBox = await mobileModal.boundingBox();
      expect(mobileModalBox).toBeTruthy();
      expect(mobileModalBox!.x).toBeGreaterThanOrEqual(0);
      expect(mobileModalBox!.y).toBeGreaterThanOrEqual(0);
      expect(mobileModalBox!.x + mobileModalBox!.width).toBeLessThanOrEqual(390);
      expect(await mobileModal.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

      const languageStrip = adminPage.locator('[role="tablist"][aria-label="Güzergâh içerik dilleri"]');
      await expect(languageStrip).toBeVisible();
      await languageStrip.hover();
      await adminPage.mouse.wheel(500, 0);
      await languageStrip.dispatchEvent('touchstart', { touches: [] });
      await languageStrip.dispatchEvent('touchmove', { touches: [] });
      await languageStrip.dispatchEvent('touchend', { touches: [] });
      const languageTabs = languageStrip.locator('[role="tab"]');
      expect(await languageTabs.count()).toBe(9);
      await languageTabs.first().focus();
      await languageTabs.first().press('ArrowRight');
      await languageTabs.first().press('Home');
      await languageTabs.first().press('End');
      for (let tabIndex = 0; tabIndex < await languageTabs.count(); tabIndex += 1) {
        await languageTabs.nth(tabIndex).focus();
        await expect(languageTabs.nth(tabIndex)).toBeFocused();
      }
      await languageStrip.getByRole('tab', { name: 'Türkçe kaynak' }).click();

      await adminPage.getByPlaceholder('örn: Taksim → Sabiha Gökçen Havalimanı').fill('QA AI route');
      await adminPage.getByPlaceholder('örn: Taksim', { exact: true }).fill('Istanbul Airport');
      await adminPage.getByPlaceholder('örn: Sabiha Gökçen Havalimanı').fill('Kadıköy');
      await adminPage.getByPlaceholder('Güzergah için ziyaretçiye gösterilecek özgün açıklama')
        .fill('MANUAL DESCRIPTION MUST SURVIVE');
      await adminPage.locator('input[type="checkbox"]').first().uncheck();
      adminPage.once('dialog', (dialog) => dialog.dismiss());
      await adminPage.getByRole('button', { name: 'Otomatik Doldur' }).click();
      await expect(adminPage.getByText('Metin alanları başarıyla dolduruldu.')).toBeVisible();
      await expect(adminPage.getByPlaceholder('Güzergah için ziyaretçiye gösterilecek özgün açıklama'))
        .toHaveValue('MANUAL DESCRIPTION MUST SURVIVE');
      await expectFormValue(adminPage, 'Nested AI introduction');
      await expectFormValue(adminPage, '31');
      await expectFormValue(adminPage, '54');
      await expectFormValue(adminPage, 'Economy');
      await expectFormValue(adminPage, 'Comfort');
      await expectFormValue(adminPage, 'Private');
      await expectFormValue(adminPage, 'Nested route note');
      const generatedFaqAnswers = await adminPage.locator('textarea').evaluateAll((textareas) =>
        textareas.map((textarea) => (textarea as HTMLTextAreaElement).value));
      expect(generatedFaqAnswers.filter((value) => value.startsWith('Nested answer '))).toHaveLength(6);
      await expectFormValue(adminPage, 'Nested AI SEO');
      await expectFormValue(adminPage, 'Nested AI SEO description');
      await expectFormValue(adminPage, 'Nested AI OG');
      await expectFormValue(adminPage, 'Nested AI OG description');
      await expectFormValue(adminPage, 'QA AI route');
      await expectFormValue(adminPage, 'Istanbul Airport');
      await expectFormValue(adminPage, 'Kadıköy');

      await adminPage.getByRole('button', { name: 'AI ile Oluştur' }).click();
      const controlledImageResponse = adminPage.waitForResponse((response) => {
        if (
          response.request().method() !== 'POST'
          || new URL(response.url()).pathname !== '/admin/api/transfer-routes/image'
        ) return false;
        const requestBody = response.request().postDataJSON() as Record<string, unknown> | null;
        return requestBody?.action === 'generate';
      });
      await adminPage.getByRole('button', { name: 'Görsel Oluştur' }).click();
      expect((await controlledImageResponse).headers()['x-route-image-source']).toBe('controlled-acceptance-mock');
      await expect(adminPage.locator(`img[src="${mockedGeneratedImagePath}"]`)).toBeVisible();
      await adminPage.getByRole('button', { name: 'Kaldır / Değiştir' }).click();
      await expect.poll(() => imageDeleteRequests.includes(mockedGeneratedImagePath)).toBe(true);

      const firstUiUploadPath = await uploadInOpenModal();
      await expect(adminPage.locator(`img[src="${firstUiUploadPath}"]`)).toBeVisible();
      const altInput = adminPage.getByLabel('Alternatif Metin (Alt Text)');
      await expect(altInput).toBeVisible();
      await altInput.fill('Edited QA preview alt');
      const firstUiDeleteResponse = adminPage.waitForResponse((response) =>
        response.request().method() === 'DELETE'
        && new URL(response.url()).pathname === '/admin/api/transfer-routes/image');
      await adminPage.getByRole('button', { name: 'Kaldır / Değiştir' }).click();
      expect((await firstUiDeleteResponse).status()).toBe(200);
      await expect.poll(async () => (await objectInventory()).includes(storageObjectName(firstUiUploadPath))).toBe(false);

      const secondUiUploadPath = await uploadInOpenModal();
      await expect(adminPage.locator(`img[src="${secondUiUploadPath}"]`)).toBeVisible();

      // These checks intentionally run with the route modal still open. The
      // fixed Next dev overlay is excluded by scoping the modal to its h2.
      await assertNoHorizontalOverflow(adminPage);
      await assertTouchTargets(
        adminPage,
        44,
        'main button, main [role="button"], main input:not([type="checkbox"]):not([type="radio"]), main select, main textarea, div[style*="position: fixed"]:has(h2) button, div[style*="position: fixed"]:has(h2) input, div[style*="position: fixed"]:has(h2) select, div[style*="position: fixed"]:has(h2) textarea',
      );
      await adminPage.getByRole('button', { name: 'İptal' }).click();
      await expect.poll(async () => (await objectInventory()).includes(storageObjectName(secondUiUploadPath))).toBe(false);
      await expect(createHeading).toBeHidden();

      await adminPage.setViewportSize({ width: 768, height: 1024 });
      const editButton = adminPage.locator('tr').filter({ hasText: routeRecord.name })
        .getByRole('button', { name: 'Düzenle' });
      await expect(editButton).toBeVisible();
      await editButton.click();
      const editHeading = adminPage.getByRole('heading', { name: 'Güzergâhı Düzenle' });
      await expect(editHeading).toBeVisible();
      const tabletModal = adminPage.locator('div[style*="position: fixed"]').filter({ has: editHeading }).last();
      const tabletModalBox = await tabletModal.boundingBox();
      expect(tabletModalBox).toBeTruthy();
      expect(tabletModalBox!.x).toBeGreaterThanOrEqual(0);
      expect(tabletModalBox!.y).toBeGreaterThanOrEqual(0);
      expect(tabletModalBox!.x + tabletModalBox!.width).toBeLessThanOrEqual(768);
      expect(await tabletModal.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await expectFormValue(adminPage, routeRecord.name);
      await expectFormValue(adminPage, routeRecord.origin);
      await expectFormValue(adminPage, routeRecord.destination);

      const vehicleOptions = await apiJson(adminPage, { path: '/admin/api/vehicles?limit=100' });
      expect(vehicleOptions.status).toBe(200);
      const vehicleItems = Array.isArray(vehicleOptions.payload.items)
        ? vehicleOptions.payload.items as Array<Record<string, unknown>>
        : [];
      const primaryIndex = vehicleItems.findIndex((item) => item.id === primaryVehicleId);
      const secondaryIndex = vehicleItems.findIndex((item) => item.id === secondaryVehicleId);
      expect(primaryIndex).toBeGreaterThanOrEqual(0);
      expect(secondaryIndex).toBeGreaterThanOrEqual(0);
      expect(secondaryIndex, 'fast-quote/admin vehicle selector uses deterministic display order').toBeLessThan(primaryIndex);
      const defaultVehicleSelector = adminPage.locator('select').filter({
        has: adminPage.locator(`option[value="${primaryVehicleId}"]`),
      }).first();
      await expect(defaultVehicleSelector).toBeVisible();
      await expect(defaultVehicleSelector).toHaveValue(primaryVehicleId);

      await languageStrip.getByRole('tab', { name: 'English' }).click();
      await expectFormValue(adminPage, 'Locked en');
      await languageTabs.last().focus();
      await languageTabs.last().press('ArrowLeft');
      await languageTabs.last().press('Home');
      await languageTabs.last().press('End');
      await languageStrip.getByRole('tab', { name: 'Türkçe kaynak' }).click();
      await adminPage.getByRole('button', { name: 'İptal' }).click();

      const safeImportResult = await apiJson(adminPage, {
        path: '/admin/api/transfer-routes/image',
        method: 'POST',
        body: {
          action: 'import-url',
          url: 'https://httpbin.org/image/png',
          origin: routeRecord.origin,
          destination: routeRecord.destination,
        },
      });
      expect(safeImportResult.status).toBe(201);
      const importedImage = (safeImportResult.payload.image ?? safeImportResult.payload) as Record<string, unknown>;
      const importedImagePath = String(importedImage.imagePath);
      expect(importedImagePath).toMatch(/^\/api\/storage\/objects\/transfer-routes\/.+\.webp$/);
      createdImagePaths.push(importedImagePath);
      const servedImportedImage = await adminPage.evaluate(async (imagePath) => {
        const response = await fetch(imagePath, { credentials: 'same-origin' });
        return {
          status: response.status,
          contentType: response.headers.get('content-type'),
          bytes: Array.from(new Uint8Array(await response.arrayBuffer())),
        };
      }, importedImagePath);
      expect(servedImportedImage.status).toBe(200);
      expect(servedImportedImage.contentType).toContain('image/webp');
      const importedMetadata = await sharp(Buffer.from(servedImportedImage.bytes)).metadata();
      expect({
        format: importedMetadata.format,
        width: importedMetadata.width,
        height: importedMetadata.height,
      }).toEqual({ format: 'webp', width: 1600, height: 900 });
      const importedDeleteResult = await apiJson(adminPage, {
        path: '/admin/api/transfer-routes/image',
        method: 'DELETE',
        body: { imagePath: importedImagePath },
      });
      expect(importedDeleteResult.status).toBe(200);
      expect(importedDeleteResult.payload.deleted).toBe(true);
      expect(await objectInventory()).not.toContain(storageObjectName(importedImagePath));
      const importedNotFoundDeleteResult = await apiJson(adminPage, {
        path: '/admin/api/transfer-routes/image',
        method: 'DELETE',
        body: { imagePath: importedImagePath },
      });
      expect(importedNotFoundDeleteResult.status, 'image DELETE is idempotent after object removal').toBe(200);
      expect(importedNotFoundDeleteResult.payload.deleted).toBe(false);
      expect(importedNotFoundDeleteResult.payload.notFound).toBe(true);
      const deletedImportFetch = await adminPage.evaluate(async (imagePath) => {
        const response = await fetch(imagePath, { credentials: 'same-origin' });
        return response.status;
      }, importedImagePath);
      expect(deletedImportFetch).toBe(404);

      for (const privateTarget of [
        'http://127.0.0.1/private.png',
        'https://127.0.0.1/private.png',
        'https://localhost/private.png',
        'https://10.0.0.1/private.png',
      ]) {
        const privateImportResult = await apiJson(adminPage, {
          path: '/admin/api/transfer-routes/image',
          method: 'POST',
          body: {
            action: 'import-url',
            url: privateTarget,
            origin: routeRecord.origin,
            destination: routeRecord.destination,
          },
        });
        expect(privateImportResult.status, `private image target rejected: ${privateTarget}`).toBe(422);
        expect(typeof privateImportResult.payload.error).toBe('string');
      }

      const uploadResult = await multipartUpload(
        adminPage,
        pngBytes,
        routeRecord.origin,
        routeRecord.destination,
      );
      expect(uploadResult.status).toBe(201);
      const uploadImage = (uploadResult.payload.image ?? uploadResult.payload) as Record<string, unknown>;
      const firstUploadPath = String(uploadImage.imagePath);
      expect(firstUploadPath).toMatch(/^\/api\/storage\/objects\/transfer-routes\/.+\.webp$/);
      createdImagePaths.push(firstUploadPath);

      const jpegUploadResult = await multipartUpload(
        adminPage,
        jpegBytes,
        routeRecord.origin,
        `${routeRecord.destination} JPEG`,
        'route.jpg',
        'image/jpeg',
      );
      expect(jpegUploadResult.status).toBe(201);
      const jpegUploadImage = (jpegUploadResult.payload.image ?? jpegUploadResult.payload) as Record<string, unknown>;
      const jpegUploadPath = String(jpegUploadImage.imagePath);
      createdImagePaths.push(jpegUploadPath);
      const servedJpegUpload = await adminPage.evaluate(async (imagePath) => {
        const response = await fetch(imagePath, { credentials: 'same-origin' });
        return {
          status: response.status,
          bytes: Array.from(new Uint8Array(await response.arrayBuffer())),
        };
      }, jpegUploadPath);
      expect(servedJpegUpload.status).toBe(200);
      const jpegMetadata = await sharp(Buffer.from(servedJpegUpload.bytes)).metadata();
      expect({
        format: jpegMetadata.format,
        width: jpegMetadata.width,
        height: jpegMetadata.height,
      }).toEqual({ format: 'webp', width: 1600, height: 900 });
      const jpegDeleteResult = await apiJson(adminPage, {
        path: '/admin/api/transfer-routes/image',
        method: 'DELETE',
        body: { imagePath: jpegUploadPath },
      });
      expect(jpegDeleteResult.status).toBe(200);

      const firstUpdatePayload = {
        ...routeRecord,
        imagePath: firstUploadPath,
        imageAltText: 'First real QA image',
        translations: initialTranslationPayload.map((translation) => ({ ...translation })),
      } as Record<string, unknown>;
      const firstUpdateResult = await apiJson(adminPage, {
        path: `/admin/api/transfer-routes/${routeId}`,
        method: 'PUT',
        body: firstUpdatePayload,
      });
      expect(firstUpdateResult.status).toBe(200);

      const servedImage = await adminPage.evaluate(async (imagePath) => {
        const response = await fetch(imagePath, { credentials: 'same-origin' });
        const bytes = Array.from(new Uint8Array(await response.arrayBuffer()));
        return {
          status: response.status,
          contentType: response.headers.get('content-type'),
          bytes,
        };
      }, firstUploadPath);
      expect(servedImage.status).toBe(200);
      expect(servedImage.contentType).toContain('image/webp');
      const servedMetadata = await sharp(Buffer.from(servedImage.bytes)).metadata();
      expect({
        format: servedMetadata.format,
        width: servedMetadata.width,
        height: servedMetadata.height,
      }).toEqual({ format: 'webp', width: 1600, height: 900 });

      const referencedDeleteResult = await apiJson(adminPage, {
        path: '/admin/api/transfer-routes/image',
        method: 'DELETE',
        body: { imagePath: firstUploadPath },
      });
      expect(referencedDeleteResult.status, 'preview image cannot be deleted while route references it').toBe(409);

      const secondUploadResult = await multipartUpload(
        adminPage,
        pngBytes,
        routeRecord.origin,
        `${routeRecord.destination} replacement`,
      );
      expect(secondUploadResult.status).toBe(201);
      const secondUploadImage = (secondUploadResult.payload.image ?? secondUploadResult.payload) as Record<string, unknown>;
      const secondUploadPath = String(secondUploadImage.imagePath);
      createdImagePaths.push(secondUploadPath);
      const secondUpdateResult = await apiJson(adminPage, {
        path: `/admin/api/transfer-routes/${routeId}`,
        method: 'PUT',
        body: {
          ...routeRecord,
          imagePath: secondUploadPath,
          imageAltText: 'Replacement real QA image',
          translations: initialTranslationPayload.map((translation) => ({ ...translation })),
        },
      });
      expect(secondUpdateResult.status).toBe(200);
      expect(await objectInventory()).not.toContain(storageObjectName(firstUploadPath));

      const removeImageResult = await apiJson(adminPage, {
        path: `/admin/api/transfer-routes/${routeId}`,
        method: 'PUT',
        body: {
          ...routeRecord,
          imagePath: null,
          imageAltText: null,
          translations: initialTranslationPayload.map((translation) => ({ ...translation })),
        },
      });
      expect(removeImageResult.status).toBe(200);
      expect(await objectInventory()).not.toContain(storageObjectName(secondUploadPath));

      const completeTranslationPayload = translationLocales.map((languageCode) => ({
        ...initialTranslationPayload.find((translation) => translation.languageCode === languageCode)!,
        title: `Attempted overwrite ${languageCode}`,
        description: `Attempted overwrite description ${languageCode}`,
        seoTitle: `Attempted overwrite SEO ${languageCode}`,
        seoDescription: `Attempted overwrite SEO description ${languageCode}`,
        ogTitle: `Attempted overwrite OG ${languageCode}`,
        ogDescription: `Attempted overwrite OG description ${languageCode}`,
        introParagraph: `Attempted overwrite intro ${languageCode}`,
        transportOptions: [{ name: 'Attempted', summary: 'Attempted', downside: 'Attempted' }],
        routeNotes: [`Attempted ${languageCode}`],
        faqItems: [{ question: 'Attempted?', answer: 'Attempted.' }],
        status: 'DRAFT',
        isManuallyLocked: false,
      }));
      const lockedPutResult = await apiJson(adminPage, {
        path: `/admin/api/transfer-routes/${routeId}`,
        method: 'PUT',
        body: {
          ...routeRecord,
          imagePath: null,
          translations: completeTranslationPayload,
        },
      });
      expect(
        lockedPutResult.status,
        'server-side translation provider is not browser-interceptable: PUT sends eight complete payloads against preinserted locked DRAFT rows',
      ).toBe(200);
      const translationsAfterPut = await db.select().from(transferRouteTranslations)
        .where(eq(transferRouteTranslations.routeId, routeId));
      expect(translationsAfterPut).toEqual(expect.arrayContaining(
        [expect.objectContaining({
          languageCode: 'en',
          title: lockedTranslation.title,
          description: lockedTranslation.description,
          status: 'DRAFT',
          isManuallyLocked: true,
        })],
      ));
      expect(translationsAfterPut).toHaveLength(8);
      expect(translationsAfterPut.every((translation) => translation.status === 'DRAFT')).toBe(true);
      expect(translationsAfterPut.filter((translation) => translation.languageCode !== 'en'))
        .toEqual(expect.arrayContaining(translationLocales.slice(1).map((languageCode) => expect.objectContaining({
          languageCode,
          status: 'DRAFT',
          isManuallyLocked: false,
        }))));

      const quotePageResponse = await adminPage.goto('/admin/fiyat-kurallari');
      expect(quotePageResponse?.status()).toBe(200);
      await waitForSettledAdminPage(adminPage);
      const quoteVehicleSelector = adminPage.getByTestId('quote-vehicle');
      await expect(quoteVehicleSelector).toBeVisible();
      const quoteOrder = await quoteVehicleSelector.locator('option').evaluateAll((options) => options.map((option) => ({
        value: (option as HTMLOptionElement).value,
        label: option.textContent?.trim() ?? '',
      })));
      const quotePrimaryIndex = quoteOrder.findIndex((option) => option.value === primaryVehicleId);
      const quoteSecondaryIndex = quoteOrder.findIndex((option) => option.value === secondaryVehicleId);
      expect(quoteSecondaryIndex).toBeGreaterThanOrEqual(0);
      expect(quotePrimaryIndex).toBeGreaterThanOrEqual(0);
      expect(quoteSecondaryIndex, 'fast quote vehicle selector preserves display-order sorting').toBeLessThan(quotePrimaryIndex);
    } finally {
      await adminPage.unroute('**/admin/api/transfer-routes/ai-fill').catch(() => {});
      await adminPage.unroute('**/admin/api/transfer-routes/image').catch(() => {});
      await adminPage.unroute('https://api.openai.com/**').catch(() => {});
      await adminPage.unroute('https://translation.googleapis.com/**').catch(() => {});
      // Cleanup mutations intentionally use the authenticated same-origin API.
      await apiJson(adminPage, {
        path: `/admin/api/transfer-routes/${routeId}`,
        method: 'PUT',
        body: {
          ...routeRecord,
          imagePath: null,
          imageAltText: null,
          translations: initialTranslationPayload.map((translation) => ({ ...translation })),
        },
      }).catch(() => {});
      await apiJson(adminPage, {
        path: `/admin/api/transfer-routes/${routeId}`,
        method: 'DELETE',
      }).catch(() => {});
      for (const imagePath of createdImagePaths) {
        await apiJson(adminPage, {
          path: '/admin/api/transfer-routes/image',
          method: 'DELETE',
          body: { imagePath },
        }).catch(() => {});
      }
      await db.delete(transferRouteTranslations).where(eq(transferRouteTranslations.routeId, routeId)).catch(() => {});
      await db.delete(transferRoutes).where(eq(transferRoutes.id, routeId)).catch(() => {});
      await db.delete(vehiclePricingProfiles).where(inArray(vehiclePricingProfiles.id, [
        primaryProfileId,
        secondaryProfileId,
      ])).catch(() => {});
      await db.delete(vehicles).where(inArray(vehicles.id, [
        primaryVehicleId,
        secondaryVehicleId,
      ])).catch(() => {});
      await unlink(createdFile).catch(() => {});

      const afterHashes = await tableHash();
      const afterObjects = await objectInventory();
      expect(
        afterHashes,
        'route, translation, vehicle, vehicle-pricing, route-price, fixed-override, content, and content-translation tables restore exactly',
      ).toEqual(beforeHashes);
      expect(afterObjects, 'transfer-routes object-storage prefix restores exactly').toEqual(beforeObjects);
    }
  });
});