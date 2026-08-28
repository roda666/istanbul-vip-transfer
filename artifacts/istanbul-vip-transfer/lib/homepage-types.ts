/**
 * Structured type definitions for homepage CMS content.
 * These types define the JSONB shape stored in content.body and
 * content_translations.body for the homepage record (slug='ana-sayfa').
 */

export interface HeroSection {
  badge: string;
  headline1: string;
  headlineAccent: string;
  headline2: string;
  subheadline: string;
  ctaBookingText: string;
  ctaCallText: string;
  imagePath: string;
  imageAlt: string;
  enabled: boolean;
}

export interface HeroStat {
  key: 'airport' | 'support' | 'vehicles';
  numberText: string;  // Always LTR: 'IST & SAW', '7/24', 'Vito & Sprinter'
  label: string;       // Translatable
  order: number;
  enabled: boolean;
}

export interface ServicesSectionData {
  eyebrow: string;
  heading: string;
  description: string;
  allServicesText: string;
  allServicesRoute: string;
  enabled: boolean;
}

export interface TrustCard {
  id: string;
  title: string;
  description: string;
  icon: string;  // Lucide icon name: 'Clock' | 'Plane' | 'Car' | 'User'
  order: number;
  enabled: boolean;
}

export interface TrustSectionData {
  eyebrow: string;
  heading: string;
  cards: TrustCard[];
  enabled: boolean;
}

export interface VehiclesSectionData {
  heading: string;
  description: string;
  ctaText: string;
  ctaRoute: string;
  enabled: boolean;
}

export interface ReviewsSectionData {
  eyebrow: string;
  heading: string;
  viewAllText: string;
  enabled: boolean;
}

export interface ReservationSectionData {
  eyebrow: string;
  heading: string;
  description: string;
  enabled: boolean;
}

export interface ContactSectionData {
  eyebrow: string;
  heading: string;
  subheading: string;
  whatsappCtaText: string;
  enabled: boolean;
}

export interface FooterSectionData {
  tagline: string;
  premiumTagline: string;
  col1Heading: string;
  col2Heading: string;
  col3Heading: string;
  copyrightText: string;
}

export interface HomepageSeoData {
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogImageAlt: string;
  indexable: boolean;
}

export interface HomepageSections {
  version: 1;
  hero: HeroSection;
  heroStats: HeroStat[];
  servicesSection: ServicesSectionData;
  trustSection: TrustSectionData;
  vehiclesSection: VehiclesSectionData;
  reviewsSection: ReviewsSectionData;
  reservationSection: ReservationSectionData;
  contactSection: ContactSectionData;
  footerSection: FooterSectionData;
  seo: HomepageSeoData;
}

/** Type guard */
export function isHomepageSections(v: unknown): v is HomepageSections {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as HomepageSections).version === 1 &&
    typeof (v as HomepageSections).hero === 'object'
  );
}

/** Safely parse JSON body string → HomepageSections | null */
export function parseHomepageSections(body: string | null | undefined): HomepageSections | null {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body);
    return isHomepageSections(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// ── Static fallback data (matches existing i18n dictionaries) ─────────────

export const HOMEPAGE_FALLBACK: Record<string, HomepageSections> = {
  tr: {
    version: 1,
    hero: {
      badge: "İstanbul'un Prestijli Transfer Hizmeti",
      headline1: "İstanbul'u",
      headlineAccent: 'Konforla',
      headline2: 'Keşfedin',
      subheadline: 'Havalimanından otelinize, toplantınıza ve her hedefe — lüks Mercedes araçlarımız ve profesyonel sürücülerimizle zamanında, güvenle ulaşın.',
      ctaBookingText: 'Fiyat Al / Rezervasyon',
      ctaCallText: 'Hemen Ara',
      imagePath: '/images/istanbul-havalimani-mercedes-vip-transfer-hero.webp',
      imageAlt: 'İstanbul Havalimanı terminalinde bekleyen siyah Mercedes VIP transfer aracı ve profesyonel şoför',
      enabled: true,
    },
    heroStats: [
      { key: 'airport',  numberText: 'IST & SAW',       label: 'Havalimanı Transfer',    order: 0, enabled: true },
      { key: 'support',  numberText: '7/24',             label: 'Rezervasyon Desteği',    order: 1, enabled: true },
      { key: 'vehicles', numberText: 'Vito & Sprinter',  label: 'VIP Araç Seçenekleri',  order: 2, enabled: true },
    ],
    servicesSection: {
      eyebrow: 'Hizmetlerimiz',
      heading: 'Her İhtiyaca Uygun Transfer',
      description: 'Bireysel ya da kurumsal — tüm transfer ihtiyaçlarınız için kapsamlı VIP hizmet.',
      allServicesText: 'Tüm Hizmetler →',
      allServicesRoute: '/hizmetler',
      enabled: true,
    },
    trustSection: {
      eyebrow: 'Neden Biz',
      heading: 'Hizmet Anlayışımız',
      cards: [
        { id: '247',      title: 'Rezervasyon Desteği',   description: 'Her saat, her gün. Geç gece varışı veya sabah erken uçuş olsun — WhatsApp ile ulaşabilirsiniz.',                              icon: 'Clock', order: 0, enabled: true },
        { id: 'airport',  title: 'Havalimanı Transferi',   description: 'İstanbul Havalimanı (IST) ve Sabiha Gökçen Havalimanı (SAW) için transfer rezervasyonu alıyoruz.',                          icon: 'Plane', order: 1, enabled: true },
        { id: 'vehicles', title: 'VIP Araç Seçenekleri',  description: 'Mercedes Vito ve Mercedes Sprinter VIP ile bireysel ve grup transferleri düzenliyoruz.',                                    icon: 'Car',   order: 2, enabled: true },
        { id: 'meet',     title: 'Karşılama Hizmeti',      description: 'Sürücünüz isim tabelasıyla karşılar, bagajlarınıza yardımcı olur ve sizi hedefinize ulaştırır.',                           icon: 'User',  order: 3, enabled: true },
      ],
      enabled: true,
    },
    vehiclesSection: { heading: 'VIP Araç Filomuz', description: 'Her ihtiyaca özel, en yüksek standartta iki araç seçeneği — her ikisi de tam konforlu.', ctaText: 'Rezervasyon Yap', ctaRoute: '#rezervasyon', enabled: true },
    reviewsSection:  { eyebrow: 'Google Müşteri Yorumları', heading: 'Yolcularımız Anlatıyor', viewAllText: "Tüm Yorumları Google'da Görüntüle", enabled: true },
    reservationSection: { eyebrow: 'Hızlı Rezervasyon', heading: 'Fiyat ve Rezervasyon Talebi', description: 'Talebinizi iletin, fiyat ve araç uygunluğu bilgisini WhatsApp üzerinden paylaşalım.', enabled: true },
    contactSection:  { eyebrow: 'İletişim', heading: 'Her An Yanınızdayız', subheading: 'Sorularınız için 7/24 ulaşabilirsiniz. WhatsApp ile hızlı destek alın.', whatsappCtaText: 'WhatsApp ile Mesaj Gönder', enabled: true },
    footerSection:   { tagline: "İstanbul'un en güvenilir VIP transfer hizmeti. Lüks Mercedes araçlar, profesyonel sürücüler, 7/24 hizmet.", premiumTagline: "İstanbul'un Premium Transfer Hizmeti", col1Heading: 'Hızlı Bağlantılar', col2Heading: 'Hizmetlerimiz', col3Heading: 'İletişim', copyrightText: 'Tüm hakları saklıdır.' },
    seo: { metaTitle: 'İstanbul VIP Transfer | Vito ve Sprinter Hizmeti', metaDescription: 'İstanbul VIP transfer hizmeti; İstanbul Havalimanı, Sabiha Gökçen, şehir içi ve şehirler arası Mercedes Vito ve Sprinter ulaşımı.', ogTitle: 'İstanbul VIP Transfer | Vito ve Sprinter Hizmeti', ogDescription: 'İstanbul VIP transfer hizmeti; İstanbul Havalimanı, Sabiha Gökçen, şehir içi ve şehirler arası Mercedes Vito ve Sprinter ulaşımı.', ogImage: '/images/istanbul-vip-transfer-hero.webp', ogImageAlt: 'İstanbul VIP Transfer', indexable: true },
  },
  en: {
    version: 1,
    hero: { badge: "Istanbul's Premium Transfer Service", headline1: 'Discover', headlineAccent: 'Istanbul', headline2: 'in Comfort', subheadline: 'From the airport to your hotel, meetings and every destination — arrive on time and safely with our luxury Mercedes vehicles and professional drivers.', ctaBookingText: 'Get a Quote / Reserve', ctaCallText: 'Call Now', imagePath: '/images/istanbul-havalimani-mercedes-vip-transfer-hero.webp', imageAlt: 'Black Mercedes VIP transfer vehicle and professional chauffeur waiting at Istanbul Airport terminal', enabled: true },
    heroStats: [
      { key: 'airport',  numberText: 'IST & SAW',       label: 'Airport Transfer',    order: 0, enabled: true },
      { key: 'support',  numberText: '7/24',             label: 'Booking Support',     order: 1, enabled: true },
      { key: 'vehicles', numberText: 'Vito & Sprinter',  label: 'VIP Vehicle Options', order: 2, enabled: true },
    ],
    servicesSection: { eyebrow: 'Our Services', heading: 'Transfer for Every Need', description: 'Individual or corporate — comprehensive VIP service for all your transfer needs.', allServicesText: 'All Services →', allServicesRoute: '/en/services', enabled: true },
    trustSection: {
      eyebrow: 'Why Choose Us', heading: 'Our Service Approach',
      cards: [
        { id: '247',      title: 'Booking Support',      description: 'Any hour, any day. Late-night arrival or early-morning flight — reach us on WhatsApp.',                                  icon: 'Clock', order: 0, enabled: true },
        { id: 'airport',  title: 'Airport Transfer',     description: 'We accept transfer bookings for Istanbul Airport (IST) and Sabiha Gökçen Airport (SAW).',                               icon: 'Plane', order: 1, enabled: true },
        { id: 'vehicles', title: 'VIP Vehicle Options',  description: 'We arrange individual and group transfers with Mercedes Vito and Mercedes Sprinter VIP.',                               icon: 'Car',   order: 2, enabled: true },
        { id: 'meet',     title: 'Meet & Greet',         description: 'Your driver greets you with a name sign, assists with luggage and takes you to your destination.',                      icon: 'User',  order: 3, enabled: true },
      ],
      enabled: true,
    },
    vehiclesSection:    { heading: 'Our VIP Vehicle Fleet', description: 'Two top-tier vehicle options for every need — both fully equipped for your comfort.', ctaText: 'Book Now', ctaRoute: '#rezervasyon', enabled: true },
    reviewsSection:     { eyebrow: 'Google Customer Reviews', heading: 'Our Passengers Say', viewAllText: 'View All Reviews on Google', enabled: true },
    reservationSection: { eyebrow: 'Quick Booking', heading: 'Price & Reservation Request', description: 'Send us your request and we will share availability and pricing via WhatsApp.', enabled: true },
    contactSection:     { eyebrow: 'Contact', heading: 'We Are Always Here', subheading: 'Reach us 24/7 for your questions. Get quick support via WhatsApp.', whatsappCtaText: 'Send a Message on WhatsApp', enabled: true },
    footerSection:      { tagline: "Istanbul's most reliable VIP transfer service. Luxury Mercedes vehicles, professional drivers, 24/7.", premiumTagline: "Istanbul's Premium Transfer Service", col1Heading: 'Quick Links', col2Heading: 'Our Services', col3Heading: 'Contact', copyrightText: 'All rights reserved.' },
    seo: { metaTitle: 'Istanbul VIP Transfer | Luxury Airport & City Transfers', metaDescription: 'Premium airport transfers, intercity transport and private tours in Istanbul with luxury Mercedes Vito & Sprinter. 24/7 service.', ogTitle: 'Istanbul VIP Transfer | Luxury Airport & City Transfers', ogDescription: 'Premium airport transfers, intercity transport and private tours in Istanbul with luxury Mercedes Vito & Sprinter. 24/7 service.', ogImage: '/images/istanbul-vip-transfer-hero.webp', ogImageAlt: 'Istanbul VIP Transfer', indexable: true },
  },
  de: {
    version: 1,
    hero: { badge: 'Istanbuls Premium Transfer-Service', headline1: 'Istanbul', headlineAccent: 'komfortabel', headline2: 'entdecken', subheadline: 'Vom Flughafen zu Ihrem Hotel, Meetings und jedem Ziel — pünktlich und sicher mit unseren luxuriösen Mercedes-Fahrzeugen und professionellen Fahrern.', ctaBookingText: 'Preisanfrage / Reservierung', ctaCallText: 'Jetzt anrufen', imagePath: '/images/istanbul-havalimani-mercedes-vip-transfer-hero.webp', imageAlt: 'Schwarzer Mercedes VIP-Transfer und professioneller Chauffeur am Terminal des Flughafens Istanbul', enabled: true },
    heroStats: [
      { key: 'airport',  numberText: 'IST & SAW',       label: 'Flughafentransfer',    order: 0, enabled: true },
      { key: 'support',  numberText: '7/24',             label: 'Buchungsservice',      order: 1, enabled: true },
      { key: 'vehicles', numberText: 'Vito & Sprinter',  label: 'VIP-Fahrzeugoptionen', order: 2, enabled: true },
    ],
    servicesSection: { eyebrow: 'Unsere Dienstleistungen', heading: 'Transfer für jeden Bedarf', description: 'Für Privatreisende und Unternehmen — umfassender VIP-Service für alle Ihre Transferbedürfnisse.', allServicesText: 'Alle Dienste →', allServicesRoute: '/de/services', enabled: true },
    trustSection: {
      eyebrow: 'Warum wir', heading: 'Unser Service-Ansatz',
      cards: [
        { id: '247',      title: 'Buchungsservice',        description: 'Jede Stunde, jeden Tag. Spätankunft oder früher Morgenflug — kontaktieren Sie uns per WhatsApp.',                   icon: 'Clock', order: 0, enabled: true },
        { id: 'airport',  title: 'Flughafentransfer',      description: 'Wir nehmen Transferbuchungen für den Flughafen Istanbul (IST) und Sabiha Gökçen (SAW) entgegen.',                  icon: 'Plane', order: 1, enabled: true },
        { id: 'vehicles', title: 'VIP-Fahrzeugoptionen',   description: 'Wir organisieren Einzel- und Gruppentransfers mit Mercedes Vito und Mercedes Sprinter VIP.',                       icon: 'Car',   order: 2, enabled: true },
        { id: 'meet',     title: 'Meet & Greet',           description: 'Ihr Fahrer begrüßt Sie mit einem Namensschild, hilft mit dem Gepäck und bringt Sie zu Ihrem Ziel.',               icon: 'User',  order: 3, enabled: true },
      ],
      enabled: true,
    },
    vehiclesSection:    { heading: 'Unser VIP-Fuhrpark', description: 'Zwei erstklassige Fahrzeugoptionen für jeden Bedarf — beide vollständig ausgestattet für Ihren Komfort.', ctaText: 'Jetzt buchen', ctaRoute: '#rezervasyon', enabled: true },
    reviewsSection:     { eyebrow: 'Google-Kundenbewertungen', heading: 'Unsere Passagiere berichten', viewAllText: 'Alle Bewertungen auf Google anzeigen', enabled: true },
    reservationSection: { eyebrow: 'Schnellbuchung', heading: 'Preis- & Reservierungsanfrage', description: 'Senden Sie Ihre Anfrage und wir teilen Verfügbarkeit und Preise über WhatsApp mit.', enabled: true },
    contactSection:     { eyebrow: 'Kontakt', heading: 'Wir sind immer für Sie da', subheading: 'Erreichen Sie uns 24/7 für Ihre Fragen. Schneller Support per WhatsApp.', whatsappCtaText: 'Nachricht per WhatsApp senden', enabled: true },
    footerSection:      { tagline: 'Der zuverlässigste VIP-Transferservice in Istanbul. Luxuriöse Mercedes-Fahrzeuge, professionelle Fahrer, 24/7.', premiumTagline: 'Istanbuls Premium Transfer-Service', col1Heading: 'Schnelllinks', col2Heading: 'Unsere Dienste', col3Heading: 'Kontakt', copyrightText: 'Alle Rechte vorbehalten.' },
    seo: { metaTitle: 'Istanbul VIP Transfer | Luxus Flughafen & Stadttransfers', metaDescription: 'Premiumtransfers vom Flughafen, Stadtfahrten und Privattouren in Istanbul mit luxuriösen Mercedes Vito & Sprinter. 24/7 Service.', ogTitle: 'Istanbul VIP Transfer | Luxus Flughafen & Stadttransfers', ogDescription: 'Premiumtransfers vom Flughafen, Stadtfahrten und Privattouren in Istanbul mit luxuriösen Mercedes Vito & Sprinter. 24/7 Service.', ogImage: '/images/istanbul-vip-transfer-hero.webp', ogImageAlt: 'Istanbul VIP Transfer', indexable: true },
  },
  ru: {
    version: 1,
    hero: { badge: 'Престижный трансфер-сервис Стамбула', headline1: 'Стамбул', headlineAccent: 'с комфортом', headline2: 'откройте для себя', subheadline: 'Из аэропорта в отель, на встречи и в любую точку — вовремя и безопасно на наших люксовых Mercedes с профессиональными водителями.', ctaBookingText: 'Запрос цены / Бронирование', ctaCallText: 'Позвонить', imagePath: '/images/istanbul-havalimani-mercedes-vip-transfer-hero.webp', imageAlt: 'Чёрный Mercedes для VIP-трансфера и профессиональный водитель у терминала аэропорта Стамбула', enabled: true },
    heroStats: [
      { key: 'airport',  numberText: 'IST & SAW',       label: 'Трансфер из аэропорта',       order: 0, enabled: true },
      { key: 'support',  numberText: '7/24',             label: 'Поддержка бронирования',      order: 1, enabled: true },
      { key: 'vehicles', numberText: 'Vito & Sprinter',  label: 'Варианты VIP-автомобилей',    order: 2, enabled: true },
    ],
    servicesSection: { eyebrow: 'Наши услуги', heading: 'Трансфер для любых нужд', description: 'Для частных лиц и корпоративных клиентов — комплексный VIP-сервис для всех ваших потребностей.', allServicesText: 'Все услуги →', allServicesRoute: '/ru/services', enabled: true },
    trustSection: {
      eyebrow: 'Почему мы', heading: 'Наш подход к сервису',
      cards: [
        { id: '247',      title: 'Поддержка бронирования',   description: 'В любой час, любой день. Поздний прилёт или ранний рейс — свяжитесь с нами через WhatsApp.',                icon: 'Clock', order: 0, enabled: true },
        { id: 'airport',  title: 'Трансфер из аэропорта',    description: 'Принимаем бронирования трансферов из аэропорта Стамбула (IST) и Сабиха Гёкчен (SAW).',                     icon: 'Plane', order: 1, enabled: true },
        { id: 'vehicles', title: 'Варианты VIP-автомобилей', description: 'Организуем индивидуальные и групповые трансферы на Mercedes Vito и Mercedes Sprinter VIP.',                 icon: 'Car',   order: 2, enabled: true },
        { id: 'meet',     title: 'Встреча и сопровождение',  description: 'Водитель встретит вас с табличкой, поможет с багажом и доставит до места назначения.',                      icon: 'User',  order: 3, enabled: true },
      ],
      enabled: true,
    },
    vehiclesSection:    { heading: 'Наш парк VIP-автомобилей', description: 'Два первоклассных варианта автомобилей для любых нужд — оба полностью оснащены для вашего комфорта.', ctaText: 'Забронировать', ctaRoute: '#rezervasyon', enabled: true },
    reviewsSection:     { eyebrow: 'Отзывы клиентов Google', heading: 'Наши пассажиры рассказывают', viewAllText: 'Смотреть все отзывы в Google', enabled: true },
    reservationSection: { eyebrow: 'Быстрое бронирование', heading: 'Запрос цены и бронирования', description: 'Отправьте запрос, и мы сообщим о наличии и ценах через WhatsApp.', enabled: true },
    contactSection:     { eyebrow: 'Контакты', heading: 'Мы всегда рядом', subheading: 'Свяжитесь с нами 24/7 по любым вопросам. Быстрая поддержка через WhatsApp.', whatsappCtaText: 'Написать в WhatsApp', enabled: true },
    footerSection:      { tagline: 'Самый надёжный VIP-трансфер в Стамбуле. Роскошные Mercedes, профессиональные водители, 24/7.', premiumTagline: 'Престижный трансфер-сервис Стамбула', col1Heading: 'Быстрые ссылки', col2Heading: 'Наши услуги', col3Heading: 'Контакты', copyrightText: 'Все права защищены.' },
    seo: { metaTitle: 'Стамбул VIP Трансфер | Трансфер из аэропорта и по городу', metaDescription: 'Премиальные трансферы из аэропорта, городские перевозки и частные туры в Стамбуле на люксовых Mercedes Vito и Sprinter. Работаем 24/7.', ogTitle: 'Стамбул VIP Трансфер | Трансфер из аэропорта и по городу', ogDescription: 'Премиальные трансферы из аэропорта, городские перевозки и частные туры в Стамбуле на люксовых Mercedes Vito и Sprinter. Работаем 24/7.', ogImage: '/images/istanbul-vip-transfer-hero.webp', ogImageAlt: 'Стамбул VIP Трансфер', indexable: true },
  },
  ar: {
    version: 1,
    hero: { badge: 'خدمة النقل المميزة في إسطنبول', headline1: 'اكتشف', headlineAccent: 'إسطنبول', headline2: 'براحة', subheadline: 'من المطار إلى فندقك واجتماعاتك وكل وجهة — في الوقت المحدد وبأمان مع سياراتنا الفاخرة وسائقينا المحترفين.', ctaBookingText: 'طلب سعر / حجز', ctaCallText: 'اتصل الآن', imagePath: '/images/istanbul-havalimani-mercedes-vip-transfer-hero.webp', imageAlt: 'سيارة مرسيدس سوداء لنقل كبار الشخصيات وسائق محترف أمام مبنى مطار إسطنبول', enabled: true },
    heroStats: [
      { key: 'airport',  numberText: 'IST & SAW',       label: 'نقل المطار',          order: 0, enabled: true },
      { key: 'support',  numberText: '7/24',             label: 'دعم الحجز',           order: 1, enabled: true },
      { key: 'vehicles', numberText: 'Vito & Sprinter',  label: 'خيارات سيارات VIP',   order: 2, enabled: true },
    ],
    servicesSection: { eyebrow: 'خدماتنا', heading: 'النقل لكل احتياج', description: 'للأفراد والشركات — خدمة VIP شاملة لجميع احتياجات النقل.', allServicesText: 'جميع الخدمات ←', allServicesRoute: '/ar/services', enabled: true },
    trustSection: {
      eyebrow: 'لماذا نحن', heading: 'نهجنا في الخدمة',
      cards: [
        { id: '247',      title: 'دعم الحجز',           description: 'على مدار الساعة، كل يوم. وصول متأخر ليلاً أو رحلة صباحية مبكرة — تواصل معنا عبر واتساب.',           icon: 'Clock', order: 0, enabled: true },
        { id: 'airport',  title: 'نقل المطار',           description: 'نقبل حجوزات النقل من مطار إسطنبول (IST) ومطار صبيحة كوكجن (SAW).',                               icon: 'Plane', order: 1, enabled: true },
        { id: 'vehicles', title: 'خيارات سيارات VIP',    description: 'ننظم رحلات نقل فردية وجماعية بسيارات مرسيدس فيتو وسبرينتر VIP.',                                   icon: 'Car',   order: 2, enabled: true },
        { id: 'meet',     title: 'الاستقبال والمرافقة',  description: 'يستقبلك السائق بلافتة باسمك ويساعد في الأمتعة ويوصلك إلى وجهتك.',                                  icon: 'User',  order: 3, enabled: true },
      ],
      enabled: true,
    },
    vehiclesSection:    { heading: 'أسطول سيارات VIP لدينا', description: 'خياران من أرقى السيارات لكل احتياج — كلاهما مجهز بالكامل لراحتك.', ctaText: 'احجز الآن', ctaRoute: '#rezervasyon', enabled: true },
    reviewsSection:     { eyebrow: 'تقييمات عملاء جوجل', heading: 'يحكي ركابنا', viewAllText: 'عرض جميع التقييمات على جوجل', enabled: true },
    reservationSection: { eyebrow: 'حجز سريع', heading: 'طلب سعر / حجز', description: 'أرسل طلبك وسنشارك التوافر والأسعار عبر واتساب.', enabled: true },
    contactSection:     { eyebrow: 'تواصل معنا', heading: 'نحن دائماً بجانبك', subheading: 'تواصل معنا على مدار الساعة لأي استفسار. احصل على دعم سريع عبر واتساب.', whatsappCtaText: 'إرسال رسالة عبر واتساب', enabled: true },
    footerSection:      { tagline: 'أكثر خدمات نقل VIP موثوقية في إسطنبول. سيارات مرسيدس فاخرة، سائقون محترفون، خدمة 24/7.', premiumTagline: 'خدمة النقل المميزة في إسطنبول', col1Heading: 'روابط سريعة', col2Heading: 'خدماتنا', col3Heading: 'تواصل معنا', copyrightText: 'جميع الحقوق محفوظة.' },
    seo: { metaTitle: 'إسطنبول VIP ترانسفير | نقل فاخر من المطار والمدينة', metaDescription: 'خدمة نقل فاخرة من المطار والمدينة وجولات خاصة في إسطنبول بسيارات مرسيدس فيتو وسبرينتر. خدمة 24/7.', ogTitle: 'إسطنبول VIP ترانسفير | نقل فاخر من المطار والمدينة', ogDescription: 'خدمة نقل فاخرة من المطار والمدينة وجولات خاصة في إسطنبول بسيارات مرسيدس فيتو وسبرينتر. خدمة 24/7.', ogImage: '/images/istanbul-vip-transfer-hero.webp', ogImageAlt: 'إسطنبول VIP ترانسفير', indexable: true },
  },
  es: {
    version: 1,
    hero: { badge: 'El servicio premium de traslados de Istanbul', headline1: 'Descubra', headlineAccent: 'Istanbul', headline2: 'con comodidad', subheadline: 'Del aeropuerto a su hotel, reuniones y cualquier destino: llegue puntual y seguro con nuestros vehículos Mercedes de lujo y conductores profesionales.', ctaBookingText: 'Solicitar presupuesto / Reservar', ctaCallText: 'Llamar ahora', imagePath: '/images/istanbul-havalimani-mercedes-vip-transfer-hero.webp', imageAlt: 'Vehículo Mercedes negro para traslado VIP y chófer profesional en la terminal del Aeropuerto de Estambul', enabled: true },
    heroStats: [
      { key: 'airport',  numberText: 'IST & SAW',       label: 'Traslado al aeropuerto',    order: 0, enabled: true },
      { key: 'support',  numberText: '7/24',             label: 'Asistencia para reservas',  order: 1, enabled: true },
      { key: 'vehicles', numberText: 'Vito & Sprinter',  label: 'Opciones de vehículos VIP', order: 2, enabled: true },
    ],
    servicesSection: { eyebrow: 'Nuestros servicios', heading: 'Traslados para cada necesidad', description: 'Para particulares o empresas: un servicio VIP integral para todas sus necesidades de traslado.', allServicesText: 'Todos los servicios →', allServicesRoute: '/es/services', enabled: true },
    trustSection: {
      eyebrow: 'Por qué elegirnos', heading: 'Nuestra forma de ofrecer el servicio',
      cards: [
        { id: '247',      title: 'Asistencia para reservas', description: 'A cualquier hora y cualquier día. Llegadas nocturnas o vuelos a primera hora: contáctenos por WhatsApp.',                              icon: 'Clock', order: 0, enabled: true },
        { id: 'airport',  title: 'Traslado al aeropuerto',   description: 'Aceptamos reservas de traslados desde Istanbul Airport (IST) y Sabiha Gokcen Airport (SAW).',                                     icon: 'Plane', order: 1, enabled: true },
        { id: 'vehicles', title: 'Opciones de vehículos VIP', description: 'Organizamos traslados individuales y para grupos con Mercedes Vito y Mercedes Sprinter VIP.',                                    icon: 'Car',   order: 2, enabled: true },
        { id: 'meet',     title: 'Recepción y bienvenida',   description: 'Su conductor le recibirá con un cartel con su nombre, le ayudará con el equipaje y le llevará a su destino.',                     icon: 'User',  order: 3, enabled: true },
      ],
      enabled: true,
    },
    vehiclesSection:    { heading: 'Nuestra flota de vehículos VIP', description: 'Dos opciones de vehículos de alta gama para cada necesidad, totalmente equipadas para su comodidad.', ctaText: 'Reservar ahora', ctaRoute: '#rezervasyon', enabled: true },
    reviewsSection:     { eyebrow: 'Opiniones de clientes en Google', heading: 'Lo que dicen nuestros pasajeros', viewAllText: 'Ver todas las reseñas en Google', enabled: true },
    reservationSection: { eyebrow: 'Reserva rápida', heading: 'Solicitud de precio y reserva', description: 'Envíenos su solicitud y le informaremos de la disponibilidad y el precio por WhatsApp.', enabled: true },
    contactSection:     { eyebrow: 'Contacto', heading: 'Siempre estamos aquí para usted', subheading: 'Contáctenos 24/7 para resolver sus dudas. Reciba asistencia rápida por WhatsApp.', whatsappCtaText: 'Enviar un mensaje por WhatsApp', enabled: true },
    footerSection:      { tagline: 'El servicio de traslados VIP más fiable de Istanbul. Vehículos Mercedes de lujo y conductores profesionales, 24/7.', premiumTagline: 'El servicio premium de traslados de Istanbul', col1Heading: 'Enlaces rápidos', col2Heading: 'Nuestros servicios', col3Heading: 'Contacto', copyrightText: 'Todos los derechos reservados.' },
    seo: { metaTitle: 'Istanbul VIP Transfer | Traslados de lujo al aeropuerto y por la ciudad', metaDescription: 'Servicio de traslado VIP en el aeropuerto de Estambul con vehículos Mercedes Vito y Sprinter. Servicio 24/7.', ogTitle: 'Istanbul VIP Transfer | Traslados de lujo al aeropuerto y por la ciudad', ogDescription: 'Traslados premium desde el aeropuerto, transporte interurbano y tours privados en Istanbul con Mercedes Vito y Sprinter de lujo. Servicio 24/7.', ogImage: '/images/istanbul-vip-transfer-hero.webp', ogImageAlt: 'Istanbul VIP Transfer', indexable: true },
  },
  fr: {
    version: 1,
    hero: { badge: "Le service de transfert premium d'Istanbul", headline1: 'Découvrez', headlineAccent: 'Istanbul', headline2: 'en confort', subheadline: "De l'aéroport à votre hôtel, vos réunions et chaque destination — arrivez à l'heure et en toute sécurité avec nos véhicules Mercedes de luxe et nos chauffeurs professionnels.", ctaBookingText: 'Demande de devis / Réservation', ctaCallText: 'Appeler maintenant', imagePath: '/images/istanbul-havalimani-mercedes-vip-transfer-hero.webp', imageAlt: "Véhicule Mercedes noir pour transfert VIP et chauffeur professionnel au terminal de l'aéroport d'Istanbul", enabled: true },
    heroStats: [
      { key: 'airport',  numberText: 'IST & SAW',       label: 'Transfert aéroport',         order: 0, enabled: true },
      { key: 'support',  numberText: '7/24',             label: 'Assistance à la réservation', order: 1, enabled: true },
      { key: 'vehicles', numberText: 'Vito & Sprinter',  label: 'Véhicules VIP',              order: 2, enabled: true },
    ],
    servicesSection: { eyebrow: 'Nos services', heading: 'Un transfert pour chaque besoin', description: 'Pour les particuliers comme pour les entreprises — un service VIP complet pour tous vos besoins de transfert.', allServicesText: 'Tous les services →', allServicesRoute: '/fr/services', enabled: true },
    trustSection: {
      eyebrow: 'Pourquoi nous choisir', heading: 'Notre approche du service',
      cards: [
        { id: '247',      title: 'Assistance à la réservation', description: 'À toute heure, tous les jours. Arrivée tard dans la nuit ou vol tôt le matin — contactez-nous sur WhatsApp.',           icon: 'Clock', order: 0, enabled: true },
        { id: 'airport',  title: 'Transfert aéroport',          description: 'Nous acceptons les réservations de transfert pour Istanbul Airport (IST) et Sabiha Gokcen Airport (SAW).',               icon: 'Plane', order: 1, enabled: true },
        { id: 'vehicles', title: 'Véhicules VIP',               description: 'Nous organisons des transferts individuels et de groupe avec Mercedes Vito et Mercedes Sprinter VIP.',                   icon: 'Car',   order: 2, enabled: true },
        { id: 'meet',     title: 'Accueil et assistance',       description: "Votre chauffeur vous accueille avec une pancarte à votre nom, vous aide avec vos bagages et vous conduit à destination.", icon: 'User',  order: 3, enabled: true },
      ],
      enabled: true,
    },
    vehiclesSection:    { heading: 'Notre flotte de véhicules VIP', description: 'Deux véhicules haut de gamme pour chaque besoin — tous deux entièrement équipés pour votre confort.', ctaText: 'Réserver maintenant', ctaRoute: '#rezervasyon', enabled: true },
    reviewsSection:     { eyebrow: 'Avis de nos clients sur Google', heading: 'Ce que disent nos passagers', viewAllText: 'Voir tous les avis sur Google', enabled: true },
    reservationSection: { eyebrow: 'Réservation rapide', heading: 'Demande de prix et de réservation', description: 'Envoyez-nous votre demande et nous vous communiquerons les disponibilités et tarifs par WhatsApp.', enabled: true },
    contactSection:     { eyebrow: 'Contact', heading: 'Nous sommes toujours à votre écoute', subheading: 'Contactez-nous 24/7 pour toute question. Bénéficiez rapidement de notre assistance via WhatsApp.', whatsappCtaText: 'Envoyer un message sur WhatsApp', enabled: true },
    footerSection:      { tagline: "Le service de transfert VIP le plus fiable d'Istanbul. Véhicules Mercedes de luxe, chauffeurs professionnels, 24/7.", premiumTagline: "Le service de transfert premium d'Istanbul", col1Heading: 'Liens rapides', col2Heading: 'Nos services', col3Heading: 'Contact', copyrightText: 'Tous droits réservés.' },
    seo: { metaTitle: 'Istanbul VIP Transfer | Transferts luxueux vers les aéroports et en ville', metaDescription: "Transferts premium depuis l'aéroport, transport interurbain et circuits privés à Istanbul avec des Mercedes Vito & Sprinter de luxe. Service 24/7.", ogTitle: 'Istanbul VIP Transfer | Transferts luxueux vers les aéroports et en ville', ogDescription: "Transferts premium depuis l'aéroport, transport interurbain et circuits privés à Istanbul avec des Mercedes Vito & Sprinter de luxe. Service 24/7.", ogImage: '/images/istanbul-vip-transfer-hero.webp', ogImageAlt: 'Istanbul VIP Transfer', indexable: true },
  },
  it: {
    version: 1,
    hero: { badge: 'Il servizio di transfer premium di Istanbul', headline1: 'Scopri', headlineAccent: 'Istanbul', headline2: 'in comfort', subheadline: "Dall'aeroporto al tuo hotel, riunioni e ogni destinazione — arriva puntuale e in sicurezza con i nostri veicoli Mercedes di lusso e autisti professionisti.", ctaBookingText: 'Richiedi un preventivo / Prenota', ctaCallText: 'Chiama ora', imagePath: '/images/istanbul-havalimani-mercedes-vip-transfer-hero.webp', imageAlt: "Veicolo Mercedes nero per transfer VIP e autista professionista al terminal dell'aeroporto di Istanbul", enabled: true },
    heroStats: [
      { key: 'airport',  numberText: 'IST & SAW',       label: 'Transfer aeroportuale',         order: 0, enabled: true },
      { key: 'support',  numberText: '7/24',             label: 'Assistenza per le prenotazioni', order: 1, enabled: true },
      { key: 'vehicles', numberText: 'Vito & Sprinter',  label: 'Veicoli VIP disponibili',       order: 2, enabled: true },
    ],
    servicesSection: { eyebrow: 'I nostri servizi', heading: 'Un transfer per ogni esigenza', description: 'Per privati o aziende: un servizio VIP completo per ogni esigenza di transfer.', allServicesText: 'Tutti i servizi →', allServicesRoute: '/it/services', enabled: true },
    trustSection: {
      eyebrow: 'Perché sceglierci', heading: 'La nostra filosofia di servizio',
      cards: [
        { id: '247',      title: 'Assistenza per le prenotazioni', description: "A qualsiasi ora, ogni giorno. Per arrivi notturni o voli all'alba, contattaci su WhatsApp.",                                    icon: 'Clock', order: 0, enabled: true },
        { id: 'airport',  title: 'Transfer aeroportuale',          description: "Accettiamo prenotazioni per transfer dall'aeroporto di Istanbul (IST) e dall'aeroporto Sabiha Gokcen (SAW).",                   icon: 'Plane', order: 1, enabled: true },
        { id: 'vehicles', title: 'Veicoli VIP disponibili',        description: 'Organizziamo transfer individuali e di gruppo con Mercedes Vito e Mercedes Sprinter VIP.',                                      icon: 'Car',   order: 2, enabled: true },
        { id: 'meet',     title: 'Accoglienza e assistenza',       description: 'Il tuo autista ti accoglierà con un cartello riportante il tuo nome, ti aiuterà con i bagagli e ti accompagnerà a destinazione.', icon: 'User',  order: 3, enabled: true },
      ],
      enabled: true,
    },
    vehiclesSection:    { heading: 'La nostra flotta di veicoli VIP', description: 'Due veicoli di categoria superiore per ogni esigenza, entrambi completamente equipaggiati per il tuo comfort.', ctaText: 'Prenota ora', ctaRoute: '#rezervasyon', enabled: true },
    reviewsSection:     { eyebrow: 'Recensioni dei clienti su Google', heading: 'Le opinioni dei nostri passeggeri', viewAllText: 'Visualizza tutte le recensioni su Google', enabled: true },
    reservationSection: { eyebrow: 'Prenotazione rapida', heading: 'Richiesta di prezzo e prenotazione', description: 'Invia la tua richiesta e ti comunicheremo disponibilità e prezzi tramite WhatsApp.', enabled: true },
    contactSection:     { eyebrow: 'Contatti', heading: 'Siamo sempre a tua disposizione', subheading: 'Contattaci 24/7 per qualsiasi domanda. Ricevi assistenza rapida tramite WhatsApp.', whatsappCtaText: 'Invia un messaggio su WhatsApp', enabled: true },
    footerSection:      { tagline: 'Il servizio di transfer VIP più affidabile di Istanbul. Veicoli Mercedes di lusso, autisti professionisti, 24/7.', premiumTagline: 'Il servizio di transfer premium di Istanbul', col1Heading: 'Link rapidi', col2Heading: 'I nostri servizi', col3Heading: 'Contatti', copyrightText: 'Tutti i diritti riservati.' },
    seo: { metaTitle: 'Istanbul VIP Transfer | Transfer di lusso da aeroporto e in città', metaDescription: 'Transfer premium da aeroporto, trasporti interurbani e tour privati a Istanbul con lussuosi Mercedes Vito e Sprinter. Servizio 24/7.', ogTitle: 'Istanbul VIP Transfer | Transfer di lusso da aeroporto e in città', ogDescription: 'Transfer premium da aeroporto, trasporti interurbani e tour privati a Istanbul con lussuosi Mercedes Vito e Sprinter. Servizio 24/7.', ogImage: '/images/istanbul-vip-transfer-hero.webp', ogImageAlt: 'Istanbul VIP Transfer', indexable: true },
  },
  nl: {
    version: 1,
    hero: { badge: 'De premium transferdienst van Istanbul', headline1: 'Ontdek', headlineAccent: 'Istanbul', headline2: 'in comfort', subheadline: 'Van de luchthaven naar uw hotel, vergaderingen en elke bestemming — op tijd en veilig met onze luxe Mercedes-voertuigen en professionele chauffeurs.', ctaBookingText: 'Vraag een offerte aan / reserveer', ctaCallText: 'Bel nu', imagePath: '/images/istanbul-havalimani-mercedes-vip-transfer-hero.webp', imageAlt: 'Zwarte Mercedes voor VIP-transfer en professionele chauffeur bij de terminal van Istanbul Airport', enabled: true },
    heroStats: [
      { key: 'airport',  numberText: 'IST & SAW',       label: 'Luchthaventransfer',      order: 0, enabled: true },
      { key: 'support',  numberText: '7/24',             label: 'Boekingsondersteuning',   order: 1, enabled: true },
      { key: 'vehicles', numberText: 'Vito & Sprinter',  label: 'VIP-voertuigopties',      order: 2, enabled: true },
    ],
    servicesSection: { eyebrow: 'Onze diensten', heading: 'Transfer voor elke behoefte', description: 'Voor particulieren of bedrijven — uitgebreide VIP-service voor al uw transferbehoeften.', allServicesText: 'Alle diensten →', allServicesRoute: '/nl/services', enabled: true },
    trustSection: {
      eyebrow: 'Waarom voor ons kiezen', heading: 'Onze serviceaanpak',
      cards: [
        { id: '247',      title: 'Boekingsondersteuning', description: 'Op elk uur, elke dag. Een late aankomst of vroege vlucht — bereik ons via WhatsApp.',                                    icon: 'Clock', order: 0, enabled: true },
        { id: 'airport',  title: 'Luchthaventransfer',    description: 'Wij accepteren transferboekingen voor Istanbul Airport (IST) en Sabiha Gokcen Airport (SAW).',                          icon: 'Plane', order: 1, enabled: true },
        { id: 'vehicles', title: 'VIP-voertuigopties',    description: 'Wij regelen individuele en groepstransfers met Mercedes Vito en Mercedes Sprinter VIP.',                               icon: 'Car',   order: 2, enabled: true },
        { id: 'meet',     title: 'Meet & Greet',          description: 'Uw chauffeur verwelkomt u met een naambord, helpt met uw bagage en brengt u naar uw bestemming.',                      icon: 'User',  order: 3, enabled: true },
      ],
      enabled: true,
    },
    vehiclesSection:    { heading: 'Ons VIP-wagenpark', description: 'Twee topklasse voertuigopties voor elke behoefte — beide volledig uitgerust voor uw comfort.', ctaText: 'Nu boeken', ctaRoute: '#rezervasyon', enabled: true },
    reviewsSection:     { eyebrow: 'Google-klantbeoordelingen', heading: 'Wat onze passagiers zeggen', viewAllText: 'Bekijk alle beoordelingen op Google', enabled: true },
    reservationSection: { eyebrow: 'Snel boeken', heading: 'Prijs- en reserveringsaanvraag', description: 'Stuur uw aanvraag en wij delen beschikbaarheid en prijzen via WhatsApp.', enabled: true },
    contactSection:     { eyebrow: 'Contact', heading: 'Wij zijn altijd voor u beschikbaar', subheading: 'Bereik ons 24/7 voor al uw vragen. Snelle ondersteuning via WhatsApp.', whatsappCtaText: 'Stuur een bericht via WhatsApp', enabled: true },
    footerSection:      { tagline: 'De meest betrouwbare VIP-transferdienst van Istanbul. Luxe Mercedes-voertuigen, professionele chauffeurs, 24/7.', premiumTagline: 'De premium transferdienst van Istanbul', col1Heading: 'Snelle links', col2Heading: 'Onze diensten', col3Heading: 'Contact', copyrightText: 'Alle rechten voorbehouden.' },
    seo: { metaTitle: 'Istanbul VIP Transfer | Luxe luchthaven- en stadstransfers', metaDescription: 'Premium luchthaventransfers, intercitytransport en privérondleidingen in Istanbul met luxe Mercedes Vito en Sprinter. 24/7 service.', ogTitle: 'Istanbul VIP Transfer | Luxe luchthaven- en stadstransfers', ogDescription: 'Premium luchthaventransfers, intercitytransport en privérondleidingen in Istanbul met luxe Mercedes Vito en Sprinter. 24/7 service.', ogImage: '/images/istanbul-vip-transfer-hero.webp', ogImageAlt: 'Istanbul VIP Transfer', indexable: true },
  },
};
