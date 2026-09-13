/**
 * One end-to-end contract for the public Google review surface.
 *
 * The database rows used here are uniquely scoped to this test and are always
 * removed. The pre-existing Google platform row is snapshotted and restored
 * field-for-field; no real review is edited or deleted.
 */
import { createHash } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { test, expect } from '@playwright/test';
import { db } from '../db';
import { googleReviews, socialPlatforms } from '../db/schema';

const fixtureLocation = `accounts/playwright-fixture/locations/${crypto.randomUUID()}`;
const fixtureIds = [
  `playwright-google-review-${crypto.randomUUID()}`,
  `playwright-google-wrong-location-${crypto.randomUUID()}`,
  `playwright-manual-review-${crypto.randomUUID()}`,
] as const;

function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value, (_, item) =>
    item instanceof Date ? item.toISOString() : item,
  )).digest('hex');
}

async function invalidateHomepages() {
  // Public cache invalidation is performed by the production sync wrapper.
  // The fixture is installed before the first browser request in this spec.
}

async function snapshot() {
  const [platforms, reviews] = await Promise.all([
    db.select().from(socialPlatforms).where(eq(socialPlatforms.key, 'google_business')),
    db.select().from(googleReviews),
  ]);
  return {
    platformCount: platforms.length,
    reviewCount: reviews.length,
    hash: stableHash({ platforms, reviews }),
  };
}

test('TR and EN show only selected verified Google reviews without Popular Regions or overflow', async ({ page }) => {
  const [originalPlatform] = await db.select().from(socialPlatforms)
    .where(eq(socialPlatforms.key, 'google_business')).limit(1);
  expect(originalPlatform, 'Google platform seed row is required for isolated acceptance fixture').toBeTruthy();
  const before = await snapshot();
  const originalMeta = originalPlatform?.connectionMeta ?? {};

  try {
    await db.insert(googleReviews).values([
      {
        externalReviewId: fixtureIds[0],
        source: 'google_business',
        locationResourceName: fixtureLocation,
        reviewerName: 'Playwright Verified Reviewer',
        reviewText: 'Scoped verified review fixture — never a real customer review.',
        rating: 5,
        reviewLanguage: 'en',
        reviewDate: new Date('2024-05-17T12:00:00.000Z'),
        isVisible: true,
        sortOrder: -100,
        googleSourceIndicator: true,
      },
      {
        externalReviewId: fixtureIds[1],
        source: 'google_business',
        locationResourceName: `${fixtureLocation}-wrong`,
        reviewerName: 'Wrong Location Fixture',
        reviewText: 'This review must not be shown.',
        rating: 4,
        reviewLanguage: 'en',
        reviewDate: new Date('2024-05-18T12:00:00.000Z'),
        isVisible: true,
        sortOrder: -99,
        googleSourceIndicator: true,
      },
      {
        externalReviewId: fixtureIds[2],
        source: 'manual',
        locationResourceName: fixtureLocation,
        reviewerName: 'Manual Fixture',
        reviewText: 'This manual row must not be shown.',
        rating: 5,
        reviewLanguage: 'en',
        reviewDate: new Date('2024-05-19T12:00:00.000Z'),
        isVisible: true,
        sortOrder: -98,
        googleSourceIndicator: false,
      },
    ]);
    await db.update(socialPlatforms).set({
      connected: true,
      // Public display intentionally does not require enabled; a token
      // refresh can disable this flag while the verified cache remains valid.
      enabled: false,
      connectionMeta: {
        ...originalMeta,
        accountName: 'accounts/playwright-fixture',
        locationName: fixtureLocation,
        locationLabel: 'Playwright isolated fixture',
      },
    }).where(eq(socialPlatforms.id, originalPlatform!.id));
    await invalidateHomepages();

    for (const [path, popularText] of [['/', 'Popüler bölgeler'], ['/en', 'Popular regions']] as const) {
      for (const width of [390, 768]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('reviews-section')).toBeVisible();
        await expect(page.getByText('Playwright Verified Reviewer')).toBeVisible();
        await expect(page.getByText(/Scoped verified review fixture/)).toBeVisible();
        await expect(page.getByTestId('review-stars-0')).toHaveAttribute('aria-label', '5 stars');
        await expect(page.getByText(/2024/)).toBeVisible();
        await expect(page.getByText('Wrong Location Fixture')).toHaveCount(0);
        await expect(page.getByText('Manual Fixture')).toHaveCount(0);
        await expect(page.locator('body')).not.toContainText(popularText);
        expect(await page.evaluate(() =>
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        )).toBe(true);
      }
    }

    // A missing connection is a safe empty public state, not a fixture/manual
    // fallback. Restore it after this assertion so cleanup still compares the
    // exact original database snapshot.
    await db.update(socialPlatforms).set({
      connected: false,
      connectionMeta: {},
    }).where(eq(socialPlatforms.id, originalPlatform!.id));
    await invalidateHomepages();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('reviews-section')).toHaveCount(0);
  } finally {
    await db.delete(googleReviews).where(inArray(googleReviews.externalReviewId, [...fixtureIds]));
    if (originalPlatform) {
      await db.update(socialPlatforms).set({
        key: originalPlatform.key,
        name: originalPlatform.name,
        authType: originalPlatform.authType,
        requiredSecrets: originalPlatform.requiredSecrets,
        connected: originalPlatform.connected,
        enabled: originalPlatform.enabled,
        accessTokenEncrypted: originalPlatform.accessTokenEncrypted,
        accessTokenSecretEncrypted: originalPlatform.accessTokenSecretEncrypted,
        tokenExpiresAt: originalPlatform.tokenExpiresAt,
        connectionMeta: originalPlatform.connectionMeta,
        lastPublishId: originalPlatform.lastPublishId,
        lastPublishUrl: originalPlatform.lastPublishUrl,
        lastError: originalPlatform.lastError,
        connectedAt: originalPlatform.connectedAt,
        updatedAt: originalPlatform.updatedAt,
      }).where(eq(socialPlatforms.id, originalPlatform.id));
    }
    await invalidateHomepages();
    const after = await snapshot();
    const residue = await db.select({ id: googleReviews.id })
      .from(googleReviews)
      .where(inArray(googleReviews.externalReviewId, [...fixtureIds]));
    expect(residue).toHaveLength(0);
    expect(after.platformCount).toBe(before.platformCount);
    expect(after.reviewCount).toBe(before.reviewCount);
    expect(after.hash).toBe(before.hash);
  }
});