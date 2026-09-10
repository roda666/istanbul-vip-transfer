import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { localizedServicePath } from '@/lib/localized-service-path';
import { SUPPORTED_LANGS } from '@/lib/i18n';
import {
  assertServiceSlugConsistency,
  SLUG_TO_PAGE_KEY,
  TWO_CRUMB_SLUGS,
} from '@/lib/service-page-config';
import {
  getReachableServiceImageUrl,
  resolveImageField,
  validateServiceImageAsset,
} from '@/lib/service-image-assets';
import { getServiceOgImageUrl } from '@/lib/service-og-images';

const { revalidatePath, revalidateTag } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath, revalidateTag }));
import { revalidatePublicServiceDetail } from '@/lib/homepage-revalidation';

const source = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

describe('service CMS regression contracts', () => {
  it('#74 flushes Turkish and every localized concrete detail route', async () => {
    revalidatePath.mockClear();
    revalidateTag.mockClear();
    revalidatePublicServiceDetail('vip-transfer');

    for (const locale of ['tr', ...SUPPORTED_LANGS]) {
      expect(revalidatePath).toHaveBeenCalledWith(localizedServicePath('vip-transfer', locale));
    }
    expect(revalidatePath).toHaveBeenCalledWith('/sitemap.xml');

    const publishRoute = source('app/admin/api/service-pages/[id]/route.ts');
    const sourcePublishBranch = publishRoute.slice(
      publishRoute.indexOf("if (action === 'publishSource')"),
      publishRoute.indexOf("if (action === 'unpublishSource')"),
    );
    const translationPublishBranch = publishRoute.slice(
      publishRoute.indexOf("} else if (action === 'publish')"),
      publishRoute.indexOf("} else if (action === 'unpublish')"),
    );
    expect(sourcePublishBranch).toContain('revalidatePublicServiceDetail(row.slug)');
    expect(translationPublishBranch).toContain('revalidatePublicServiceDetail(row.slug, [locale])');
  });

  it('#75 keeps the central two-crumb registry internally consistent', () => {
    expect(() => assertServiceSlugConsistency()).not.toThrow();
    for (const slug of TWO_CRUMB_SLUGS) {
      expect(SLUG_TO_PAGE_KEY[slug]).toBeTruthy();
    }
  });

  it('#81 treats an empty submitted hero value as explicit removal', async () => {
    const result = await resolveImageField('', '/api/storage/objects/service/hero.webp', 'Hero görseli');
    expect(result).toEqual({ value: null, warning: null });
  });

  it('#82 keeps the service-list thumbnail contract and broken-image fallback', () => {
    const list = source('app/admin/(protected)/hizmetler/_HizmetlerList.tsx');
    expect(list).toContain('function CoverThumbnail');
    expect(list).toContain('src={item.heroImage}');
    expect(list).toContain('onError={() => setFailed(true)}');
    expect(list).toContain('Kapak görseli yüklenemedi');
  });

  it('#83 warns without blocking when a previously stored image becomes unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('gone')));
    const reachable = await getReachableServiceImageUrl('https://images.example.invalid/old.jpg');
    expect(reachable).toBeNull();

    const field = source('app/admin/_components/ImageUploadField.tsx');
    expect(field).toContain('Kayıtlı görsele şu anda ulaşılamıyor');
    expect(field).toContain('Düzenlemeyi kaydetmeniz engellenmez');
  });

  it('#84 uses a service-specific OG fallback when a stored image is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('gone')));
    await expect(getReachableServiceImageUrl('https://images.example.invalid/og.jpg')).resolves.toBeNull();
    expect(getServiceOgImageUrl('vip-transfer', 'https://www.istanbulviptransfer.com'))
      .toBe('https://www.istanbulviptransfer.com/images/og/og-vip-transfer.jpg');

    const route = source('app/[lang]/[...slug]/page.tsx');
    expect(route).toContain('dbMeta.socialImage ?? fallback');
    expect(route).toContain('page.ogImage ?? page.heroImage');
    expect(route).toContain('probeOwnStorage: true');
  });

  it('#84 probes deleted own-storage objects for metadata without changing save-time trust', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
      headers: new Headers(),
    });
    vi.stubGlobal('fetch', fetchSpy);
    const ownPath = '/api/storage/objects/service-pages/vip-transfer/hero.webp';

    await expect(getReachableServiceImageUrl(ownPath)).resolves.toBe(
      'https://www.istanbulviptransfer.com/api/storage/objects/service-pages/vip-transfer/hero.webp',
    );
    expect(fetchSpy).not.toHaveBeenCalled();

    await expect(getReachableServiceImageUrl(ownPath, { probeOwnStorage: true })).resolves.toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toContain('/api/storage/objects/service-pages/vip-transfer/hero.webp');
  });

  it('rejects private, metadata, and arbitrary hosts before probe fetches', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    for (const host of ['127.0.0.1', '10.0.0.4', '169.254.169.254', 'evil.example']) {
      await expect(getReachableServiceImageUrl(`https://${host}/image.webp`, { probeOwnStorage: true }))
        .resolves.toBeNull();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('probes only approved HTTPS hosts and refuses redirects to unchecked destinations', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({ 'content-type': 'image/webp' }),
    });
    vi.stubGlobal('fetch', fetchSpy);
    await expect(getReachableServiceImageUrl('https://storage.googleapis.com/bucket/image.webp', { probeOwnStorage: true }))
      .resolves.toBe('https://storage.googleapis.com/bucket/image.webp');
    await expect(getReachableServiceImageUrl('https://preview.example.replit.dev/image.webp', { probeOwnStorage: true }))
      .resolves.toBe('https://preview.example.replit.dev/image.webp');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls.every(([, init]) => (init as RequestInit).redirect === 'error')).toBe(true);
  });

  it('applies the host allowlist to save-time validation before any outbound fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    for (const host of ['127.0.0.1', '169.254.169.254', '10.10.0.2', 'untrusted.example']) {
      await expect(validateServiceImageAsset(`https://${host}/image.webp`)).rejects.toThrow('ulaşılamıyor');
    }
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({ 'content-type': 'image/webp' }),
    });
    await expect(validateServiceImageAsset('https://storage.googleapis.com/bucket/image.webp'))
      .resolves.toBe('https://storage.googleapis.com/bucket/image.webp');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});