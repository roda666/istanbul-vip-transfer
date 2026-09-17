import { test, expect } from './admin-acceptance/fixtures';
import type { Page } from '@playwright/test';

type Contract = {
  target: 'HOMEPAGE' | 'PAGE' | 'BLOG_POST' | 'SERVICE' | 'VEHICLE';
  field: 'hero_image' | 'og_image';
  id: string;
  oldValue: string | null;
  oldAlt?: string | null;
  restore: () => Promise<void>;
};

type TargetRow = { id: string; heroImage?: string | null; heroImageAlt?: string | null; ogImage?: string | null };

async function targetRow(page: Page, target: Contract['target']): Promise<TargetRow> {
  const response = await page.request.get(`/admin/api/studio/images?target=${target}`);
  expect(response.ok(), `${target} target list must be available`).toBeTruthy();
  const payload = await response.json() as { targets?: TargetRow[] };
  const row = payload.targets?.[0];
  expect(row?.id, `${target} must have a real target record`).toBeTruthy();
  return row!;
}

async function generateAndAttach(page: Page, contract: Contract) {
  const prompt = `Editorial ${contract.target.toLowerCase()} image for Istanbul VIP transfer, an unbranded luxury vehicle at dawn, no people`;
  const altText = `${contract.target} güvenli gerçek AI görseli`;
  const generated = await page.request.post('/admin/api/studio/images', {
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
  expect(generated.ok(), `${contract.target}/${contract.field} generation must call the configured provider`).toBeTruthy();
  const generatedJson = await generated.json() as { image?: { imagePath?: string; model?: string } };
  // A stable private object path and provider model are the non-fake evidence:
  // the test does not route or mock this request.
  expect(generatedJson.image?.model, 'generation must return the configured provider model').toBeTruthy();
  const imagePath = generatedJson.image?.imagePath;
  expect(imagePath).toMatch(/\/api\/storage\/objects\/ai-images\//);

  const attached = await page.request.post('/admin/api/studio/images', {
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

test('all inline AI image field contracts use the real provider, persist, reload, and restore', async ({ adminPage }) => {
  const page = adminPage;
  const homepageResponse = await page.request.get('/admin/api/homepage/tr');
  expect(homepageResponse.ok(), 'homepage source must be available').toBeTruthy();
  const homepageRecord = await homepageResponse.json() as {
    id: string;
    sections: { hero: Record<string, string | null>; seo: Record<string, string | null> };
  };
  const homepageSections = structuredClone(homepageRecord.sections);

  const pageRow = await targetRow(page, 'PAGE');
  const blogRow = await targetRow(page, 'BLOG_POST');
  const serviceRow = await targetRow(page, 'SERVICE');
  const vehicleRow = await targetRow(page, 'VEHICLE');
  const contracts: Contract[] = [
    {
      target: 'HOMEPAGE', field: 'hero_image', id: homepageRecord.id,
      oldValue: homepageSections.hero?.imagePath ?? null, oldAlt: homepageSections.hero?.imageAlt ?? null,
      restore: async () => { homepageSections.hero.imagePath = homepageRecord.sections.hero.imagePath; homepageSections.hero.imageAlt = homepageRecord.sections.hero.imageAlt; },
    },
    {
      target: 'HOMEPAGE', field: 'og_image', id: homepageRecord.id,
      oldValue: homepageSections.seo?.ogImage ?? null, oldAlt: homepageSections.seo?.ogImageAlt ?? null,
      restore: async () => { homepageSections.seo.ogImage = homepageRecord.sections.seo.ogImage; homepageSections.seo.ogImageAlt = homepageRecord.sections.seo.ogImageAlt; },
    },
    {
      target: 'PAGE', field: 'hero_image', id: pageRow.id, oldValue: pageRow.heroImage ?? null, oldAlt: pageRow.heroImageAlt ?? null,
      restore: async () => { expect((await page.request.put(`/admin/api/content/${pageRow.id}`, { data: { heroImage: pageRow.heroImage, heroImageAlt: pageRow.heroImageAlt } })).ok()).toBeTruthy(); },
    },
    {
      target: 'BLOG_POST', field: 'og_image', id: blogRow.id, oldValue: blogRow.ogImage ?? null,
      restore: async () => { expect((await page.request.put(`/admin/api/blog/${blogRow.id}`, { data: { ogImage: blogRow.ogImage } })).ok()).toBeTruthy(); },
    },
    {
      target: 'SERVICE', field: 'og_image', id: serviceRow.id, oldValue: serviceRow.ogImage ?? null,
      restore: async () => { expect((await page.request.put(`/admin/api/service-pages/${serviceRow.id}`, { data: { ogImage: serviceRow.ogImage, saveAsDraft: true } })).ok()).toBeTruthy(); },
    },
    {
      target: 'VEHICLE', field: 'og_image', id: vehicleRow.id, oldValue: vehicleRow.ogImage ?? null,
      restore: async () => { expect((await page.request.put(`/admin/api/vehicles/${vehicleRow.id}`, { data: { ogImage: vehicleRow.ogImage } })).ok()).toBeTruthy(); },
    },
  ];

  try {
    for (const contract of contracts) {
      const path = await generateAndAttach(page, contract);
      const refreshed = await page.request.get(`/admin/api/studio/images?target=${contract.target}`);
      expect(refreshed.ok()).toBeTruthy();
      const rows = await refreshed.json() as { targets: TargetRow[] };
      const row = rows.targets.find(item => item.id === contract.id);
      const persisted = contract.target === 'HOMEPAGE'
        ? (await page.request.get('/admin/api/homepage/tr')).ok()
          ? ((await (await page.request.get('/admin/api/homepage/tr')).json() as { sections: { hero: Record<string, string | null>; seo: Record<string, string | null> } }).sections[contract.field === 'hero_image' ? 'hero' : 'seo'][contract.field === 'hero_image' ? 'imagePath' : 'ogImage'])
          : null
        : contract.field === 'hero_image' ? row?.heroImage : row?.ogImage;
      expect(persisted, `${contract.target}/${contract.field} must reload with persisted path`).toBe(path);
    }
  } finally {
    // Restore every CMS value, including if an earlier provider call failed.
    homepageSections.hero.imagePath = homepageRecord.sections.hero.imagePath;
    homepageSections.hero.imageAlt = homepageRecord.sections.hero.imageAlt;
    homepageSections.seo.ogImage = homepageRecord.sections.seo.ogImage;
    homepageSections.seo.ogImageAlt = homepageRecord.sections.seo.ogImageAlt;
    expect((await page.request.patch('/admin/api/homepage/tr', { data: { sections: homepageSections, autoPublish: false } })).ok()).toBeTruthy();
    for (const contract of contracts.slice(2)) await contract.restore();
  }
});