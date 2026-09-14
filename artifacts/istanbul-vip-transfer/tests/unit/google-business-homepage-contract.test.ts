import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatHomepageReviewDate, isConfiguredGoogleReviewUrl } from '../../lib/google-review-public';

const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

describe('public Google Business review contracts', () => {
  it('filters the public reader to a connected selected location and verified visible source', () => {
    const reader = read('lib/homepage-public-content.ts');
    const section = reader.slice(
      reader.indexOf('export async function getPublishedHomepageReviews'),
      reader.indexOf('export async function getPublishedHomepageFaqs'),
    );

    expect(section).toContain("eq(socialPlatforms.key, 'google_business')");
    expect(section).toContain('eq(socialPlatforms.connected, true)');
    expect(section).toContain('typeof accountName !== \'string\'');
    expect(section).toContain('typeof locationName !== \'string\'');
    expect(section).toContain("eq(googleReviews.source, 'google_business')");
    expect(section).toContain('eq(googleReviews.locationResourceName, locationName)');
    expect(section).toContain('eq(googleReviews.isVisible, true)');
    // A token refresh may disable the channel. Verified cached rows remain
    // publishable while the connection and selected location still exist.
    expect(section).not.toContain('eq(socialPlatforms.enabled, true)');
  });

  it('allows only safe HTTPS review links and renders valid dates', () => {
    expect(isConfiguredGoogleReviewUrl('https://g.page/r/example/review')).toBe(true);
    expect(isConfiguredGoogleReviewUrl('http://g.page/r/example/review')).toBe(false);
    expect(isConfiguredGoogleReviewUrl('javascript:alert(1)')).toBe(false);
    expect(isConfiguredGoogleReviewUrl('')).toBe(false);
    expect(formatHomepageReviewDate('2024-05-17T12:00:00.000Z', 'en')).toMatch(/2024/);
    expect(formatHomepageReviewDate(null, 'en')).toBeNull();
    expect(formatHomepageReviewDate('not-a-date', 'en')).toBeNull();

    const cards = read('components/Reviews.tsx');
    expect(cards).toContain('isConfiguredGoogleReviewUrl(cs.googleReviewUrl)');
    expect(cards).toContain('formatHomepageReviewDate(review.reviewDate, lang)');
    expect(cards).toContain('{reviewUrl &&');
  });
});

describe('hourly sync lease and API contracts', () => {
  it('surfaces safe Google option errors and locks activation until a location is selected', () => {
    const panel = read('app/admin/(protected)/ayarlar/icerik-entegrasyonlari/SocialPlatformsPanel.tsx');
    const integration = read('lib/google-business.ts');

    expect(panel).toContain('setGoogleOptionsError(optionsPayload.error');
    expect(panel).toContain('googleActivationBlocked = googleSelectionMissing && !platform.enabled');
    expect(panel).toContain('toggleDisabled = !platform.connected || isBusy || googleActivationBlocked');
    expect(panel).toContain('Aktifleştirmek için önce aşağıdan Google hesabı ve işletme konumu seçin.');
    expect(panel).toContain("(platform.key === 'google_business' && !platform.enabled)");
    expect(panel).toContain("platform.connected ? 'Yeniden Bağla' : 'Bağlan'");
    expect(panel).toContain("platform.enabled ? 'Pasif Et' : 'Aktif Et'");
    expect(panel).toContain('aria-label="Kanal durumu"');
    expect(panel).toContain('role="alert"');
    expect(panel).toContain("role={googleFeedback.type === 'error' ? 'alert' : 'status'}");
    expect(panel).toContain('payload.platform?.enabled');
    expect(panel).toContain('Google Business Profile kanalı aktifleştirildi.');
    expect(integration).toContain("reasons.includes('SERVICE_DISABLED')");
    expect(integration).toContain("reasons.includes('RATE_LIMIT_EXCEEDED')");
    expect(integration).toContain("detail.metadata?.quota_limit_value === '0'");
    expect(integration).toContain('proje istek kotası 0');
    expect(integration).toContain('Google Business Profile dakika kotası doldu.');
  });

  it('uses the one-hour interval, local guard, and expiring shared health lease', () => {
    const scheduler = read('lib/google-business-review-scheduler.ts');
    expect(scheduler).toContain('60 * 60 * 1_000');
    expect(scheduler).toContain('let started = false');
    expect(scheduler).toContain('let runInProgress = false');
    expect(scheduler).toContain('healthCheckLeases');
    expect(scheduler).toContain('onConflictDoUpdate');
    expect(scheduler).toContain('expiresAt} < now()');
    expect(scheduler).toContain('lockName: LEASE_NAME');
    expect(scheduler).toContain('runGoogleBusinessReviewSync(options');
  });

  it('routes manual and cron runs through the leased wrapper', () => {
    const manual = read('app/admin/api/social-platforms/google-business/sync-reviews/route.ts');
    const cron = read('app/admin/api/cron/google-business-reviews/route.ts');
    expect(manual).toContain("from '@/lib/google-business-review-scheduler'");
    expect(manual).toContain('runGoogleBusinessReviewSync({ source: \'manual\'');
    expect(cron).toContain("from '@/lib/google-business-review-scheduler'");
    expect(cron).toContain('runGoogleBusinessReviewSync({ requireEnabled: true');
  });

  it('atomically upserts the globally unique Google review id for the selected location', () => {
    const sync = read('lib/google-business.ts');
    expect(sync).toContain('target: googleReviews.externalReviewId');
    expect(sync).toContain('locationResourceName: meta.locationName');
    expect(sync).toContain('onConflictDoUpdate');
  });

  it('invalidates every homepage only after a complete sync result', () => {
    const scheduler = read('lib/google-business-review-scheduler.ts');
    const syncCall = scheduler.indexOf('await syncGoogleBusinessReviews');
    const revalidation = scheduler.indexOf('revalidateAllHomepages()', syncCall);
    expect(syncCall).toBeGreaterThanOrEqual(0);
    expect(revalidation).toBeGreaterThan(syncCall);
    expect(scheduler.slice(syncCall, revalidation)).not.toContain('catch');
  });
});

describe('homepage section removal contract', () => {
  it.each(['app/page.tsx', 'app/[lang]/page.tsx'])('%s retains Reviews but no PopularRegions', (file) => {
    const page = read(file);
    expect(page).not.toContain('PopularRegionsSection');
    expect(page).toContain('<Reviews items={reviews} homepageMode />');
  });
});