import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (file: string) =>
  readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

describe('public performance contracts', () => {
  it('keeps the homepage hero image discoverable and high priority', () => {
    const hero = source('components/Hero.tsx');
    expect(hero).toContain('priority');
    expect(hero).toContain('fetchPriority="high"');
    expect(hero).toContain('sizes="(max-width: 640px)');
  });

  it('prioritizes the route detail hero image with responsive sizing', () => {
    const route = source('components/TransferRouteDetail.tsx');
    expect(route).toContain('priority fetchPriority="high"');
    expect(route).toContain('sizes="(max-width: 900px) 100vw, 38vw"');
    expect(route).toContain('unoptimized={isProxiedStorageImage(route.imagePath)}');
  });

  it('serves proxied storage route images without the Next image optimizer', () => {
    const cards = source('components/PopularRoutesSection.tsx');
    expect(cards).toContain("src.startsWith('/api/storage/objects/')");
    expect(cards).toContain('unoptimized={isProxiedStorageImage(route.imagePath)}');
  });

  it('keeps vehicle names and descriptions fully readable', () => {
    const fleet = source('components/VehicleFleet.tsx');
    const nameBlock = fleet.slice(fleet.indexOf('<h3'), fleet.indexOf('</h3>'));
    const descriptionBlock = fleet.slice(fleet.indexOf('<p', fleet.indexOf('</h3>')), fleet.indexOf('</p>', fleet.indexOf('</h3>')));
    expect(nameBlock).not.toContain('line-clamp');
    expect(nameBlock).not.toContain('overflow-hidden');
    expect(descriptionBlock).not.toContain('line-clamp');
    expect(descriptionBlock).not.toContain('overflow-hidden');
  });

  it('keeps below-fold homepage sections server-rendered', () => {
    const page = source('app/page.tsx');
    expect(page).toContain("dynamic(() => import('@/components/Services'))");
    expect(page).toContain("dynamic(() => import('@/components/PopularRoutesSection'))");
    expect(page).toContain("dynamic(() => import('@/components/TrustSignals'))");
    expect(page).toContain("dynamic(() => import('@/components/Reviews'))");
    expect(page).toContain("dynamic(() => import('@/components/FAQ'))");
    expect(page).toContain("dynamic(() => import('@/components/Contact'))");
    expect(page).not.toContain('DeferredHomepageSection');
    expect(page).not.toContain('ssr: false');
    expect(source('app/globals.css')).toContain('content-visibility: auto');
    expect(source('app/globals.css')).toContain('contain: layout paint style');
  });

  it('loads the reservation form on demand without a chunk boundary', () => {
    const form = source('components/DeferredBookingForm.tsx');
    expect(form).toContain("document.addEventListener('ivt:booking-open'");
    expect(form).not.toContain('import(');
  });
});