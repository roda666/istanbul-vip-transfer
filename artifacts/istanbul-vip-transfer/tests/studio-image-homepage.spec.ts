import { test, expect } from './admin-acceptance/fixtures';
import type { APIRequestContext } from '@playwright/test';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { content, vehicles } from '../db/schema';

type Contract = {
  target: 'HOMEPAGE' | 'PAGE' | 'BLOG_POST' | 'SERVICE' | 'VEHICLE';
  field: 'hero_image' | 'og_image';
  id: string;
  oldValue: string | null;
  oldAlt?: string | null;
  restore: () => Promise<void>;
};

type TargetRow = { id: string; heroImage?: string | null; heroImageAlt?: string | null; ogImage?: string | null };

async function targetRow(request: APIRequestContext, baseURL: string, target: Contract['target']): Promise<TargetRow> {
  const response = await request.get(new URL(`/admin/api/studio/images?target=${target}`, baseURL).toString());
  expect(response.ok(), `${target} target list must be available (${response.status()} ${await response.text()})`).toBeTruthy();
  const payload = await response.json() as { targets?: TargetRow[] };
  const row = payload.targets?.[0];
  expect(row?.id, `${target} must have a real target record`).toBeTruthy();
  return row!;
}

async function generateAndAttach(request: APIRequestContext, baseURL: string, contract: Contract) {
  const prompt = `Cinematic wide-angle view of an Istanbul airport approach road at dawn, soft natural light and an empty roadway`;
  const altText = `${contract.target} güvenli gerçek AI görseli`;
  const endpoint = new URL('/admin/api/studio/images', baseURL).toString();
  const generated = await request.post(endpoint, {
    headers: { origin: baseURL },
    timeout: 90_000,
    data: {
      action: 'generate',
      target: contract.target,
      id: contract.id,
      prompt,
      altText,
      ...(contract.target === 'HOMEPAGE'
        ? { homepageField: contract.field }
        : { imageField: contract.field }),
    },
  });
  expect(
    generated.ok(),
    `${contract.target}/${contract.field} generation must call the configured provider (${generated.status()} ${await generated.text()})`,
  ).toBeTruthy();
  const generatedJson = await generated.json() as { image?: { imagePath?: string; model?: string } };
  // A stable private object path and provider model are the non-fake evidence:
  // the test does not route or mock this request.
  expect(generatedJson.image?.model, 'generation must return the configured provider model').toBeTruthy();
  const imagePath = generatedJson.image?.imagePath;
  expect(imagePath).toMatch(/\/api\/storage\/objects\/ai-images\//);

  const attached = await request.post(endpoint, {
    headers: { origin: baseURL },
    data: {
      action: 'attach',
      target: contract.target,
      id: contract.id,
      imagePath,
      altText,
      imageField: contract.target === 'HOMEPAGE' ? undefined : contract.field,
      homepageField: contract.target === 'HOMEPAGE' ? contract.field : undefined,
      placement: contract.field === 'og_image' ? 'og' : 'hero',
    },
  });
  expect(attached.ok(), `${contract.target}/${contract.field} attachment must persist`).toBeTruthy();
  return imagePath!;
}

test('all inline AI image field contracts use the real provider, persist, reload, and restore', async ({ adminContext, baseURL }) => {
  test.setTimeout(600_000);
  // The acceptance fixture creates a manual BrowserContext without Playwright's
  // baseURL option. Resolve every request explicitly while retaining its login
  // cookie jar through adminContext.request.
  if (!baseURL) throw new Error('Playwright BASE_URL is required for authenticated image contract requests');
  const origin = baseURL;
  const absolute = (path: string) => new URL(path, origin).toString();
  const mutationHeaders = { origin };
  const request = adminContext.request;
  const homepageResponse = await request.get(absolute('/admin/api/homepage/tr'));
  expect(homepageResponse.ok(), `homepage source must be available (${homepageResponse.status()} ${await homepageResponse.text()})`).toBeTruthy();
  const homepageRecord = await homepageResponse.json() as {
    id: string;
    sections: { hero: Record<string, string | null>; seo: Record<string, string | null> };
  };
  const [homepageSnapshot] = await db.select({
    body: content.body,
    updatedAt: content.updatedAt,
  }).from(content).where(eq(content.id, homepageRecord.id)).limit(1);
  expect(homepageSnapshot, 'homepage database snapshot must exist').toBeTruthy();
  const homepageSections = structuredClone(homepageRecord.sections);

  const pageRow = await targetRow(request, origin, 'PAGE');
  const blogRow = await targetRow(request, origin, 'BLOG_POST');
  const serviceRow = await targetRow(request, origin, 'SERVICE');
  const vehicleRow = await targetRow(request, origin, 'VEHICLE');
  const contentSnapshots = await db.select({
    id: content.id,
    heroImage: content.heroImage,
    heroImageAlt: content.heroImageAlt,
    ogImage: content.ogImage,
    updatedAt: content.updatedAt,
  }).from(content).where(inArray(content.id, [pageRow.id, blogRow.id, serviceRow.id]));
  const [vehicleSnapshot] = await db.select({
    id: vehicles.id,
    ogImage: vehicles.ogImage,
    updatedAt: vehicles.updatedAt,
  }).from(vehicles).where(eq(vehicles.id, vehicleRow.id)).limit(1);
  expect(contentSnapshots).toHaveLength(3);
  expect(vehicleSnapshot).toBeTruthy();
  const contracts: Contract[] = [
    {
      target: 'HOMEPAGE', field: 'hero_image', id: homepageRecord.id,
      oldValue: homepageSections.hero?.imagePath ?? null, oldAlt: homepageSections.hero?.imageAlt ?? null,
      restore: async () => {},
    },
    {
      target: 'HOMEPAGE', field: 'og_image', id: homepageRecord.id,
      oldValue: homepageSections.seo?.ogImage ?? null, oldAlt: homepageSections.seo?.ogImageAlt ?? null,
      restore: async () => {},
    },
    {
      target: 'PAGE', field: 'hero_image', id: pageRow.id, oldValue: pageRow.heroImage ?? null, oldAlt: pageRow.heroImageAlt ?? null,
      restore: async () => {},
    },
    {
      target: 'BLOG_POST', field: 'og_image', id: blogRow.id, oldValue: blogRow.ogImage ?? null,
      restore: async () => {},
    },
    {
      target: 'SERVICE', field: 'og_image', id: serviceRow.id, oldValue: serviceRow.ogImage ?? null,
      restore: async () => {},
    },
    {
      target: 'VEHICLE', field: 'og_image', id: vehicleRow.id, oldValue: vehicleRow.ogImage ?? null,
      restore: async () => {},
    },
  ];

  let primaryError: unknown;
  try {
    for (const contract of contracts) {
      const path = await generateAndAttach(request, origin, contract);
      const refreshed = await request.get(absolute(`/admin/api/studio/images?target=${contract.target}`));
      expect(refreshed.ok()).toBeTruthy();
      const rows = await refreshed.json() as { targets: TargetRow[] };
      const row = rows.targets.find(item => item.id === contract.id);
      const persisted = contract.target === 'HOMEPAGE'
        ? (await request.get(absolute('/admin/api/homepage/tr'))).ok()
          ? ((await (await request.get(absolute('/admin/api/homepage/tr'))).json() as { sections: { hero: Record<string, string | null>; seo: Record<string, string | null> } }).sections[contract.field === 'hero_image' ? 'hero' : 'seo'][contract.field === 'hero_image' ? 'imagePath' : 'ogImage'])
          : null
        : contract.field === 'hero_image' ? row?.heroImage : row?.ogImage;
      expect(persisted, `${contract.target}/${contract.field} must reload with persisted path`).toBe(path);
    }
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    // Restore every CMS value, including if an earlier provider call failed.
    homepageSections.hero.imagePath = homepageRecord.sections.hero.imagePath;
    homepageSections.hero.imageAlt = homepageRecord.sections.hero.imageAlt;
    homepageSections.seo.ogImage = homepageRecord.sections.seo.ogImage;
    homepageSections.seo.ogImageAlt = homepageRecord.sections.seo.ogImageAlt;
    const restoreErrors: unknown[] = [];
    try {
      await db.update(content).set({
        body: homepageSnapshot!.body,
        updatedAt: homepageSnapshot!.updatedAt,
      }).where(eq(content.id, homepageRecord.id));
      const [restoredHomepage] = await db.select({ body: content.body })
        .from(content).where(eq(content.id, homepageRecord.id)).limit(1);
      expect(restoredHomepage?.body).toBe(homepageSnapshot!.body);
      for (const snapshot of contentSnapshots) {
        await db.update(content).set({
          heroImage: snapshot.heroImage,
          heroImageAlt: snapshot.heroImageAlt,
          ogImage: snapshot.ogImage,
          updatedAt: snapshot.updatedAt,
        }).where(eq(content.id, snapshot.id));
      }
      await db.update(vehicles).set({
        ogImage: vehicleSnapshot!.ogImage,
        updatedAt: vehicleSnapshot!.updatedAt,
      }).where(eq(vehicles.id, vehicleSnapshot!.id));
    } catch (error) {
      restoreErrors.push(error);
    }
    for (const contract of contracts) {
      try { await contract.restore(); } catch (error) { restoreErrors.push(error); }
    }
    if (restoreErrors.length > 0) {
      console.error('Image contract restore failures:', restoreErrors.map(error =>
        error instanceof Error ? error.message : String(error),
      ));
      if (!primaryError) {
        expect(restoreErrors, 'all original CMS image values must be restored').toEqual([]);
      }
    }
  }
});