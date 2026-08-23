/**
 * Serializable public service catalog types shared across server and client
 * components. The catalog is the public single source of truth for published
 * services, their category placement, and public visibility flags.
 */
export interface PublicServiceCategory {
  id: number;
  slug: string;
  label: string;
  sortOrder: number;
}

export interface PublicServiceCatalogItem {
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  displayOrder: number;
  heroImage: string | null;
  showOnHomepage: boolean;
  showInNav: boolean;
}

export interface PublicServiceNavigationItem {
  slug: string;
  label: string;
}

export interface PublicServiceNavigationGroup {
  slug: string;
  label: string;
  items: PublicServiceNavigationItem[];
}

export interface PublicServiceCatalog {
  categories: PublicServiceCategory[];
  services: PublicServiceCatalogItem[];
  navigationGroups: PublicServiceNavigationGroup[];
}