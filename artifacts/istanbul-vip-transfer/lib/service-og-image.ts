import { SITE } from '@/lib/site-config';

/**
 * Canonical social preview image for every registered service page.
 *
 * These files are the same service-specific hero assets used by the public
 * service content seed. Keeping the mapping explicit prevents a missing or
 * stale CMS og_image value from collapsing all service shares to SITE.ogImage.
 */
const SERVICE_HERO_IMAGES: Record<string, string> = {
  'istanbul-havalimani-transfer': '/hero-images/istanbul-havalimani-transfer.jpg',
  'sabiha-gokcen-havalimani-transfer': '/hero-images/sabiha-gokcen-havalimani-transfer.jpg',
  'vip-transfer': '/hero-images/vip-transfer.jpg',
  'sehirler-arasi-transfer': '/hero-images/sehirler-arasi-transfer.jpg',
  'soforlu-arac-kiralama': '/hero-images/soforlu-arac-kiralama.jpg',
  'otel-transfer': '/hero-images/otel-transfer.jpg',
  'saglik-turizmi-transfer': '/hero-images/saglik-turizmi-transfer.jpg',
  'kurumsal-vip-transfer': '/hero-images/kurumsal-vip-transfer.jpg',
  'istanbul-bursa-transfer': '/hero-images/istanbul-bursa-transfer.jpg',
  'istanbul-sapanca-transfer': '/hero-images/istanbul-sapanca-transfer.jpg',
  'istanbul-gunubirlik-turlar': '/hero-images/istanbul-gunubirlik-turlar.jpg',
  'sapanca-masukiye-turu': '/hero-images/sapanca-masukiye-turu.jpg',
  'bursa-gunubirlik-tur': '/hero-images/bursa-gunubirlik-tur.jpg',
  'yalova-gunubirlik-tur': '/hero-images/yalova-gunubirlik-tur.jpg',
  'ucus-karsilama-meet-greet': '/hero-images/ucus-karsilama-meet-greet.jpg',
  'ankara-vip-transfer': '/hero-images/ankara-vip-transfer.jpg',
  'antalya-vip-transfer': '/hero-images/antalya-vip-transfer.jpg',
  'izmir-vip-transfer': '/hero-images/izmir-vip-transfer.jpg',
  'gelin-arabasi-kiralama': '/hero-images/gelin-arabasi-kiralama.jpg',
  'vip-protokol-secim-araci': '/hero-images/vip-protokol-secim-araci.jpg',
  'gunluk-villa-kiralama': '/hero-images/gunluk-villa-kiralama.jpg',
};

export function getServiceHeroImage(slug: string): string {
  const path = SERVICE_HERO_IMAGES[slug];
  if (!path) {
    throw new Error(
      `Missing service-specific hero image for "${slug}". Register a public hero asset before publishing this service.`,
    );
  }
  return `${SITE.siteUrl}${path}`;
}

export function getRegisteredServiceHeroSlugs(): string[] {
  return Object.keys(SERVICE_HERO_IMAGES);
}