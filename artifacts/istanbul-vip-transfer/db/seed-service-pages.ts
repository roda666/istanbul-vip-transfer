/**
 * Seed the `content` table with all service pages from static source data.
 * Safe to run multiple times — uses ON CONFLICT DO UPDATE to keep data fresh.
 *
 * Run with:  npx tsx db/seed-service-pages.ts
 */
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: false, max: 1 });

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
  /** Optional: if provided, used as the full body JSON string instead of building v1 body. */
  bodyOverride?: string;
  /** Optional: category — must match a slug in service_categories table (airport|city_vip|intercity|tour|special). */
  category?: string;
  /** Optional: show on homepage. Defaults to false. */
  showOnHomepage?: boolean;
}

/**
 * Every published service must have a distinct topic-specific image. There is
 * intentionally no generic fallback: a new service without a registered
 * image should make the seed fail, not silently reuse the Bosphorus photo.
 */
const SERVICE_HERO_ASSETS: Record<string, { image: string; alt: string }> = {
  'istanbul-havalimani-transfer': { image: '/hero-images/istanbul-havalimani-transfer.jpg', alt: 'İstanbul Havalimanı terminalinde yolcuları karşılayan VIP transfer aracı ve şoför.' },
  'sabiha-gokcen-havalimani-transfer': { image: '/hero-images/sabiha-gokcen-havalimani-transfer.jpg', alt: 'Sabiha Gökçen Havalimanı girişinde yolcular için hazır VIP transfer aracı.' },
  'vip-transfer': { image: '/hero-images/vip-transfer.jpg', alt: 'Beş yıldızlı otel önünde VIP transfer için bekleyen lüks araç ve şoför.' },
  'sehirler-arasi-transfer': { image: '/hero-images/sehirler-arasi-transfer.jpg', alt: 'Türkiye yollarında şehirler arası yolculuk yapan lüks VIP transfer aracı.' },
  'soforlu-arac-kiralama': { image: '/hero-images/soforlu-arac-kiralama.jpg', alt: 'İş bölgesinde kapısını açan profesyonel şoför ve lüks araç.' },
  'otel-transfer': { image: '/hero-images/otel-transfer.jpg', alt: 'Otel girişinde valizlere yardımcı olan şoför ve VIP transfer aracı.' },
  'saglik-turizmi-transfer': { image: '/hero-images/saglik-turizmi-transfer.jpg', alt: 'Modern klinik girişinde sağlık turizmi misafirini karşılayan VIP transfer aracı.' },
  'kurumsal-vip-transfer': { image: '/hero-images/kurumsal-vip-transfer.jpg', alt: 'Kurumsal ofis önünde iş misafirlerini karşılayan VIP transfer aracı.' },
  'istanbul-bursa-transfer': { image: '/hero-images/istanbul-bursa-transfer.jpg', alt: 'Bursa yönünde manzaralı yolda ilerleyen İstanbul çıkışlı VIP transfer aracı.' },
  'istanbul-sapanca-transfer': { image: '/hero-images/istanbul-sapanca-transfer.jpg', alt: 'Sapanca Gölü yakınındaki yeşil yolda VIP transfer aracı.' },
  'istanbul-gunubirlik-turlar': { image: '/hero-images/istanbul-gunubirlik-turlar.jpg', alt: 'İstanbul’un tarihi dokusunda özel günübirlik tur için hazır VIP araç.' },
  'sapanca-masukiye-turu': { image: '/hero-images/sapanca-masukiye-turu.jpg', alt: 'Sapanca ve Maşukiye doğa manzarasında özel tur aracı ve gezginler.' },
  'bursa-gunubirlik-tur': { image: '/hero-images/bursa-gunubirlik-tur.jpg', alt: 'Uludağ eteklerindeki Bursa turu için hazır VIP transfer aracı.' },
  'yalova-gunubirlik-tur': { image: '/hero-images/yalova-gunubirlik-tur.jpg', alt: 'Yalova’nın termal ve yeşil doğasında günübirlik tur için VIP araç.' },
  'ucus-karsilama-meet-greet': { image: '/hero-images/ucus-karsilama-meet-greet.jpg', alt: 'Havalimanı terminalinde boş karşılama tabelasıyla yolcuyu karşılayan görevli.' },
  'ankara-vip-transfer': { image: '/hero-images/ankara-vip-transfer.jpg', alt: 'Ankara VIP transfer hizmeti için hazır lüks araç.' },
  'antalya-vip-transfer': { image: '/hero-images/antalya-vip-transfer.jpg', alt: 'Antalya VIP transfer hizmeti için hazır lüks araç.' },
  'izmir-vip-transfer': { image: '/hero-images/izmir-vip-transfer.jpg', alt: 'İzmir VIP transfer hizmeti için hazır lüks araç.' },
  'gelin-arabasi-kiralama': { image: '/hero-images/gelin-arabasi-kiralama.jpg', alt: 'Düğün günü için hazırlanmış şık gelin arabası.' },
  'vip-protokol-secim-araci': { image: '/hero-images/vip-protokol-secim-araci.jpg', alt: 'Protokol misafirleri için hazır VIP araç.' },
  'gunluk-villa-kiralama': { image: '/hero-images/gunluk-villa-kiralama.jpg', alt: 'Günlük villa konaklaması için lüks ulaşım hizmeti.' },
};

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
  {
    slug: 'ucus-karsilama-meet-greet',
    displayOrder: 21,
    title: 'Uçuş Karşılama (Meet & Greet)',
    excerpt: 'İstanbul Havalimanı ve Sabiha Gökçen’de isminize hazırlanan tabela, bagaj yardımı ve araca kadar eşlik ile kişisel uçuş karşılama hizmeti.',
    seoTitle: 'Uçuş Karşılama (Meet & Greet) | İstanbul Havalimanı',
    seoDescription: 'İstanbul Havalimanı ve Sabiha Gökçen’de isim tabelası, bagaj yardımı ve özel araç bağlantısı ile profesyonel Meet & Greet hizmeti.',
    heroTitle: 'Uçuş Karşılama (Meet & Greet)',
    heroSubtitle: 'İstanbul Havalimanı ve Sabiha Gökçen’de, isminize hazırlanan tabela ile karşılanın; bagaj alımından özel aracınıza kadar size eşlik edelim.',
    heroCrumb: 'Uçuş Karşılama',
    heroBadge: 'Havalimanı Karşılama',
    features: [
      'İsminize hazırlanan karşılama tabelası',
      'Terminalde kişisel karşılama ve yönlendirme',
      'Bagaj alımından araca kadar eşlik',
      'Özel transfer aracınızla koordineli çıkış',
      'Uçuş bilgilerinizle planlanan karşılama',
      '7/24 rezervasyon desteği',
    ],
    category: 'airport',
    showOnHomepage: true,
    bodyOverride: JSON.stringify({
      version: 2,
      hero: {
        badge: 'Havalimanı Karşılama',
        title: 'Uçuş Karşılama (Meet & Greet)',
        subtitle: 'İstanbul Havalimanı ve Sabiha Gökçen’de, isminize hazırlanan tabela ile karşılanın; bagaj alımından özel aracınıza kadar size eşlik edelim.',
        crumb: 'Uçuş Karşılama',
        ctaPrimary: 'Rezervasyon ve Fiyat',
        ctaSecondary: 'Hemen Ara',
      },
      features: [
        'İsminize hazırlanan karşılama tabelası',
        'Terminalde kişisel karşılama ve yönlendirme',
        'Bagaj alımından araca kadar eşlik',
        'Özel transfer aracınızla koordineli çıkış',
        'Uçuş bilgilerinizle planlanan karşılama',
        '7/24 rezervasyon desteği',
      ],
      seo: {
        ogTitle: 'Uçuş Karşılama (Meet & Greet) | İstanbul Havalimanı',
        ogDescription: 'İstanbul Havalimanı ve Sabiha Gökçen’de isim tabelası, bagaj yardımı ve özel araç bağlantısı ile profesyonel Meet & Greet hizmeti.',
      },
      introBody: 'Havalimanına inişten sonraki ilk anların rahat ve düzenli geçmesi için uçuş karşılama hizmeti, terminalde size özel bir buluşma noktası sunar. Karşılama görevlisi isminizin yazılı olduğu tabela ile sizi karşılar, bagaj alanından çıkışa kadar yönlendirme sağlar ve transfer aracınızla buluşmanıza eşlik eder.',
      contentSections: [
        {
          id: 'meet-greet-nasil-isler',
          headingLevel: 'h2',
          heading: 'Uçuş Karşılama Hizmeti Nasıl İşler?',
          body: 'Rezervasyon sırasında uçuş numaranızı, iniş tarihinizi ve yolcu adınızı paylaşırsınız. Ekip, verdiğiniz uçuş bilgisine göre karşılama planını oluşturur. Terminale ulaştığınızda isminizin yazılı olduğu tabela ile karşılanır, bagaj alımından sonra çıkış noktasına ve transfer aracınıza yönlendirilirsiniz.',
        },
        {
          id: 'meet-greet-terminaller',
          headingLevel: 'h2',
          heading: 'İstanbul Havalimanı ve Sabiha Gökçen Terminalleri',
          body: 'Hizmet, İstanbul Havalimanı (IST) ve Sabiha Gökçen Havalimanı (SAW) varış terminallerinde planlanabilir. Buluşma noktası ve karşılama bilgileri rezervasyonunuz doğrultusunda önceden netleştirilir.',
        },
        {
          id: 'meet-greet-transfer-baglantisi',
          headingLevel: 'h2',
          heading: 'Transfer Aracınıza Rahat Geçiş',
          body: 'Karşılama hizmeti, havalimanı transferinizle birlikte planlandığında terminalden araca geçişinizi kolaylaştırır. Bagajlarınız için destek sağlanır ve aracınızla buluşmanız koordineli biçimde gerçekleştirilir.',
        },
      ],
      serviceArea: {
        title: 'Hizmet Noktaları',
        description: 'İstanbul’un iki ana havalimanının varış terminallerinde uçuş karşılama hizmeti sunulur.',
        areas: ['İstanbul Havalimanı (IST)', 'Sabiha Gökçen Havalimanı (SAW)'],
      },
      faqs: [
        {
          id: 'meet-greet-faq-1',
          question: 'Karşılama görevlisini nerede bulurum?',
          answer: 'Karşılama görevlisi, rezervasyonunuzdaki yolcu adıyla hazırlanmış tabela ile varış terminalinde belirlenen buluşma alanında sizi karşılar.',
        },
        {
          id: 'meet-greet-faq-2',
          question: 'Hizmet transferden bağımsız alınabilir mi?',
          answer: 'Uçuş karşılama hizmeti, transfer planınıza göre organize edilir. Rezervasyon sırasında ihtiyacınızı paylaşarak uygun düzenlemeyi netleştirebilirsiniz.',
        },
        {
          id: 'meet-greet-faq-3',
          question: 'Uçuş bilgisi neden gerekiyor?',
          answer: 'Karşılama planının doğru terminal ve zaman için hazırlanabilmesi amacıyla uçuş numarası ve iniş tarihi istenir.',
        },
      ],
      schemaExtras: {
        serviceType: 'Airport Meet and Greet',
        openingHours: 'Mo-Su 00:00-24:00',
        availableLanguage: ['Turkish', 'English', 'German', 'Russian', 'Arabic', 'French', 'Spanish', 'Italian', 'Dutch'],
      },
    }),
  },
  // ── New services added (v2 body with full rich content) ──────────────────
  {
    slug: 'ankara-vip-transfer',
    displayOrder: 15,
    title: 'Ankara VIP Transfer',
    excerpt: 'Ankara Esenboğa Havalimanı ve şehir içi transferlerde Mercedes Vito ve Sprinter ile VIP özel araç hizmeti. Kapıdan kapıya konforlu ulaşım.',
    seoTitle: 'Ankara VIP Transfer | Esenboğa Havalimanı Özel Araç',
    seoDescription: 'Ankara Esenboğa Havalimanı\'ndan ve şehir içi noktalara Mercedes Vito ve Sprinter ile özel VIP transfer hizmeti. 7/24, kapıdan kapıya.',
    heroTitle: 'Ankara VIP Transfer Hizmeti',
    heroSubtitle: 'Ankara Esenboğa Havalimanı transferinden şehir içi VIP ulaşıma kadar — Mercedes Vito ve Sprinter ile profesyonel, konforlu ve güvenilir özel araç hizmeti.',
    heroCrumb: 'Ankara VIP Transfer',
    heroBadge: 'Ankara VIP Transfer',
    features: ['Esenboğa Havalimanı\'nda isim tabelasıyla karşılama', 'Ankara\'nın tüm ilçelerine kapıdan kapıya hizmet', 'Bagaj yardımı dahil', 'Uçuş takibi — gecikmede aracınız sizi bekler', '7/24 hizmet', 'Deneyimli şoförler, bakımlı Mercedes araçlar'],
    category: 'airport',
    showOnHomepage: true,
    bodyOverride: JSON.stringify({ version: 2, hero: { badge: 'Ankara VIP Transfer', title: 'Ankara VIP Transfer Hizmeti', subtitle: 'Ankara Esenboğa Havalimanı transferinden şehir içi VIP ulaşıma kadar — Mercedes Vito ve Sprinter ile profesyonel, konforlu ve güvenilir özel araç hizmeti.', crumb: 'Ankara VIP Transfer', ctaPrimary: 'Rezervasyon ve Fiyat', ctaSecondary: 'Hemen Ara' }, features: ['Esenboğa Havalimanı\'nda isim tabelasıyla karşılama', 'Ankara\'nın tüm ilçelerine kapıdan kapıya hizmet', 'Bagaj yardımı dahil — valizlerinizi biz taşırız', 'Uçuş takibi — gecikmede aracınız sizi bekler', '7/24 hizmet — her saatte güvenilir transfer', 'Deneyimli şoförler, bakımlı Mercedes araçlar'], seo: { ogTitle: 'Ankara VIP Transfer | Esenboğa Havalimanı Mercedes Araç', ogDescription: 'Ankara\'da Esenboğa Havalimanı ve şehir içi noktalara Mercedes Vito/Sprinter ile VIP transfer. İsim tabelası, 7/24 hizmet.' }, introBody: 'Ankara, Türkiye\'nin başkenti olarak yoğun iş seyahati ve devlet ziyaretleri ile öne çıkan bir şehirdir. Esenboğa Havalimanı\'ndan Kızılay, Çankaya veya Ankara\'nın diğer noktalarına ulaşmak için özel araç transferi, toplu taşımaya kıyasla çok daha konforlu ve doğrudan bir seçenek sunar.', contentSections: [{ id: 'ankara-havalimani-transfer', headingLevel: 'h2', heading: 'Esenboğa Havalimanı Transfer Hizmeti', body: 'Ankara Esenboğa Havalimanı (ESB), şehir merkezine yakın konumuyla ulaşım açısından avantajlıdır. Şoförümüz uçuş takibi yaparak iniş saatinize göre hazır olur; pasaport kontrolü ve bagaj alımının ardından karşılama alanında bulunacaktır.' }, { id: 'ankara-sehir-ici-transfer', headingLevel: 'h2', heading: 'Ankara Şehir İçi VIP Transfer', body: 'Kızılay, Çankaya, Beşevler, Ulus, Keçiören, Sincan ve Ankara\'nın tüm ilçelerine özel araç hizmeti verilmektedir. Kurumsal toplantılar ve devlet kurumları ziyaretleri için günlük araç tahsisi de yapılabilmektedir.' }, { id: 'ankara-kurumsal-transfer', headingLevel: 'h2', heading: 'Kurumsal ve Diplomatik Transferler', body: 'Diplomatik misyon üyeleri, büyükelçilik personeli ve yüksek profilli iş insanları için diskret ve profesyonel transfer hizmetleri sunulmaktadır. Araç içinde gizlilik ve sessiz çalışma ortamı sağlanır.' }, { id: 'ankara-istanbul-transfer', headingLevel: 'h2', heading: 'Ankara–İstanbul Şehirlerarası Transfer', body: 'İstanbul–Ankara arasında şehirlerarası özel araç transferi hizmet kapsamımızdadır. İki şehir arasında kapıdan kapıya, kendi programınıza göre konforlu yolculuk yapabilirsiniz.' }], serviceArea: { title: 'Hizmet Verilen Bölgeler', description: 'Ankara Esenboğa Havalimanı ve şehrin tüm ilçelerine özel transfer hizmeti sunulmaktadır.', areas: ['Kızılay', 'Çankaya', 'Ulus', 'Beşevler', 'Keçiören', 'Sincan', 'Etimesgut', 'Mamak', 'Yenimahalle', 'Bilkent'] }, faqs: [{ id: 'ankara-faq-1', question: 'İstanbul\'dan Ankara\'ya transfer yapıyor musunuz?', answer: 'Evet. İstanbul–Ankara ve Ankara–İstanbul arasında şehirlerarası özel araç transferi sunulmaktadır.' }, { id: 'ankara-faq-2', question: 'Esenboğa\'dan Ankara şehir merkezine ne kadar sürer?', answer: 'Normal trafik koşullarında Esenboğa ile Kızılay arasındaki mesafe yaklaşık 40–50 dakikalık sürüşe karşılık gelir.' }, { id: 'ankara-faq-3', question: 'Kurumsal fatura düzenleyebiliyor musunuz?', answer: 'Evet. Kurumsal fatura düzenleme imkânı mevcuttur. Rezervasyon sırasında şirket bilgilerinizi paylaşmanız yeterlidir.' }, { id: 'ankara-faq-4', question: 'Gece geç saatlerde de hizmet alabilir miyim?', answer: '7/24 hizmet sunulmaktadır. Gece geç ya da sabah erken uçuşlarda da karşılama yapılmaktadır.' }, { id: 'ankara-faq-5', question: 'Uçuşum gecikirse ne olur?', answer: 'Şoförümüz uçuş takibi yaparak güncel iniş saatinizi takip eder. Gecikme durumunda aracınız sizi beklemeye devam eder.' }], schemaExtras: { serviceType: 'Airport Transfer', openingHours: 'Mo-Su 00:00-24:00', availableLanguage: ['Turkish', 'English'] } }),
  },
  {
    slug: 'antalya-vip-transfer',
    displayOrder: 16,
    title: 'Antalya VIP Transfer',
    excerpt: 'Antalya Havalimanı ve şehir içi VIP transfer hizmeti. Mercedes Vito ve Sprinter ile otel, villa ve tatil bölgelerine özel araç ulaşımı.',
    seoTitle: 'Antalya VIP Transfer | Havalimanı Özel Araç Hizmeti',
    seoDescription: 'Antalya Havalimanı\'ndan Kemer, Belek, Side, Alanya ve şehir merkezine Mercedes ile VIP transfer. 7/24, kapıdan kapıya özel araç.',
    heroTitle: 'Antalya VIP Transfer Hizmeti',
    heroSubtitle: 'Antalya Havalimanı\'ndan Kemer, Belek, Side, Alanya ve tüm tatil bölgelerine — Mercedes Vito ve Sprinter ile konforlu, kapıdan kapıya özel VIP transfer.',
    heroCrumb: 'Antalya VIP Transfer',
    heroBadge: 'Antalya VIP Transfer',
    features: ['Antalya Havalimanı çıkışında karşılama tabelası', 'Kemer, Belek, Side, Alanya ve tüm tatil bölgelerine transfer', 'Otel, resort ve özel villa kapısına teslim', 'Bagaj yardımı ve geniş bagaj kapasitesi', 'Uçuş takibi ile gecikme koruması', '7/24 hizmet'],
    category: 'airport',
    showOnHomepage: true,
    bodyOverride: JSON.stringify({ version: 2, hero: { badge: 'Antalya VIP Transfer', title: 'Antalya VIP Transfer Hizmeti', subtitle: 'Antalya Havalimanı\'ndan Kemer, Belek, Side, Alanya ve tüm tatil bölgelerine — Mercedes Vito ve Sprinter ile konforlu, kapıdan kapıya özel VIP transfer.', crumb: 'Antalya VIP Transfer', ctaPrimary: 'Rezervasyon ve Fiyat', ctaSecondary: 'Hemen Ara' }, features: ['Antalya Havalimanı çıkışında karşılama tabelası', 'Kemer, Belek, Side, Alanya ve tüm tatil bölgelerine transfer', 'Otel, resort ve özel villa kapısına teslim', 'Bagaj yardımı ve geniş bagaj kapasitesi', 'Uçuş takibi ile gecikme koruması', '7/24 hizmet — tatil sezonunda kesintisiz'], seo: { ogTitle: 'Antalya VIP Transfer | Kemer, Belek, Side, Alanya', ogDescription: 'Antalya Havalimanı\'ndan tatil bölgelerine (Kemer, Belek, Side, Alanya) Mercedes araçla özel VIP transfer. Otel ve villa kapısına hizmet.' }, introBody: 'Antalya, Türkiye\'nin en büyük turizm destinasyonlarından biridir. Antalya Havalimanı\'ndan Kemer, Belek, Side veya Alanya\'ya ulaşmak için özel araç transferi en konforlu ve doğrudan seçenektir. Şoförümüz isminize hazırladığı tabela ile gidiş kapısında sizi karşılar ve seçtiğiniz otel ya da villa adresine bırakır.', contentSections: [{ id: 'antalya-havalimani', headingLevel: 'h2', heading: 'Antalya Havalimanı Karşılama Hizmeti', body: 'Antalya Havalimanı (AYT) Terminal 1 ve Terminal 2\'den karşılama yapılmaktadır. Şoförümüz tam zamanında gidiş kapısında olur.' }, { id: 'antalya-tatil-bolgeleri', headingLevel: 'h2', heading: 'Tatil Bölgelerine Transfer', body: 'Kemer\'in butik otelleri, Belek\'in lüks resort\'ları, Side\'nin tarihi atmosferi ve Alanya\'nın sahil tatil köylerine direkt transfer hizmetimiz mevcuttur.' }, { id: 'antalya-villa-otel', headingLevel: 'h2', heading: 'Otel ve Özel Villa Transferleri', body: 'Lüks resort\'larda veya özel villalarda tatil yapanlar için check-in ve check-out süreçlerinde özel araç ile tam istediğiniz saatte hareket edebilirsiniz.' }, { id: 'antalya-mesafe', headingLevel: 'h2', heading: 'Mesafe ve Güzergah Bilgisi', body: 'Antalya Havalimanı\'ndan Kemer yaklaşık 45–60 dakika, Belek 30–40 dakika, Side 60–70 dakika ve Alanya yaklaşık 2 saattedir.' }], serviceArea: { title: 'Hizmet Verilen Bölgeler', description: 'Antalya Havalimanı\'ndan Akdeniz\'in tüm popüler tatil bölgelerine transfer hizmeti.', areas: ['Kemer', 'Belek', 'Side', 'Alanya', 'Kaş', 'Kalkan', 'Lara', 'Kundu', 'Beldibi', 'Antalya Şehir Merkezi'] }, faqs: [{ id: 'antalya-faq-1', question: 'Antalya Havalimanı\'ndan Belek\'e transfer yapıyor musunuz?', answer: 'Evet. Belek başta olmak üzere Kemer, Side, Alanya ve tüm Akdeniz tatil bölgelerine transfer hizmeti verilmektedir.' }, { id: 'antalya-faq-2', question: 'Dönüş transferini de siz yapıyor musunuz?', answer: 'Evet. Otelden ya da villadan havalimanına dönüş transferi de aynı hizmet kalitesiyle sağlanmaktadır.' }, { id: 'antalya-faq-3', question: 'Büyük grupla seyahat ediyoruz, hangi araç?', answer: 'Mercedes Sprinter geniş bagaj kapasitesiyle büyük gruplar için idealdir.' }, { id: 'antalya-faq-4', question: 'Uçuşum gecikirse ne olur?', answer: 'Uçuş takibi yapılmaktadır. Gecikme durumunda şoförümüz güncel iniş saatinize göre bekler.' }, { id: 'antalya-faq-5', question: 'Erken sabah veya gece geç uçuşlarda hizmet alabilir miyim?', answer: '7/24 hizmet verilmektedir.' }], schemaExtras: { serviceType: 'Airport Transfer', openingHours: 'Mo-Su 00:00-24:00', availableLanguage: ['Turkish', 'English', 'German', 'Russian'] } }),
  },
  {
    slug: 'izmir-vip-transfer',
    displayOrder: 17,
    title: 'İzmir VIP Transfer',
    excerpt: 'İzmir Adnan Menderes Havalimanı ve şehir içi VIP transfer hizmeti. Mercedes Vito ve Sprinter ile Çeşme, Alaçatı, Bodrum ve şehir merkezine özel araç.',
    seoTitle: 'İzmir VIP Transfer | Adnan Menderes Havalimanı Özel Araç',
    seoDescription: 'İzmir Adnan Menderes Havalimanı\'ndan Çeşme, Alaçatı, Urla ve şehir merkezine Mercedes ile özel VIP transfer. 7/24, kapıdan kapıya.',
    heroTitle: 'İzmir VIP Transfer Hizmeti',
    heroSubtitle: 'İzmir Adnan Menderes Havalimanı\'ndan Çeşme, Alaçatı, Urla, Karşıyaka ve tüm Ege güzergahlarına Mercedes Vito ve Sprinter ile konforlu özel VIP transfer.',
    heroCrumb: 'İzmir VIP Transfer',
    heroBadge: 'İzmir VIP Transfer',
    features: ['İzmir Adnan Menderes\'te karşılama tabelası', 'Çeşme, Alaçatı, Urla\'ya direkt transfer', 'Şehir merkezi, Alsancak, Karşıyaka\'ya ulaşım', 'Otel, tatil evi ve marina kapısına teslim', 'Uçuş takibi ile gecikme koruması', '7/24 hizmet'],
    category: 'airport',
    showOnHomepage: true,
    bodyOverride: JSON.stringify({ version: 2, hero: { badge: 'İzmir VIP Transfer', title: 'İzmir VIP Transfer Hizmeti', subtitle: 'İzmir Adnan Menderes Havalimanı\'ndan Çeşme, Alaçatı, Urla, Karşıyaka ve tüm Ege güzergahlarına Mercedes Vito ve Sprinter ile konforlu özel VIP transfer.', crumb: 'İzmir VIP Transfer', ctaPrimary: 'Rezervasyon ve Fiyat', ctaSecondary: 'Hemen Ara' }, features: ['İzmir Adnan Menderes\'te karşılama tabelası', 'Çeşme, Alaçatı, Urla\'ya direkt transfer', 'Şehir merkezi, Alsancak, Karşıyaka\'ya ulaşım', 'Otel, tatil evi ve marina kapısına teslim', 'Uçuş takibi ile gecikme koruması', '7/24 hizmet — Ege sezonu boyunca kesintisiz'], seo: { ogTitle: 'İzmir VIP Transfer | Çeşme, Alaçatı, Adnan Menderes', ogDescription: 'İzmir Adnan Menderes Havalimanı\'ndan Çeşme, Alaçatı ve şehir merkezine Mercedes araçla özel VIP transfer.' }, introBody: 'İzmir, Ege\'nin incisi olarak hem iş dünyası hem de turizm açısından yoğun hareket gören bir şehirdir. Adnan Menderes Havalimanı\'ndan Alsancak veya Çeşme-Alaçatı bölgesine özel araç transferi en konforlu seçenektir.', contentSections: [{ id: 'izmir-havalimani', headingLevel: 'h2', heading: 'Adnan Menderes Havalimanı Karşılama', body: 'İzmir Adnan Menderes Havalimanı (ADB) şehir merkezine yakın konumuyla öne çıkar. Şoförümüz uçuş takibi yaparak tam zamanında dış kapıda hazır olur.' }, { id: 'izmir-cesme-alacati', headingLevel: 'h2', heading: 'Çeşme ve Alaçatı Transferleri', body: 'Çeşme yarımadası ve Alaçatı\'nın taş sokakları her yıl çok sayıda ziyaretçi çekmektedir. Havalimanından Çeşme ve Alaçatı\'ya yaklaşık 60–75 dakika sürmektedir.' }, { id: 'izmir-sehir-ici', headingLevel: 'h2', heading: 'İzmir Şehir İçi Transfer', body: 'Alsancak, Konak, Bornova, Karşıyaka ve İzmir\'in tüm ilçelerine özel araç hizmetimiz bulunmaktadır.' }, { id: 'izmir-istanbul-transfer', headingLevel: 'h2', heading: 'İstanbul–İzmir Şehirlerarası Transfer', body: 'İstanbul ve İzmir arasında uzun mesafeli özel araç transferi de hizmet kapsamımızdadır.' }], serviceArea: { title: 'Hizmet Verilen Bölgeler', description: 'İzmir Adnan Menderes Havalimanı ve Ege\'nin önemli destinasyonlarına özel transfer hizmeti.', areas: ['Alsancak', 'Konak', 'Karşıyaka', 'Bornova', 'Buca', 'Balçova', 'Çeşme', 'Alaçatı', 'Urla', 'Foça', 'Seferihisar', 'Kuşadası'] }, faqs: [{ id: 'izmir-faq-1', question: 'Adnan Menderes\'ten Çeşme\'ye transfer yapıyor musunuz?', answer: 'Evet. Çeşme, Alaçatı ve yarımadanın tüm noktalarına transfer hizmetimiz mevcuttur.' }, { id: 'izmir-faq-2', question: 'İzmir\'den İstanbul\'a araçla gidebilir miyim?', answer: 'Evet. İzmir–İstanbul arası şehirlerarası özel araç transferi de sunulmaktadır.' }, { id: 'izmir-faq-3', question: 'Uçuşum gecikirse araç bekler mi?', answer: 'Evet. Uçuş takibi yapılmaktadır; gecikme durumunda şoförümüz güncel iniş saatinize göre bekler.' }, { id: 'izmir-faq-4', question: 'Erken sabah uçuşları için hizmet var mı?', answer: '7/24 hizmet sunulmaktadır.' }, { id: 'izmir-faq-5', question: 'Fuar İzmir\'e yakın otellere transfer yapıyor musunuz?', answer: 'Evet. Fuar bölgesi dahil İzmir\'in tüm ilçelerine transfer hizmeti verilmektedir.' }], schemaExtras: { serviceType: 'Airport Transfer', openingHours: 'Mo-Su 00:00-24:00', availableLanguage: ['Turkish', 'English'] } }),
  },
  {
    slug: 'gelin-arabasi-kiralama',
    displayOrder: 18,
    title: 'Gelin Arabası Kiralama',
    excerpt: 'Düğününüz için lüks gelin arabası kiralama hizmeti. Mercedes Vito ve Sprinter ile özel süsleme seçenekleri, profesyonel şoför ve 7/24 destek.',
    seoTitle: 'Gelin Arabası Kiralama İstanbul | Düğün Mercedes VIP',
    seoDescription: 'İstanbul\'da lüks gelin arabası kiralama. Mercedes Vito ve Sprinter ile düğün transferi, özel süsleme, profesyonel şoför.',
    heroTitle: 'Gelin Arabası Kiralama',
    heroSubtitle: 'En özel gününüzde konfor ve zarafeti bir arada sunuyoruz. Mercedes Vito ve Sprinter ile lüks düğün transferi — özel süsleme, profesyonel şoför.',
    heroCrumb: 'Gelin Arabası Kiralama',
    heroBadge: 'Düğün & Gelin Arabası',
    features: ['Özel gün temasına uygun araç süslemesi', 'Deneyimli ve takım elbiseli şoför', 'Nikâh, nikâh sonrası ve düğün töreni transferleri', 'Gelin ve damat için transfer seçeneği', 'Fotoğraf çekimi için araç eşliği', '7/24 rezervasyon ve destek'],
    category: 'city_vip',
    showOnHomepage: true,
    bodyOverride: JSON.stringify({ version: 2, hero: { badge: 'Düğün & Gelin Arabası', title: 'Gelin Arabası Kiralama', subtitle: 'En özel gününüzde konfor ve zarafeti bir arada sunuyoruz. Mercedes Vito ve Sprinter ile lüks düğün transferi — özel süsleme, profesyonel şoför.', crumb: 'Gelin Arabası Kiralama', ctaPrimary: 'Fiyat ve Rezervasyon', ctaSecondary: 'Hemen Ara' }, features: ['Özel gün temasına uygun araç süslemesi', 'Deneyimli ve takım elbiseli profesyonel şoför', 'Nikâh, nikâh sonrası ve düğün töreni transferleri', 'Gelin ve damat için ayrı veya birlikte transfer seçeneği', 'Fotoğraf çekimi için araç eşliği imkânı', '7/24 rezervasyon ve destek hattı'], seo: { ogTitle: 'Gelin Arabası Kiralama İstanbul | Lüks Düğün Mercedes', ogDescription: 'İstanbul\'da Mercedes Vito ve Sprinter ile lüks gelin arabası kiralama. Özel süsleme, profesyonel şoför, düğün töreni transferleri.' }, introBody: 'Düğün günü hayatınızın en özel anlarından biridir. Özel süslemeli Mercedes ile nikâh salonundan töreninize, töreninizden düğün mekânınıza kusursuz bir geçiş sağlanır.', contentSections: [{ id: 'gelin-susleme', headingLevel: 'h2', heading: 'Araç Süsleme Seçenekleri', body: 'Düğün temanıza uygun çiçek aranjmanı, kurdeleler ve özel süslemeler ile araç hazırlanabilmektedir. Süsleme detayları rezervasyon öncesinde koordine edilmektedir.' }, { id: 'gelin-transfer-planlama', headingLevel: 'h2', heading: 'Düğün Günü Transfer Planlaması', body: 'Nikâh salonuna geliş, törenden sonra düğün mekânına geçiş ve gece sonu otele transfer — tüm bu süreçler önceden planlanır ve şoförünüz programa uygun hazır bulunur.' }, { id: 'gelin-fotograf', headingLevel: 'h2', heading: 'Fotoğraf ve Video Çekimi için Araç Eşliği', body: 'Dış çekim sırasında araç ve şoförünüz fotoğraf çekimi mekanlarında bekler. Düğün fotoğraflarınıza zarif bir araç arka plan olabilir.' }, { id: 'gelin-neden-biz', headingLevel: 'h2', heading: 'Neden Özel Düğün Aracı?', body: 'Deneyimli bir şoförle planlanmış ve zamanında işleyen bir transfer, düğün gününüzün sorunsuz akmasına doğrudan katkı sağlar.' }], serviceArea: { title: 'Hizmet Kapsamı', description: 'İstanbul ve çevresindeki tüm ilçelere düğün transferi ve gelin arabası hizmeti.', areas: ['Taksim', 'Beşiktaş', 'Şişli', 'Kadıköy', 'Üsküdar', 'Sarıyer', 'Beykoz', 'Ataşehir', 'Bostancı', 'Florya', 'Bakırköy', 'Sultanahmet'] }, faqs: [{ id: 'gelin-faq-1', question: 'Araç özel olarak süsleniyor mu?', answer: 'Evet. Düğün temanıza uygun süsleme rezervasyon öncesi koordine edilmektedir.' }, { id: 'gelin-faq-2', question: 'Nikâhtan düğüne kadar araç tüm gün bizimle olur mu?', answer: 'Evet. Günlük kiralama seçeneği ile şoförünüz belirttiğiniz süre boyunca yanınızda olur.' }, { id: 'gelin-faq-3', question: 'Vito mu Sprinter mi tercih edilmeli?', answer: 'Gelin ve damat için daha samimi atmosfer için Vito, büyük grup için Sprinter tercih edilebilir.' }, { id: 'gelin-faq-4', question: 'Fotoğraf çekimi için araç eşliği alabilir miyim?', answer: 'Evet. Dış çekim sırasında araç ve şoförünüz eşlik edebilir.' }, { id: 'gelin-faq-5', question: 'İstanbul dışı düğünlerde de hizmet alabilir miyim?', answer: 'Evet. İstanbul ve çevre illerdeki düğün mekânlarına da hizmet verilmektedir.' }], schemaExtras: { serviceType: 'Chauffeur Service', openingHours: 'Mo-Su 00:00-24:00', availableLanguage: ['Turkish', 'English'] } }),
  },
  {
    slug: 'vip-protokol-secim-araci',
    displayOrder: 19,
    title: 'VIP Protokol ve Seçim Aracı',
    excerpt: 'Kurumsal ve siyasi etkinlikler ile seçim kampanyaları için özel şoförlü VIP araç tahsisi. Protokol transferleri, diskret ve profesyonel hizmet.',
    seoTitle: 'VIP Protokol Aracı | Seçim Kampanya Araç Kiralama',
    seoDescription: 'Protokol transferleri ve seçim kampanyaları için özel şoförlü VIP araç tahsisi. Mercedes Vito ve Sprinter, diskret profesyonel hizmet.',
    heroTitle: 'VIP Protokol ve Seçim Aracı Hizmeti',
    heroSubtitle: 'Kurumsal, siyasi ve protokol etkinlikleri için diskret, güvenilir ve profesyonel özel şoförlü VIP araç tahsisi.',
    heroCrumb: 'VIP Protokol Aracı',
    heroBadge: 'Protokol & Kurumsal VIP',
    features: ['Diskret ve profesyonel şoför hizmeti', 'Çoklu nokta ve esnek güzergah planlaması', 'Uzun süreli araç tahsisi', 'Protokol etkinlikleri için koordineli araç filosu', 'Gizlilik odaklı hizmet anlayışı', '7/24 hazır bulunurluk'],
    category: 'city_vip',
    showOnHomepage: true,
    bodyOverride: JSON.stringify({ version: 2, hero: { badge: 'Protokol & Kurumsal VIP', title: 'VIP Protokol ve Seçim Aracı Hizmeti', subtitle: 'Kurumsal, siyasi ve protokol etkinlikleri için diskret, güvenilir ve profesyonel özel şoförlü VIP araç tahsisi.', crumb: 'VIP Protokol Aracı', ctaPrimary: 'Fiyat ve Rezervasyon', ctaSecondary: 'Hemen Ara' }, features: ['Diskret ve profesyonel şoför hizmeti', 'Çoklu nokta ve esnek güzergah planlaması', 'Uzun süreli araç tahsisi — günlük veya haftalık', 'Protokol etkinlikleri için koordineli araç filosu', 'Gizlilik odaklı hizmet anlayışı', '7/24 hazır bulunurluk ve destek'], seo: { ogTitle: 'VIP Protokol Aracı | Siyasi Kampanya Araç Tahsisi', ogDescription: 'Protokol transferleri ve seçim kampanyaları için Mercedes Vito/Sprinter ile diskret VIP araç tahsisi. Profesyonel şoför, esnek güzergah.' }, introBody: 'Protokol transferleri ve siyasi kampanya süreçleri, hassas zamanlamayı, diskreti ve güvenilirliği bir arada gerektirir. Kurumsal etkinlikler, büyükelçilik transferleri ve seçim kampanya sahaya çıkışları için uzun süreli araç ve şoför tahsisi yapılabilmektedir.', contentSections: [{ id: 'protokol-etkinlik', headingLevel: 'h2', heading: 'Protokol ve Kurumsal Etkinlik Transferleri', body: 'Devlet etkinlikleri, uluslararası kongre ve zirveler, büyükelçilik ziyaretleri için araç planlaması yapılmaktadır. Birden fazla araç gerektiğinde koordineli filo düzenlemesi sağlanabilir.' }, { id: 'protokol-secim', headingLevel: 'h2', heading: 'Seçim Kampanyası Araç Tahsisi', body: 'Seçim dönemi sahaya çıkış programları, mitingler ve seçim bölgesi ziyaretleri için günlük ya da haftalık araç ve şoför tahsisi yapılmaktadır.' }, { id: 'protokol-diskret', headingLevel: 'h2', heading: 'Diskret Hizmet Anlayışı', body: 'Üst düzey yöneticiler, siyasetçiler ve kamuoyunda tanınan bireyler için gizlilik, güvenilirlik ve profesyonellik esastır.' }, { id: 'protokol-filo', headingLevel: 'h2', heading: 'Çoklu Araç ve Filo Organizasyonu', body: 'Büyük ölçekli organizasyonlarda birden fazla araç koordinasyonu sağlanabilir. İletişim tek noktadan yürütülür.' }], serviceArea: { title: 'Hizmet Kapsamı', description: 'İstanbul başta olmak üzere Ankara ve diğer şehirlerde protokol araç hizmetleri.', areas: ['İstanbul Tüm İlçeler', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Büyükelçilik Bölgeleri', 'Kongre Merkezleri'] }, faqs: [{ id: 'protokol-faq-1', question: 'Haftalık araç tahsisi yapıyor musunuz?', answer: 'Evet. Günlük, haftalık ya da daha uzun süreli araç ve şoför tahsisi planlanabilmektedir.' }, { id: 'protokol-faq-2', question: 'Birden fazla araç koordine edebilir misiniz?', answer: 'Evet. Filo düzenlemesi yapılabilmektedir; tüm araçların koordinasyonu tek noktadan yönetilir.' }, { id: 'protokol-faq-3', question: 'Şoförler gizlilik konusunda güvenilir mi?', answer: 'Evet. Şoförlerimiz diskret hizmet anlayışını benimsemiş profesyonellerdir.' }, { id: 'protokol-faq-4', question: 'Program değişirse araç uyum sağlayabiliyor mu?', answer: 'Evet. Günlük tahsisli araçlarda program değişikliklerine esneklikle uyum sağlanmaktadır.' }, { id: 'protokol-faq-5', question: 'Ankara\'da da hizmet sunuyor musunuz?', answer: 'Evet. İstanbul\'a ek olarak Ankara ve diğer büyük şehirlerde de hizmet verilebilmektedir.' }], schemaExtras: { serviceType: 'Chauffeur Service', openingHours: 'Mo-Su 00:00-24:00', availableLanguage: ['Turkish', 'English'] } }),
  },
  {
    slug: 'gunluk-villa-kiralama',
    displayOrder: 20,
    title: 'Günlük Villa Kiralama',
    excerpt: 'İstanbul çevresinde günlük kiralık VIP villa hizmeti. Transfer desteğiyle birlikte — doğa içinde, lüks ve özel bir konaklama deneyimi.',
    seoTitle: 'Günlük Villa Kiralama İstanbul | VIP Günübirlik Villa',
    seoDescription: 'İstanbul çevresinde günlük kiralık lüks villa. Özel havuz, bahçe, korunaklı alan ve transfer hizmetiyle birlikte özel konaklama deneyimi.',
    heroTitle: 'Günlük Villa Kiralama Hizmeti',
    heroSubtitle: 'İstanbul çevresinin sakin ve doğal güzelliklerinde günlük kiralık lüks villa. Özel bahçe, havuz ve korunaklı alanlar — transfer hizmetiyle.',
    heroCrumb: 'Günlük Villa Kiralama',
    heroBadge: 'Günlük VIP Villa',
    features: ['İstanbul çevresinde özel havuzlu villa seçenekleri', 'Günlük veya kısa süreli kiralama', 'Transfer hizmetiyle birlikte alım ve bırakma', 'Şirket toplantısı, aile buluşması için', 'Korunaklı ve gizli alan', 'Önceden planlama desteği'],
    category: 'city_vip',
    showOnHomepage: true,
    bodyOverride: JSON.stringify({ version: 2, hero: { badge: 'Günlük VIP Villa', title: 'Günlük Villa Kiralama Hizmeti', subtitle: 'İstanbul çevresinin sakin güzelliklerinde günlük kiralık lüks villa. Özel bahçe, havuz ve korunaklı alanlar — transfer hizmetiyle kapıdan kapıya rahatlık.', crumb: 'Günlük Villa Kiralama', ctaPrimary: 'Fiyat ve Rezervasyon', ctaSecondary: 'Hemen Ara' }, features: ['İstanbul çevresinde özel havuzlu villa seçenekleri', 'Günlük veya kısa süreli kiralama', 'Transfer hizmetiyle birlikte alım ve bırakma', 'Şirket toplantısı, aile buluşması ve özel etkinlikler için', 'Korunaklı ve gizli alan — kamusal kalabalığa uzak', 'Önceden planlama ve programlama desteği'], seo: { ogTitle: 'Günlük Villa Kiralama İstanbul | Özel Havuzlu VIP Villa', ogDescription: 'İstanbul çevresinde günlük lüks villa kiralama. Özel havuz, bahçe, transfer dahil.' }, introBody: 'İstanbul\'un kalabalığından uzaklaşarak özel ve sakin bir ortamda günlük toplantı, aile buluşması ya da özel etkinlik düzenlemek isteyenler için günlük villa kiralama hizmeti sunulmaktadır. Transfer hizmetiyle birlikte rezervasyon yaparak ulaşım sorununu da ortadan kaldırabilirsiniz.', contentSections: [{ id: 'villa-kullanim', headingLevel: 'h2', heading: 'Günlük Villa Kimler İçin?', body: 'Kurumsal team-building etkinlikleri, şirket toplantıları; özel kutlamalar, doğum günleri ve yıldönümleri; aile buluşmaları; fotoğraf ve video çekimleri için uygun seçenekler mevcuttur.' }, { id: 'villa-lokasyon', headingLevel: 'h2', heading: 'İstanbul Çevresinde Villa Bölgeleri', body: 'Şile, Ağva, Polonezköy, Beykoz ormanları ve Boğaz çevresi gibi İstanbul\'a yakın bölgeler öne çıkan villa destinasyonlarıdır.' }, { id: 'villa-transfer', headingLevel: 'h2', heading: 'Transfer ile Kombine Hizmet', body: 'Villa kiralama hizmetimizi Mercedes Vito veya Sprinter ile özel araç transferiyle birleştirebilirsiniz. Tüm grubunuzu alarak villaya bırakır, etkinlik sonunda geri getiririz.' }, { id: 'villa-etkinlik', headingLevel: 'h2', heading: 'Etkinlik Organizasyonu Desteği', body: 'Villa kiralama ve transfer birlikte planlandığında tüm organizasyon tek noktadan yönetilir.' }], serviceArea: { title: 'Hizmet Kapsamı', description: 'İstanbul\'a yakın villa bölgeleri ve çevre destinasyonlara transfer hizmetiyle ulaşım.', areas: ['Şile', 'Ağva', 'Polonezköy', 'Beykoz', 'Boğaz Çevresi', 'Büyükçekmece', 'Silivri', 'Çatalca', 'Sapanca', 'Abant'] }, faqs: [{ id: 'villa-faq-1', question: 'Villa kiralama ve transfer birlikte rezervasyon yapılabiliyor mu?', answer: 'Evet. Villa rezervasyonunuzu transfer hizmetiyle birleştirebilirsiniz.' }, { id: 'villa-faq-2', question: 'Minimum kiralama süresi ne kadar?', answer: 'Günlük kiralama esasına göre hizmet verilmektedir.' }, { id: 'villa-faq-3', question: 'Kurumsal etkinlikler için villa var mı?', answer: 'Evet. Şirket toplantıları ve team-building için uygun villa seçenekleri koordine edilebilir.' }, { id: 'villa-faq-4', question: 'Havuzlu villa bulunabilir mi?', answer: 'Evet. Özel havuzlu villa seçenekleri mevcuttur.' }, { id: 'villa-faq-5', question: 'Kaç kişiyle gidebiliriz?', answer: 'Kişi sayısına göre hem villa kapasitesi hem de araç seçimi planlanır. Mercedes Sprinter ile büyük gruplar rahatlıkla transfer edilebilir.' }], schemaExtras: { serviceType: 'Event Space Rental', openingHours: 'Mo-Su 00:00-24:00', availableLanguage: ['Turkish', 'English'] } }),
  },
];

async function seed() {
  console.log(`Seeding ${SERVICES.length} service pages…`);
  for (const s of SERVICES) {
    const body = s.bodyOverride ?? JSON.stringify({
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
    const heroAsset = SERVICE_HERO_ASSETS[s.slug];
    if (!heroAsset) {
      throw new Error(
        `Missing a service-specific hero image for "${s.slug}". Add it to SERVICE_HERO_ASSETS before seeding.`,
      );
    }

    await sql`
      INSERT INTO content (
        content_type, title, slug, excerpt, body,
        og_image, hero_image, hero_image_alt,
        seo_title, seo_description,
        status, is_active, indexable, display_order,
        category, show_on_homepage, show_in_nav,
        published_at, created_at, updated_at
      ) VALUES (
        'SERVICE', ${s.title}, ${s.slug}, ${s.excerpt}, ${body},
        ${heroAsset.image}, ${heroAsset.image}, ${heroAsset.alt},
        ${s.seoTitle}, ${s.seoDescription},
        'PUBLISHED', true, true, ${s.displayOrder},
        ${s.category ?? null}, ${s.showOnHomepage ?? false}, true,
        now(), now(), now()
      )
      ON CONFLICT (slug) DO UPDATE SET
        title            = EXCLUDED.title,
        excerpt          = EXCLUDED.excerpt,
        body             = EXCLUDED.body,
        og_image         = EXCLUDED.og_image,
        hero_image       = EXCLUDED.hero_image,
         hero_image_alt   = EXCLUDED.hero_image_alt,
        seo_title        = EXCLUDED.seo_title,
        seo_description  = EXCLUDED.seo_description,
        category         = EXCLUDED.category,
        show_on_homepage = EXCLUDED.show_on_homepage,
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
