import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getReachableServiceImageUrl,
  resolveImageField,
  validateServiceImageAsset,
} from '../../lib/service-image-assets';

/**
 * Regression coverage for the bug where editing a service page and changing
 * only an unrelated field (e.g. `category`) failed with "Görsel URL'sine
 * ulaşılamıyor…" even though the image field itself was never touched.
 *
 * Root cause: the admin save route re-validated the hero/OG image on every
 * PATCH by making an outbound HTTP fetch — even when the image field was
 * unchanged, and even for the site's own object-storage URLs
 * (/api/storage/objects/...), which are served by a separate artifact and
 * are not a safe/guaranteed target for a same-origin reachability probe.
 */

const OWN_STORAGE_PATH = '/api/storage/objects/service-pages/istanbul-havalimani-transfer/hero.webp';
const UNREACHABLE_URL = 'https://example.invalid/does-not-exist.jpg';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveImageField — unrelated field changes are never blocked by image validation', () => {
  it('does not re-validate (or fetch) an unchanged image value', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await resolveImageField(UNREACHABLE_URL, UNREACHABLE_URL, 'Hero görseli');

    expect(result).toEqual({ value: UNREACHABLE_URL, warning: null });
    // The previously-accepted value must be trusted without any network call —
    // this is exactly the case that broke a category-only edit.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to the previous value and returns a warning instead of throwing when a NEW image fails validation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const previous = '/images/old-hero.webp';
    const result = await resolveImageField(UNREACHABLE_URL, previous, 'Hero görseli');

    expect(result.value).toBe(previous);
    expect(result.warning).toContain('Hero görseli');
    expect(result.warning).toContain(UNREACHABLE_URL);
  });

  it('accepts a changed value that points at our own object storage without an outbound fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await resolveImageField(OWN_STORAGE_PATH, '/images/old-hero.webp', 'Hero görseli');

    expect(result).toEqual({ value: OWN_STORAGE_PATH, warning: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('treats an explicit removal (new value empty) as a real change, not a validation failure', async () => {
    const result = await resolveImageField(null, '/images/old-hero.webp', 'Hero görseli');
    expect(result).toEqual({ value: null, warning: null });
  });
});

describe('validateServiceImageAsset — own storage is trusted, external failures name the URL', () => {
  it('never issues an outbound fetch for our own object-storage paths', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(validateServiceImageAsset(OWN_STORAGE_PATH)).resolves.toBe(OWN_STORAGE_PATH);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('throws a Turkish error naming the failing URL for an unreachable external image', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(validateServiceImageAsset(UNREACHABLE_URL)).rejects.toThrow(UNREACHABLE_URL);
    await expect(validateServiceImageAsset(UNREACHABLE_URL)).rejects.toThrow('ulaşılamıyor');
  });

  it('resolves null for an empty value without making any request', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(validateServiceImageAsset(null)).resolves.toBeNull();
    await expect(validateServiceImageAsset('  ')).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('getReachableServiceImageUrl — own storage short-circuits the network probe', () => {
  it('returns the absolute URL for an own-storage path without calling fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const url = await getReachableServiceImageUrl(OWN_STORAGE_PATH);
    expect(url).toBe(`https://www.istanbulviptransfer.com${OWN_STORAGE_PATH}`);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
