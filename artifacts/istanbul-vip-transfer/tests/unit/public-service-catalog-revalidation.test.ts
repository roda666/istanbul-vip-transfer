import { describe, expect, it, vi } from 'vitest';
import { getDictionary } from '@/lib/i18n';
import { getNav } from '@/lib/nav-config';

const { revalidatePath } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath }));

import { revalidatePublicServiceCatalog } from '@/lib/homepage-revalidation';

describe('CMS-backed public service navigation', () => {
  it('uses the category groups supplied by the public catalog instead of fixed service slugs', () => {
    const nav = getNav('tr', getDictionary('tr'), [
      {
        slug: 'airport',
        label: 'Havalimanı Transferleri',
        items: [
          { slug: 'istanbul-havalimani-transfer', label: 'İstanbul Havalimanı Transferi' },
          { slug: 'ankara-vip-transfer', label: 'Ankara VIP Transfer' },
        ],
      },
    ]);
    const services = nav.find((entry) => entry.href === '/hizmetler');

    expect(services?.groups).toEqual([
      {
        groupLabel: 'Havalimanı Transferleri',
        items: [
          {
            slug: 'istanbul-havalimani-transfer',
            label: 'İstanbul Havalimanı Transferi',
            href: '/istanbul-havalimani-transfer',
          },
          {
            slug: 'ankara-vip-transfer',
            label: 'Ankara VIP Transfer',
            href: '/ankara-vip-transfer',
          },
        ],
      },
    ]);
  });
});

describe('public service catalog invalidation', () => {
  it('revalidates public chrome, listing, category and sitemap for every locale', () => {
    revalidatePublicServiceCatalog({ categorySlugs: ['airport'] });

    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    expect(revalidatePath).toHaveBeenCalledWith('/sitemap.xml');
    expect(revalidatePath).toHaveBeenCalledWith('/hizmetler');
    expect(revalidatePath).toHaveBeenCalledWith('/hizmetler/airport');
    expect(revalidatePath).toHaveBeenCalledWith('/en/services');
    expect(revalidatePath).toHaveBeenCalledWith('/en/services/airport');
    expect(revalidatePath).toHaveBeenCalledWith('/de/dienstleistungen');
    expect(revalidatePath).toHaveBeenCalledWith('/de/dienstleistungen/airport');
  });

  it('limits translation invalidation to the changed locale', () => {
    revalidatePublicServiceCatalog({
      categorySlugs: ['airport'],
      locales: ['en'],
    });

    expect(revalidatePath).toHaveBeenCalledWith('/en');
    expect(revalidatePath).toHaveBeenCalledWith('/en/services');
    expect(revalidatePath).toHaveBeenCalledWith('/en/services/airport');
    expect(revalidatePath).not.toHaveBeenCalledWith('/de/dienstleistungen');
  });
});