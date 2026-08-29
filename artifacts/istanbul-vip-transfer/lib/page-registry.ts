/**
 * page-registry.ts
 *
 * Single source of truth for every locale-prefixed service/info page.
 * This file has NO React, Next.js, or browser dependencies so it can be
 * safely imported by both the Next.js app and standalone tsx scripts.
 *
 * HOW TO ADD A NEW STATIC PAGE
 * ────────────────────────────
 * Run `pnpm new:page <slug>` from this package. The scaffold command creates
 * the component, updates the registry, static slug list, localized route map,
 * and draft page metadata as one operation. Run `pnpm generate:page-meta`
 * afterward to replace the draft metadata with AI translations.
 *
 * Service slugs are still added to this registry directly and are handled
 * automatically by ServicePageRenderer.
 *
 * The prebuild step (`check:page-meta`) will fail the build if:
 *   • page-meta.json is missing translations for any registered slug.
 *   • lib/static-page-slugs.ts is out of sync with WebPage slugs here.
 * The page router itself also throws at startup if STATIC_PAGE_MAP and
 * lib/static-page-slugs.ts disagree, giving an explicit error instead of
 * a silent blank page.
 *
 * The prebuild step (`check:page-meta`) reads PAGE_REGISTRY and fails the
 * build if page-meta.json is missing any language for any registered slug.
 */

export interface PageRegistryEntry {
  /** JSON-LD schema type for this page. */
  schemaType: 'Service' | 'WebPage';
  /** Turkish source metadata used as the translation source. */
  tr: { title: string; description: string };
}

export const PAGE_REGISTRY: Record<string, PageRegistryEntry> = {
  'hizmetler': {
    schemaType: 'WebPage',
    tr: {
      title: 'Hizmetlerimiz | İstanbul VIP Transfer',
      description:
        'İstanbul VIP Transfer hizmet kategorileri: havalimanı transferi, VIP özel transfer, şehirler arası ulaşım ve günübirlik turlar. Mercedes Vito ve Sprinter araçlar.',
    },
  },
  'araclar': {
    schemaType: 'WebPage',
    tr: {
      title: 'VIP Araçlarımız | Vito ve Sprinter',
      description:
        'Mercedes Vito ve Sprinter VIP araç seçeneklerimizi inceleyin; transfer ihtiyaçlarınıza ve yolcu sayınıza uygun aracı seçin.',
    },
  },
  'hakkimizda': {
    schemaType: 'WebPage',
    tr: {
      title: 'Hakkımızda | İstanbul VIP Transfer',
      description:
        "İstanbul VIP Transfer'in hizmet anlayışı, araç seçenekleri, havalimanı ve şehirler arası özel ulaşım çözümleri hakkında bilgi alın.",
    },
  },
  'iletisim': {
    schemaType: 'WebPage',
    tr: {
      title: 'İletişim | İstanbul VIP Transfer',
      description:
        'İstanbul VIP Transfer rezervasyonu ve bilgi için telefon, WhatsApp veya e-posta üzerinden bize 7/24 ulaşın.',
    },
  },
  'istanbul-havalimani-transfer': {
    schemaType: 'Service',
    tr: {
      title: 'İstanbul Havalimanı Transfer | VIP Vito',
      description:
        'İstanbul Havalimanı transfer hizmetiyle Mercedes Vito ve Sprinter araçlarla otel, ev ve istediğiniz adrese özel ulaşım.',
    },
  },
  'sabiha-gokcen-havalimani-transfer': {
    schemaType: 'Service',
    tr: {
      title: 'Sabiha Gökçen Transfer | VIP Vito',
      description:
        "Sabiha Gökçen Havalimanı transfer hizmetiyle Mercedes Vito ve Sprinter araçlarla İstanbul'un her noktasına özel ulaşım.",
    },
  },
  'vip-transfer': {
    schemaType: 'Service',
    tr: {
      title: 'VIP Transfer İstanbul | Vito ve Sprinter',
      description:
        "İstanbul'da Mercedes Vito ve Sprinter araçlarla havalimanı, otel, kurumsal ve şehirler arası VIP transfer hizmeti.",
    },
  },
  'sehirler-arasi-transfer': {
    schemaType: 'Service',
    tr: {
      title: 'Şehirler Arası VIP Transfer | İstanbul',
      description:
        'İstanbul çıkışlı şehirler arası VIP transfer hizmeti. Mercedes Vito ve Sprinter araçlarla konforlu ve kapıdan kapıya özel ulaşım.',
    },
  },
  'soforlu-arac-kiralama': {
    schemaType: 'Service',
    tr: {
      title: 'Şoförlü Araç Kiralama İstanbul | Günlük VIP Şoför Hizmeti',
      description:
        "İstanbul'da şoförlü araç kiralama hizmeti. Saatlik veya günlük olarak Mercedes Vito veya Sprinter ile toplantı, alışveriş ve etkinlik transferleri.",
    },
  },
  'otel-transfer': {
    schemaType: 'Service',
    tr: {
      title: 'Otel Transfer İstanbul | Havalimanı–Otel VIP Ulaşım',
      description:
        "İstanbul'da havalimanından otele, otelden havalimanına ve oteller arası Mercedes VIP transfer hizmeti. Karşılama tabelası ile kapıdan kapıya özel ulaşım.",
    },
  },
  'saglik-turizmi-transfer': {
    schemaType: 'Service',
    tr: {
      title: 'Sağlık Turizmi Transfer İstanbul | Hastane VIP Ulaşım',
      description:
        "İstanbul'a sağlık turizmi amacıyla gelen hastalar için havalimanından hastaneye, klinikten otele ve randevular arası özel Mercedes transfer hizmeti.",
    },
  },
  'kurumsal-vip-transfer': {
    schemaType: 'Service',
    tr: {
      title: 'Kurumsal VIP Transfer İstanbul | Faturalı Şirket Transferi',
      description:
        "İstanbul'da kurumsal VIP transfer hizmeti. Yönetici ve iş misafiri transferlerinde fatura düzenleme, karşılama tabelası ve Mercedes araç tahsisi.",
    },
  },
  'istanbul-bursa-transfer': {
    schemaType: 'Service',
    tr: {
      title: 'İstanbul–Bursa Transfer | VIP Özel Araç',
      description:
        "İstanbul'dan Bursa'ya veya Bursa'dan İstanbul'a Mercedes Vito ve Sprinter ile özel VIP transfer hizmeti. Kapıdan kapıya konforlu şehirler arası ulaşım.",
    },
  },
  'istanbul-sapanca-transfer': {
    schemaType: 'Service',
    tr: {
      title: 'İstanbul–Sapanca Transfer | VIP Özel Araç',
      description:
        "İstanbul'dan Sapanca'ya veya Sapanca'dan İstanbul'a Mercedes Vito ve Sprinter ile özel VIP transfer hizmeti. Kapıdan kapıya konforlu şehirler arası ulaşım.",
    },
  },
  'istanbul-gunubirlik-turlar': {
    schemaType: 'Service',
    tr: {
      title: 'İstanbul Günübirlik Turlar | VIP Özel Tur Aracı',
      description:
        "İstanbul'un tarihi ve kültürel mekânlarını özel araçla günübirlik keşfedin. Mercedes Vito ve Sprinter ile kişiye özel şehir turu hizmeti.",
    },
  },
  'sapanca-masukiye-turu': {
    schemaType: 'Service',
    tr: {
      title: 'Sapanca–Maşukiye Günübirlik Turu | VIP Transfer',
      description:
        "İstanbul'dan Sapanca Gölü ve Maşukiye'ye özel araçla günübirlik tur. Doğa içinde konforlu bir gün geçirmek için Mercedes ile VIP tur hizmeti.",
    },
  },
  'bursa-gunubirlik-tur': {
    schemaType: 'Service',
    tr: {
      title: "Bursa Günübirlik Tur | İstanbul'dan VIP Transfer",
      description:
        "İstanbul'dan Bursa'ya özel araçla günübirlik tur. Yeşil Bursa'yı kendi programınıza göre keşfetmek için Mercedes VIP tur transferi.",
    },
  },
  'yalova-gunubirlik-tur': {
    schemaType: 'Service',
    tr: {
      title: "Yalova Günübirlik Tur | İstanbul'dan VIP Transfer",
      description:
        "İstanbul'dan Yalova'ya özel araçla günübirlik tur. Termal tatil bölgelerini ve doğal güzellikleri keşfetmek için Mercedes VIP tur transferi.",
    },
  },
  'ankara-vip-transfer': {
    schemaType: 'Service',
    tr: {
      title: 'Ankara VIP Transfer | Esenboğa Havalimanı Özel Araç',
      description:
        "Ankara Esenboğa Havalimanı'ndan ve şehir içi noktalara Mercedes Vito ve Sprinter ile özel VIP transfer hizmeti. 7/24, kapıdan kapıya.",
    },
  },
  'antalya-vip-transfer': {
    schemaType: 'Service',
    tr: {
      title: 'Antalya VIP Transfer | Havalimanı Özel Araç Hizmeti',
      description:
        "Antalya Havalimanı'ndan Kemer, Belek, Side, Alanya ve şehir merkezine Mercedes ile VIP transfer. 7/24, kapıdan kapıya özel araç.",
    },
  },
  'izmir-vip-transfer': {
    schemaType: 'Service',
    tr: {
      title: 'İzmir VIP Transfer | Adnan Menderes Havalimanı Özel Araç',
      description:
        "İzmir Adnan Menderes Havalimanı'ndan Çeşme, Alaçatı, Urla ve şehir merkezine Mercedes ile özel VIP transfer. 7/24, kapıdan kapıya.",
    },
  },
  'gelin-arabasi-kiralama': {
    schemaType: 'Service',
    tr: {
      title: 'Gelin Arabası Kiralama İstanbul | Düğün Mercedes VIP',
      description:
        "İstanbul'da lüks gelin arabası kiralama. Mercedes Vito ve Sprinter ile düğün transferi, özel süsleme, profesyonel şoför. En özel gününüz için.",
    },
  },
  'vip-protokol-secim-araci': {
    schemaType: 'Service',
    tr: {
      title: 'VIP Protokol Aracı | Seçim Kampanya Araç Kiralama',
      description:
        'Protokol transferleri ve seçim kampanyaları için özel şoförlü VIP araç tahsisi. Mercedes Vito ve Sprinter, diskret profesyonel hizmet.',
    },
  },
  'gunluk-villa-kiralama': {
    schemaType: 'Service',
    tr: {
      title: 'Günlük Villa Kiralama İstanbul | VIP Günübirlik Villa',
      description:
        "İstanbul çevresinde günlük kiralık lüks villa. Özel havuz, bahçe, korunaklı alan ve transfer hizmetiyle birlikte özel konaklama deneyimi.",
    },
  },
};

/** Ordered list of all registered page slugs. */
export const PAGE_SLUGS = Object.keys(PAGE_REGISTRY) as (keyof typeof PAGE_REGISTRY)[];
