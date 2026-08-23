import 'server-only';

import { getServiceCategories } from '@/lib/service-category-server';
import { getPublishedServiceList } from '@/lib/service-page-cms-list';
import type {
  PublicServiceCatalog,
  PublicServiceCatalogItem,
  PublicServiceCategory,
} from '@/lib/public-service-catalog-types';

export type {
  PublicServiceCatalog,
  PublicServiceCatalogItem,
  PublicServiceCategory,
} from '@/lib/public-service-catalog-types';

/**
 * The only public catalog assembler for services. Every consumer receives the
 * same active, published service rows and groups them using the category slug
 * written by the admin editor.
 */
export async function getPublicServiceCatalog(locale: string): Promise<PublicServiceCatalog> {
  const [categories, services] = await Promise.all([
    getServiceCategories(locale),
    getPublishedServiceList(locale),
  ]);

  const publicCategories: PublicServiceCategory[] = categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    label: category.label,
    sortOrder: category.sortOrder,
  }));
  const publicServices: PublicServiceCatalogItem[] = services;

  return {
    categories: publicCategories,
    services: publicServices,
    navigationGroups: publicCategories
      .map((category) => ({
        slug: category.slug,
        label: category.label,
        items: publicServices
          .filter((service) => service.category === category.slug && service.showInNav)
          .map((service) => ({ slug: service.slug, label: service.title })),
      }))
      .filter((group) => group.items.length > 0),
  };
}