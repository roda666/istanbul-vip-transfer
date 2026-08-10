/**
 * Seed the `content` table with all service pages from static source data.
 * Safe to run multiple times — uses ON CONFLICT DO UPDATE to keep data fresh.
 *
 * Run with:  npx tsx db/seed-service-pages.ts
 */
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: false, max: 1 });

const DEFAULT_OG_IMAGE = '/images/istanbul-vip-transfer-hero.webp';
const CTA_PRIMARY   = 'Fiyat Al / Rezervasyon';
const CTA_SECONDARY = 'Hemen Ara';

interface ServiceSeed {
  slug: string;
  displayOrder: number;
  title: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCrumb: string;
  heroBadge: string;
  features: string[];
}

const SERVICES: ServiceSeed[] = [
  {
    slug: 'istanbul-havalimani-transfer',
    displayOrder: 1,
    title: 'İstanbul Havalimanı Transfer',
    excerpt: 'İstanbul Havalimanı transfer hizmetiyle Mercedes Vito ve Sprinter araçlarla otel, ev ve istediğiniz adrese özel ulaşım.',
    seoTitle: 'İstanbul Havalimanı Transfer | VIP Vito',
    seoDescription: 'İstanbul Havalimanı transfer hizmetiyle Mercedes Vito ve Sprinter araçlarla otel, ev ve istediğiniz adrese özel ulaşım.',
    heroTitle: 'İstanbul Havalimanı (IST) VIP Transfer',
    heroSubtitle: 'İstanbul Havalimanı\'ndan her destinasyona Mercedes Vito ve Sprinter VIP ile profesyonel karşılama ve transfer hizmeti.',
    heroCrumb: 'İstanbul Havalimanı Transfer',
    heroBadge: 'Havalimanı Transferi',
    features: ['İsimli karşılama tabelası', 'Mercedes Vito veya Sprinter', '7/24 rezervasyon desteği', 'Kapıdan kapıya hizmet'],
  },
  {
    slug: 'sabiha-gokcen-havalimani-transfer',
    displayOrder: 2,
    title: 'Sabiha Gökçen Transfer',
    excerpt: 'Sabiha Gökçen Havalimanı transfer hizmetiyle Mercedes Vito ve Sprinter araçlarla İstanbul\'un her noktasına özel ulaşım.',
    seoTitle: 'Sabiha Gökçen Transfer | VIP Vito',
    seoDescription: 'Sabiha Gökçen Havalimanı transfer hizmetiyle Mercedes Vito ve Sprinter araçlarla İstanbul\'un her noktasına özel ulaşım.',
    heroTitle: 'Sabiha Gökçen Havalimanı (SAW) VIP Transfer',
    heroSubtitle: 'Sabiha Gökçen Havalimanı\'ndan her destinasyona Mercedes Vito ve Sprinter VIP ile profesyonel karşılama ve transfer hizmeti.',
    heroCrumb: 'Sabiha Gökçen Transfer',
    heroBadge: 'Havalimanı Transferi',
    features: ['İsimli karşılama tabelası', 'Mercedes Vito veya Sprinter', '7/24 rezervasyon desteği', 'Tüm İstanbul\'a hizmet'],
  },
  {
    slug: 'vip-transfer',
    displayOrder: 3,
    title: 'VIP Transfer İstanbul',
    excerpt: 'İstanbul\'da Mercedes Vito ve Sprinter araçlarla havalimanı, otel, kurumsal ve şehirler arası VIP transfer hizmeti.',
    seoTitle: 'VIP Transfer İstanbul | Vito ve Sprinter',
    seoDescription: 'İstanbul\'da Mercedes Vito ve Sprinter araçlarla havalimanı, otel, kurumsal ve şehirler arası VIP transfer hizmeti.',
    heroTitle: 'İstanbul VIP Transfer Hizmetleri',
    heroSubtitle: 'Havalimanı transferinden kurumsal transfere, otel transferinden özel etkinliklere — tüm ihtiyaçlarınız için lüks Mercedes araçlarla hizmetinizdeyiz.',
    heroCrumb: 'VIP Transfer',
    heroBadge: 'VIP Transfer',
    features: ['Lüks Mercedes VIP araç', 'Profesyonel sürücü', '7/24 rezervasyon', 'Özel karşılama hizmeti'],
  },
  {
    slug: 'sehirler-arasi-transfer',
    displayOrder: 4,
    title: 'Şehirler Arası Transfer',
    excerpt: 'İstanbul çıkışlı şehirler arası VIP transfer hizmeti. Mercedes Vito ve Sprinter araçlarla konforlu ve kapıdan kapıya özel ulaşım.',
    seoTitle: 'Şehirler Arası VIP Transfer | İstanbul',
    seoDescription: 'İstanbul çıkışlı şehirler arası VIP transfer hizmeti. Mercedes Vito ve Sprinter araçlarla konforlu ve kapıdan kapıya özel ulaşım.',
    heroTitle: 'Şehirler Arası VIP Transfer',
    heroSubtitle: 'İstanbul\'dan Türkiye\'nin farklı şehirlerine Mercedes Vito ve Sprinter araçlarla konforlu, güvenli ve kapıdan kapıya özel ulaşım.',
    heroCrumb: 'Şehirler Arası Transfer',
    heroBadge: 'Şehirlerarası',
    features: ['Kapıdan kapıya hizmet', 'Mercedes VIP araç', 'Esnek rota planlama', '7/24 rezervasyon desteği'],
  },
  {
    slug: 'soforlu-arac-kiralama',
    displayOrder: 5,
    title: 'Şoförlü Araç Kiralama',
    excerpt: 'İstanbul\'da şoförlü araç kiralama hizmeti. Saatlik veya günlük olarak Mercedes Vito veya Sprinter ile toplantı, alışveriş ve etkinlik transferleri.',
    seoTitle: 'Şoförlü Araç Kiralama İstanbul | Günlük VIP Şoför Hizmeti',
    seoDescription: 'İstanbul\'da şoförlü araç kiralama hizmeti. Saatlik veya günlük olarak Mercedes Vito veya Sprinter ile toplantı, alışveriş ve etkinlik transferleri.',
    heroTitle: 'Şoförlü Araç Kiralama İstanbul',
    heroSubtitle: 'İstanbul\'da birden fazla noktaya uğrayan günlerde, saatlik veya tam gün için size özel sürücü ve Mercedes araç tahsisi.',
    heroCrumb: 'Şoförlü Araç Kiralama',
    heroBadge: 'Araç Tahsisi',
    features: ['Saatlik veya günlük tahsis', 'Deneyimli sürücü', 'Mercedes Vito veya Sprinter', 'Esnek program'],
  },
  {
    slug: 'otel-transfer',
    displayOrder: 6,
    title: 'Otel Transfer İstanbul',
    excerpt: 'İstanbul\'da havalimanından otele, otelden havalimanına ve oteller arası Mercedes VIP transfer hizmeti. Karşılama tabelası ile kapıdan kapıya özel ulaşım.',
    seoTitle: 'Otel Transfer İstanbul | Havalimanı–Otel VIP Ulaşım',
    seoDescription: 'İstanbul\'da havalimanından otele, otelden havalimanına ve oteller arası Mercedes VIP transfer hizmeti. Karşılama tabelası ile kapıdan kapıya özel ulaşım.',
    heroTitle: 'Otel Transfer İstanbul',
    heroSubtitle: 'Havalimanından otelinize, otelinizden havalimanına ve İstanbul içi otel transferlerinde isim tabelası ile karşılama ve kapıdan kapıya hizmet.',
    heroCrumb: 'Otel Transfer',
    heroBadge: 'Otel Transferi',
    features: ['İsimli karşılama', 'Tüm İstanbul otelleri', 'Mercedes VIP araç', 'Bagaj yardımı'],
  },
  {
    slug: 'saglik-turizmi-transfer',
    displayOrder: 7,
    title: 'Sağlık Turizmi Transfer',
    excerpt: 'İstanbul\'a sağlık turizmi amacıyla gelen hastalar için havalimanından hastaneye, klinikten otele ve randevular arası özel Mercedes transfer hizmeti.',
    seoTitle: 'Sağlık Turizmi Transfer İstanbul | Hastane VIP Ulaşım',
    seoDescription: 'İstanbul\'a sağlık turizmi amacıyla gelen hastalar için havalimanından hastaneye, klinikten otele ve randevular arası özel Mercedes transfer hizmeti.',
    heroTitle: 'Sağlık Turizmi Transfer İstanbul',
    heroSubtitle: 'Hastane, klinik ve tedavi merkezlerine havalimanından karşılama, randevular arası ve otel–hastane gidiş-dönüş transferleri.',
    heroCrumb: 'Sağlık Turizmi Transfer',
    heroBadge: 'Sağlık Transferi',
    features: ['Havalimanı karşılama', 'Hastane transferleri', 'Mercedes VIP konfor', '7/24 destek'],
  },
  {
    slug: 'kurumsal-vip-transfer',
    displayOrder: 8,
    title: 'Kurumsal VIP Transfer',
    excerpt: 'İstanbul\'da kurumsal VIP transfer hizmeti. Yönetici ve iş misafiri transferlerinde fatura düzenleme, karşılama tabelası ve Mercedes araç tahsisi.',
    seoTitle: 'Kurumsal VIP Transfer İstanbul | Faturalı Şirket Transferi',
    seoDescription: 'İstanbul\'da kurumsal VIP transfer hizmeti. Yönetici ve iş misafiri transferlerinde fatura düzenleme, karşılama tabelası ve Mercedes araç tahsisi.',
    heroTitle: 'Kurumsal VIP Transfer İstanbul',
    heroSubtitle: 'Yöneticiler ve iş misafirleri için fatura desteği, karşılama tabelası ve çoklu rezervasyon koordinasyonuyla profesyonel transfer hizmeti.',
    heroCrumb: 'Kurumsal Transfer',
    heroBadge: 'Kurumsal',
    features: ['Fatura desteği', 'Çoklu rezervasyon koordinasyonu', 'Karşılama tabelası', 'Mercedes VIP araç'],
  },
  {
    slug: 'istanbul-bursa-transfer',
    displayOrder: 9,
    title: 'İstanbul–Bursa Transfer',
    excerpt: 'İstanbul\'dan Bursa\'ya veya Bursa\'dan İstanbul\'a Mercedes Vito ve Sprinter ile özel VIP transfer hizmeti.',
    seoTitle: 'İstanbul–Bursa Transfer | VIP Özel Araç',
    seoDescription: 'İstanbul\'dan Bursa\'ya veya Bursa\'dan İstanbul\'a Mercedes Vito ve Sprinter ile özel VIP transfer hizmeti. Kapıdan kapıya konforlu şehirler arası ulaşım.',
    heroTitle: 'İstanbul–Bursa Transfer',
    heroSubtitle: 'İstanbul ile Bursa arasında kapıdan kapıya özel Mercedes transfer hizmeti.',
    heroCrumb: 'İstanbul–Bursa Transfer',
    heroBadge: 'Şehirlerarası Rota',
    features: ['Kapıdan kapıya', 'Mercedes Vito veya Sprinter', 'Konforlu yolculuk', '7/24 rezervasyon'],
  },
  {
    slug: 'istanbul-sapanca-transfer',
    displayOrder: 10,
    title: 'İstanbul–Sapanca Transfer',
    excerpt: 'İstanbul\'dan Sapanca\'ya veya Sapanca\'dan İstanbul\'a Mercedes Vito ve Sprinter ile özel VIP transfer hizmeti.',
    seoTitle: 'İstanbul–Sapanca Transfer | VIP Özel Araç',
    seoDescription: 'İstanbul\'dan Sapanca\'ya veya Sapanca\'dan İstanbul\'a Mercedes Vito ve Sprinter ile özel VIP transfer hizmeti. Kapıdan kapıya konforlu şehirler arası ulaşım.',
    heroTitle: 'İstanbul–Sapanca Transfer',
    heroSubtitle: 'İstanbul ile Sapanca arasında kapıdan kapıya özel Mercedes transfer hizmeti.',
    heroCrumb: 'İstanbul–Sapanca Transfer',
    heroBadge: 'Şehirlerarası Rota',
    features: ['Kapıdan kapıya', 'Mercedes Vito veya Sprinter', 'Konforlu yolculuk', '7/24 rezervasyon'],
  },
  {
    slug: 'istanbul-gunubirlik-turlar',
    displayOrder: 11,
    title: 'İstanbul Günübirlik Turlar',
    excerpt: 'İstanbul\'un tarihi ve kültürel mekânlarını özel araçla günübirlik keşfedin. Mercedes Vito ve Sprinter ile kişiye özel şehir turu hizmeti.',
    seoTitle: 'İstanbul Günübirlik Turlar | VIP Özel Tur Aracı',
    seoDescription: 'İstanbul\'un tarihi ve kültürel mekânlarını özel araçla günübirlik keşfedin. Mercedes Vito ve Sprinter ile kişiye özel şehir turu hizmeti.',
    heroTitle: 'İstanbul Günübirlik Turlar',
    heroSubtitle: 'İstanbul\'un tarihi, kültürel ve turistik mekânlarını özel araçla, kendi programınıza göre keşfedin.',
    heroCrumb: 'İstanbul Günübirlik Turlar',
    heroBadge: 'Özel Tur',
    features: ['Kişiye özel program', 'Özel araç ve sürücü', 'Esnek güzergah', '7/24 rezervasyon'],
  },
  {
    slug: 'sapanca-masukiye-turu',
    displayOrder: 12,
    title: 'Sapanca–Maşukiye Turu',
    excerpt: 'İstanbul\'dan Sapanca Gölü ve Maşukiye\'ye özel araçla günübirlik tur. Doğa içinde konforlu bir gün geçirmek için Mercedes ile VIP tur hizmeti.',
    seoTitle: 'Sapanca–Maşukiye Günübirlik Turu | VIP Transfer',
    seoDescription: 'İstanbul\'dan Sapanca Gölü ve Maşukiye\'ye özel araçla günübirlik tur. Doğa içinde konforlu bir gün geçirmek için Mercedes ile VIP tur hizmeti.',
    heroTitle: 'Sapanca–Maşukiye Günübirlik Turu',
    heroSubtitle: 'İstanbul\'dan Sapanca Gölü ve Maşukiye ormanlarına özel araçla rahat ve güvenli günübirlik tur.',
    heroCrumb: 'Sapanca–Maşukiye Turu',
    heroBadge: 'Doğa Turu',
    features: ['İstanbul\'dan hareket', 'Özel araç ve sürücü', 'Esnek program', '7/24 rezervasyon'],
  },
  {
    slug: 'bursa-gunubirlik-tur',
    displayOrder: 13,
    title: 'Bursa Günübirlik Tur',
    excerpt: 'İstanbul\'dan Bursa\'ya özel araçla günübirlik tur. Yeşil Bursa\'yı kendi programınıza göre keşfetmek için Mercedes VIP tur transferi.',
    seoTitle: 'Bursa Günübirlik Tur | İstanbul\'dan VIP Transfer',
    seoDescription: 'İstanbul\'dan Bursa\'ya özel araçla günübirlik tur. Yeşil Bursa\'yı kendi programınıza göre keşfetmek için Mercedes VIP tur transferi.',
    heroTitle: 'Bursa Günübirlik Tur',
    heroSubtitle: 'İstanbul\'dan Bursa\'ya özel araçla konforlu günübirlik tur hizmeti.',
    heroCrumb: 'Bursa Günübirlik Tur',
    heroBadge: 'Şehir Turu',
    features: ['İstanbul\'dan hareket', 'Özel araç ve sürücü', 'Kişiselleştirilmiş program', '7/24 rezervasyon'],
  },
  {
    slug: 'yalova-gunubirlik-tur',
    displayOrder: 14,
    title: 'Yalova Günübirlik Tur',
    excerpt: 'İstanbul\'dan Yalova\'ya özel araçla günübirlik tur. Termal tatil bölgelerini ve doğal güzellikleri keşfetmek için Mercedes VIP tur transferi.',
    seoTitle: 'Yalova Günübirlik Tur | İstanbul\'dan VIP Transfer',
    seoDescription: 'İstanbul\'dan Yalova\'ya özel araçla günübirlik tur. Termal tatil bölgelerini ve doğal güzellikleri keşfetmek için Mercedes VIP tur transferi.',
    heroTitle: 'Yalova Günübirlik Tur',
    heroSubtitle: 'İstanbul\'dan Yalova\'ya özel araçla konforlu günübirlik tur hizmeti.',
    heroCrumb: 'Yalova Günübirlik Tur',
    heroBadge: 'Şehir Turu',
    features: ['İstanbul\'dan hareket', 'Özel araç ve sürücü', 'Termal bölge erişimi', '7/24 rezervasyon'],
  },
];

async function seed() {
  console.log(`Seeding ${SERVICES.length} service pages…`);
  for (const s of SERVICES) {
    const body = JSON.stringify({
      version: 1,
      hero: {
        badge:        s.heroBadge,
        title:        s.heroTitle,
        subtitle:     s.heroSubtitle,
        crumb:        s.heroCrumb,
        ctaPrimary:   CTA_PRIMARY,
        ctaSecondary: CTA_SECONDARY,
      },
      features: s.features,
      seo: {
        ogTitle:       s.seoTitle,
        ogDescription: s.seoDescription,
      },
    });

    await sql`
      INSERT INTO content (
        content_type, title, slug, excerpt, body,
        og_image, hero_image, hero_image_alt,
        seo_title, seo_description,
        status, is_active, indexable, display_order,
        published_at, created_at, updated_at
      ) VALUES (
        'SERVICE', ${s.title}, ${s.slug}, ${s.excerpt}, ${body},
        ${DEFAULT_OG_IMAGE}, ${DEFAULT_OG_IMAGE}, ${s.heroTitle},
        ${s.seoTitle}, ${s.seoDescription},
        'PUBLISHED', true, true, ${s.displayOrder},
        now(), now(), now()
      )
      ON CONFLICT (slug) DO UPDATE SET
        title            = EXCLUDED.title,
        excerpt          = EXCLUDED.excerpt,
        body             = EXCLUDED.body,
        og_image         = EXCLUDED.og_image,
        seo_title        = EXCLUDED.seo_title,
        seo_description  = EXCLUDED.seo_description,
        is_active        = true,
        display_order    = EXCLUDED.display_order,
        updated_at       = now()
    `;
    console.log(`  ✓ ${s.slug}`);
  }
  console.log('Done.');
  await sql.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
