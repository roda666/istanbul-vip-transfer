/**
 * Centralized navigation configuration.
 * Both desktop and mobile menus consume this single data source.
 */

export interface NavItem {
  label: string;
  href: string;
}

export interface NavGroup {
  groupLabel: string;
  items: NavItem[];
}

/** A single top-level navigation entry. */
export interface NavEntry {
  label: string;
  /** Present when the entry is a plain link. */
  href?: string;
  /** Present when the entry owns a mega-menu dropdown. */
  groups?: NavGroup[];
  /** Renders as a CTA/outlined button rather than a plain text link. */
  cta?: boolean;
}

export const NAV: NavEntry[] = [
  { label: 'Ana Sayfa', href: '/' },
  {
    label: 'Hizmetler',
    href: '/hizmetler',
    groups: [
      {
        groupLabel: 'Havalimanı Transferleri',
        items: [
          { label: 'İstanbul Havalimanı Transfer', href: '/istanbul-havalimani-transfer' },
          { label: 'Sabiha Gökçen Havalimanı Transfer', href: '/sabiha-gokcen-havalimani-transfer' },
        ],
      },
      {
        groupLabel: 'Özel Transfer Hizmetleri',
        items: [
          { label: 'VIP Transfer', href: '/vip-transfer' },
          { label: 'Şehirler Arası Transfer', href: '/sehirler-arasi-transfer' },
          { label: 'Şoförlü Araç Kiralama', href: '/soforlu-arac-kiralama' },
          { label: 'Otel Transfer', href: '/otel-transfer' },
          { label: 'Sağlık Turizmi Transfer', href: '/saglik-turizmi-transfer' },
          { label: 'Kurumsal VIP Transfer', href: '/kurumsal-vip-transfer' },
        ],
      },
      {
        groupLabel: 'Popüler Rotalar',
        items: [
          { label: 'İstanbul–Bursa Transfer', href: '/istanbul-bursa-transfer' },
          { label: 'İstanbul–Sapanca Transfer', href: '/istanbul-sapanca-transfer' },
        ],
      },
      {
        groupLabel: 'Turlar',
        items: [
          { label: 'İstanbul Günübirlik Turlar', href: '/istanbul-gunubirlik-turlar' },
          { label: 'Sapanca–Maşukiye Turu', href: '/sapanca-masukiye-turu' },
          { label: 'Bursa Günübirlik Tur', href: '/bursa-gunubirlik-tur' },
          { label: 'Yalova Günübirlik Tur', href: '/yalova-gunubirlik-tur' },
        ],
      },
    ],
  },
  { label: 'Araçlarımız', href: '/araclar' },
  { label: 'Blog', href: '/blog' },
  { label: 'Hakkımızda', href: '/hakkimizda' },
  { label: 'İletişim', href: '/iletisim' },
  /** CTA entry — rendered as an outlined button, not a plain text link. */
  { label: 'Fiyat / Rezervasyon', href: '/#rezervasyon', cta: true },
];
