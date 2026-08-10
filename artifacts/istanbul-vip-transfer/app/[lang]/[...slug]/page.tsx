/**
 * Locale-prefixed passthrough for Turkish content pages.
 *
 * Handles routes like /en/hizmetler, /de/istanbul-havalimani-transfer, etc.
 * The parent [lang]/layout.tsx already wraps children in <LangProvider forceLang={lang}>,
 * and PublicLayoutWrapper's outer LangProvider detects the lang from the URL pathname.
 * This means Header, Footer, and all client components automatically render in the
 * correct language even though the page content is Turkish.
 *
 * SEO: generateMetadata emits full Open Graph, hreflang alternates, and JSON-LD
 * (Service or WebPage) so AI crawlers and search engines understand each page's
 * content type, language, and publisher.
 *
 * NOTE: The param is named `slug` to match app/[lang]/blog/[slug]/page.tsx.
 * Next.js requires overlapping catch-all and named dynamic segments use the same name.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isValidLang, SUPPORTED_LANGS } from '@/lib/i18n';
import { buildAlternates, getOgLocale } from '@/lib/i18n/seo';
import { SITE } from '@/lib/site-config';

// ── Turkish page components ─────────────────────────────────────────────────
import HizmetlerPage          from '@/app/hizmetler/page';
import AraclarPage            from '@/app/araclar/page';
import HakkimizdaPage         from '@/app/hakkimizda/page';
import IletisimPage           from '@/app/iletisim/page';
import IstHavaPage            from '@/app/istanbul-havalimani-transfer/page';
import SabihaPage             from '@/app/sabiha-gokcen-havalimani-transfer/page';
import VipTransferPage        from '@/app/vip-transfer/page';
import SehirlerArasiPage      from '@/app/sehirler-arasi-transfer/page';
import SoforluPage            from '@/app/soforlu-arac-kiralama/page';
import OtelPage               from '@/app/otel-transfer/page';
import SaglikPage             from '@/app/saglik-turizmi-transfer/page';
import KurumPage              from '@/app/kurumsal-vip-transfer/page';
import IstBursaPage           from '@/app/istanbul-bursa-transfer/page';
import IstSapancaPage         from '@/app/istanbul-sapanca-transfer/page';
import IstGunubirlikPage      from '@/app/istanbul-gunubirlik-turlar/page';
import SapancaPage            from '@/app/sapanca-masukiye-turu/page';
import BursaPage              from '@/app/bursa-gunubirlik-tur/page';
import YalovaPage             from '@/app/yalova-gunubirlik-tur/page';

// ── Route map ───────────────────────────────────────────────────────────────
const PAGE_MAP: Record<string, React.ComponentType> = {
  'hizmetler':                         HizmetlerPage,
  'araclar':                           AraclarPage,
  'hakkimizda':                        HakkimizdaPage,
  'iletisim':                          IletisimPage,
  'istanbul-havalimani-transfer':      IstHavaPage,
  'sabiha-gokcen-havalimani-transfer': SabihaPage,
  'vip-transfer':                      VipTransferPage,
  'sehirler-arasi-transfer':           SehirlerArasiPage,
  'soforlu-arac-kiralama':             SoforluPage,
  'otel-transfer':                     OtelPage,
  'saglik-turizmi-transfer':           SaglikPage,
  'kurumsal-vip-transfer':             KurumPage,
  'istanbul-bursa-transfer':           IstBursaPage,
  'istanbul-sapanca-transfer':         IstSapancaPage,
  'istanbul-gunubirlik-turlar':        IstGunubirlikPage,
  'sapanca-masukiye-turu':             SapancaPage,
  'bursa-gunubirlik-tur':              BursaPage,
  'yalova-gunubirlik-tur':             YalovaPage,
};

// ── Page metadata (translated) ──────────────────────────────────────────────
type LangMeta = Record<string, { title: string; description: string }>;

/**
 * Schema.org type to use for each page slug.
 * 'Service' for transfer/tour pages, 'WebPage' for informational pages.
 */
const PAGE_SCHEMA_TYPE: Record<string, 'Service' | 'WebPage'> = {
  'hizmetler':                         'WebPage',
  'araclar':                           'WebPage',
  'hakkimizda':                        'WebPage',
  'iletisim':                          'WebPage',
  'istanbul-havalimani-transfer':      'Service',
  'sabiha-gokcen-havalimani-transfer': 'Service',
  'vip-transfer':                      'Service',
  'sehirler-arasi-transfer':           'Service',
  'soforlu-arac-kiralama':             'Service',
  'otel-transfer':                     'Service',
  'saglik-turizmi-transfer':           'Service',
  'kurumsal-vip-transfer':             'Service',
  'istanbul-bursa-transfer':           'Service',
  'istanbul-sapanca-transfer':         'Service',
  'istanbul-gunubirlik-turlar':        'Service',
  'sapanca-masukiye-turu':             'Service',
  'bursa-gunubirlik-tur':              'Service',
  'yalova-gunubirlik-tur':             'Service',
};

/**
 * Translated title and description for each slug × language.
 * Turkish is omitted — the canonical /slug page owns those.
 */
const PAGE_META: Record<string, LangMeta> = {
  'hizmetler': {
    en: { title: 'Our Services | VIP Transfer Istanbul', description: 'Explore all VIP transfer services in Istanbul — airport transfers, city tours, intercity routes, and corporate travel with luxury Mercedes vehicles.' },
    de: { title: 'Unsere Leistungen | VIP Transfer Istanbul', description: 'Entdecken Sie alle VIP-Transferdienste in Istanbul — Flughafentransfers, Stadttouren, Fernstrecken und Geschäftsreisen mit Mercedes-Luxusfahrzeugen.' },
    ru: { title: 'Наши услуги | VIP Transfer Istanbul', description: 'Все услуги VIP-трансфера в Стамбуле — трансферы из аэропорта, городские туры, межгородские маршруты и корпоративные поездки на автомобилях Mercedes.' },
    ar: { title: 'خدماتنا | VIP Transfer Istanbul', description: 'استكشف جميع خدمات نقل كبار الشخصيات في إسطنبول — نقل المطار والجولات السياحية والمسارات بين المدن والسفر التجاري بسيارات مرسيدس الفاخرة.' },
  },
  'araclar': {
    en: { title: 'Our Fleet | VIP Transfer Istanbul Vehicles', description: 'Luxury Mercedes Vito and Sprinter vehicles for premium transfer services in Istanbul. Spacious, air-conditioned, and professionally maintained.' },
    de: { title: 'Unsere Flotte | VIP Transfer Istanbul Fahrzeuge', description: 'Luxuriöse Mercedes Vito und Sprinter für Premium-Transferdienste in Istanbul. Geräumig, klimatisiert und professionell gewartet.' },
    ru: { title: 'Наш автопарк | VIP Transfer Istanbul', description: 'Роскошные автомобили Mercedes Vito и Sprinter для премиальных трансферных услуг в Стамбуле. Просторные, с кондиционером, профессионально обслуживаемые.' },
    ar: { title: 'أسطولنا | VIP Transfer Istanbul', description: 'سيارات مرسيدس فيتو وسبرينتر الفاخرة لخدمات النقل المتميزة في إسطنبول. واسعة ومكيفة الهواء وتتم صيانتها باحتراف.' },
  },
  'hakkimizda': {
    en: { title: 'About Us | VIP Transfer Istanbul', description: 'Learn about VIP Transfer Istanbul — professional chauffeurs, luxury Mercedes vehicles, and 24/7 premium transfer service across Istanbul and Turkey.' },
    de: { title: 'Über uns | VIP Transfer Istanbul', description: 'Erfahren Sie mehr über VIP Transfer Istanbul — professionelle Fahrer, Luxus-Mercedes-Fahrzeuge und 24/7 Premium-Transferservice in Istanbul und der Türkei.' },
    ru: { title: 'О нас | VIP Transfer Istanbul', description: 'Узнайте о VIP Transfer Istanbul — профессиональные водители, роскошные автомобили Mercedes и круглосуточный премиальный трансферный сервис по Стамбулу и Турции.' },
    ar: { title: 'من نحن | VIP Transfer Istanbul', description: 'تعرف على VIP Transfer Istanbul — سائقون محترفون وسيارات مرسيدس الفاخرة وخدمة نقل متميزة على مدار الساعة في إسطنبول وتركيا.' },
  },
  'iletisim': {
    en: { title: 'Contact | VIP Transfer Istanbul', description: 'Contact VIP Transfer Istanbul for your transfer needs. Available 24/7 by phone and WhatsApp for bookings and inquiries.' },
    de: { title: 'Kontakt | VIP Transfer Istanbul', description: 'Kontaktieren Sie VIP Transfer Istanbul für Ihre Transferanfragen. Rund um die Uhr telefonisch und per WhatsApp für Buchungen und Fragen erreichbar.' },
    ru: { title: 'Контакты | VIP Transfer Istanbul', description: 'Свяжитесь с VIP Transfer Istanbul для вашего трансфера. Доступны круглосуточно по телефону и WhatsApp для бронирования и запросов.' },
    ar: { title: 'اتصل بنا | VIP Transfer Istanbul', description: 'تواصل مع VIP Transfer Istanbul لاحتياجات النقل الخاصة بك. متاحون على مدار الساعة عبر الهاتف وواتساب للحجوزات والاستفسارات.' },
  },
  'istanbul-havalimani-transfer': {
    en: { title: 'Istanbul Airport Transfer | VIP Vito', description: 'Professional VIP transfer from Istanbul Airport (IST) to your hotel or destination. Mercedes Vito & Sprinter, meet-and-greet, 24/7 service.' },
    de: { title: 'Istanbul Flughafen Transfer | VIP Vito', description: 'Professioneller VIP-Transfer vom Flughafen Istanbul (IST) zu Ihrem Hotel oder Ziel. Mercedes Vito & Sprinter, Empfangsservice, 24/7.' },
    ru: { title: 'Трансфер из аэропорта Стамбул | VIP Vito', description: 'Профессиональный VIP-трансфер из аэропорта Стамбул (IST) в ваш отель. Mercedes Vito и Sprinter, встреча в аэропорту, круглосуточно.' },
    ar: { title: 'نقل مطار إسطنبول | VIP Vito', description: 'نقل VIP احترافي من مطار إسطنبول (IST) إلى فندقك أو وجهتك. مرسيدس فيتو وسبرينتر، خدمة الاستقبال، على مدار الساعة.' },
  },
  'sabiha-gokcen-havalimani-transfer': {
    en: { title: 'Sabiha Gökçen Airport Transfer | VIP Vito', description: 'Comfortable VIP transfer from Sabiha Gökçen Airport (SAW) to any Istanbul destination. Door-to-door service with luxury Mercedes vehicles.' },
    de: { title: 'Sabiha Gökçen Flughafen Transfer | VIP Vito', description: 'Komfortabler VIP-Transfer vom Flughafen Sabiha Gökçen (SAW) zu jedem Ziel in Istanbul. Tür-zu-Tür-Service mit Luxus-Mercedes-Fahrzeugen.' },
    ru: { title: 'Трансфер из аэропорта Сабиха Гёкчен | VIP Vito', description: 'Комфортный VIP-трансфер из аэропорта Сабиха Гёкчен (SAW) в любую точку Стамбула. Доставка до двери на автомобилях Mercedes.' },
    ar: { title: 'نقل مطار صبيحة كوكجن | VIP Vito', description: 'نقل VIP مريح من مطار صبيحة كوكجن (SAW) إلى أي وجهة في إسطنبول. خدمة من الباب إلى الباب بسيارات مرسيدس الفاخرة.' },
  },
  'vip-transfer': {
    en: { title: 'VIP Transfer Istanbul | Luxury Airport & City Transfer', description: "Istanbul's premium VIP transfer service. Luxury Mercedes fleet, professional chauffeurs — airport transfers, city rides, and intercity routes." },
    de: { title: 'VIP Transfer Istanbul | Luxus Flughafen & Stadtransfer', description: 'Istanbuls premium VIP-Transferservice. Luxus-Mercedes-Flotte, professionelle Fahrer — Flughafentransfers, Stadtfahrten und Fernstrecken.' },
    ru: { title: 'VIP Трансфер Стамбул | Люкс аэропорт и город', description: 'Премиальный VIP-трансфер в Стамбуле. Роскошный парк Mercedes, профессиональные водители — трансферы из аэропорта, городские поездки и межгород.' },
    ar: { title: 'نقل كبار الشخصيات إسطنبول | فاخر مطار ومدينة', description: 'خدمة النقل الراقية في إسطنبول. أسطول مرسيدس فاخر، سائقون محترفون — نقل المطار والتنقل داخل المدينة والمسارات بين المدن.' },
  },
  'sehirler-arasi-transfer': {
    en: { title: 'Intercity Transfer Istanbul | VIP Long Distance', description: 'Long-distance VIP transfer between Istanbul and major Turkish cities. Comfortable Mercedes vehicles with professional drivers, fixed prices.' },
    de: { title: 'Fernstrecken Transfer Istanbul | VIP Langstrecke', description: 'Langstrecken-VIP-Transfer zwischen Istanbul und großen türkischen Städten. Komfortable Mercedes-Fahrzeuge mit professionellen Fahrern, Festpreise.' },
    ru: { title: 'Межгородской трансфер Стамбул | VIP дальние расстояния', description: 'VIP-трансфер на дальние расстояния между Стамбулом и крупными городами Турции. Комфортные автомобили Mercedes с профессиональными водителями.' },
    ar: { title: 'نقل بين المدن إسطنبول | VIP مسافات طويلة', description: 'نقل VIP على المسافات الطويلة بين إسطنبول والمدن التركية الرئيسية. سيارات مرسيدس مريحة مع سائقين محترفين وأسعار ثابتة.' },
  },
  'soforlu-arac-kiralama': {
    en: { title: 'Chauffeured Car Hire Istanbul | Professional Driver', description: 'Hire a luxury Mercedes with a professional chauffeur in Istanbul. Flexible hourly or daily service for business, events, or leisure.' },
    de: { title: 'Fahrzeugmiete mit Fahrer Istanbul | Professionell', description: 'Mieten Sie einen Luxus-Mercedes mit professionellem Fahrer in Istanbul. Flexibler Stunden- oder Tagesservice für Geschäft, Events oder Freizeit.' },
    ru: { title: 'Аренда авто с водителем Стамбул | Профессионально', description: 'Аренда роскошного Mercedes с профессиональным водителем в Стамбуле. Гибкая почасовая или суточная аренда для бизнеса, мероприятий или отдыха.' },
    ar: { title: 'تأجير سيارة مع سائق إسطنبول | احترافي', description: 'استأجر سيارة مرسيدس فاخرة مع سائق محترف في إسطنبول. خدمة مرنة بالساعة أو اليوم للأعمال والفعاليات والترفيه.' },
  },
  'otel-transfer': {
    en: { title: 'Hotel Transfer Istanbul | Airport to Hotel VIP', description: 'Seamless airport-to-hotel and hotel-to-airport transfer in Istanbul. Meet-and-greet service with luxury Mercedes Vito and Sprinter.' },
    de: { title: 'Hotel Transfer Istanbul | Flughafen zum Hotel VIP', description: 'Nahtloser Transfer zwischen Flughafen und Hotel in Istanbul. Empfangsservice mit Luxus-Mercedes Vito und Sprinter.' },
    ru: { title: 'Трансфер в отель Стамбул | Аэропорт-отель VIP', description: 'Трансфер аэропорт–отель и отель–аэропорт в Стамбуле. Встреча с табличкой на роскошных автомобилях Mercedes Vito и Sprinter.' },
    ar: { title: 'نقل الفندق إسطنبول | مطار للفندق VIP', description: 'نقل سلس بين المطار والفندق في إسطنبول. خدمة الاستقبال بسيارات مرسيدس فيتو وسبرينتر الفاخرة.' },
  },
  'saglik-turizmi-transfer': {
    en: { title: 'Health Tourism Transfer Istanbul | Medical Transfer', description: 'Reliable and comfortable transfer service for medical tourism in Istanbul. Safe transport to hospitals, clinics, and health centres.' },
    de: { title: 'Gesundheitstourismus Transfer Istanbul | Medizinisch', description: 'Zuverlässiger und komfortabler Transferservice für Medizintourismus in Istanbul. Sicherer Transport zu Krankenhäusern, Kliniken und Gesundheitszentren.' },
    ru: { title: 'Трансфер для медтуризма Стамбул | Медицинский', description: 'Надёжный и комфортный трансфер для медицинского туризма в Стамбуле. Безопасная доставка в больницы, клиники и медицинские центры.' },
    ar: { title: 'نقل السياحة الصحية إسطنبول | طبي', description: 'خدمة نقل موثوقة ومريحة للسياحة الطبية في إسطنبول. نقل آمن إلى المستشفيات والعيادات والمراكز الصحية.' },
  },
  'kurumsal-vip-transfer': {
    en: { title: 'Corporate VIP Transfer Istanbul | Business Travel', description: 'Professional corporate VIP transfer service in Istanbul. Reliable transport for executives, business meetings, conferences, and corporate events.' },
    de: { title: 'Firmenkunden VIP Transfer Istanbul | Geschäftsreisen', description: 'Professioneller VIP-Firmenkunden-Transferservice in Istanbul. Zuverlässiger Transport für Führungskräfte, Geschäftstreffen und Firmenveranstaltungen.' },
    ru: { title: 'Корпоративный VIP Трансфер Стамбул | Бизнес', description: 'Профессиональный корпоративный VIP-трансфер в Стамбуле. Надёжный транспорт для руководителей, деловых встреч и корпоративных мероприятий.' },
    ar: { title: 'نقل VIP للشركات إسطنبول | سفر أعمال', description: 'خدمة نقل VIP مؤسسية احترافية في إسطنبول. نقل موثوق للمديرين التنفيذيين والاجتماعات التجارية والمؤتمرات والفعاليات الشركاتية.' },
  },
  'istanbul-bursa-transfer': {
    en: { title: 'Istanbul to Bursa Transfer | VIP Intercity', description: 'Direct VIP transfer between Istanbul and Bursa. Comfortable Mercedes vehicles, professional drivers, fixed prices — door-to-door service.' },
    de: { title: 'Istanbul nach Bursa Transfer | VIP Fernstrecke', description: 'Direkter VIP-Transfer zwischen Istanbul und Bursa. Komfortable Mercedes-Fahrzeuge, professionelle Fahrer, Festpreise — Tür-zu-Tür-Service.' },
    ru: { title: 'Трансфер Стамбул–Бурса | VIP межгород', description: 'Прямой VIP-трансфер между Стамбулом и Бурсой. Комфортные автомобили Mercedes, профессиональные водители, фиксированные цены.' },
    ar: { title: 'نقل من إسطنبول إلى بورصة | VIP بين المدن', description: 'نقل VIP مباشر بين إسطنبول وبورصة. سيارات مرسيدس مريحة وسائقون محترفون وأسعار ثابتة — خدمة من الباب إلى الباب.' },
  },
  'istanbul-sapanca-transfer': {
    en: { title: 'Istanbul to Sapanca Transfer | VIP Day Trip', description: 'VIP transfer from Istanbul to Sapanca and Maşukiye. Comfortable door-to-door transport for a relaxing lakeside day trip.' },
    de: { title: 'Istanbul nach Sapanca Transfer | VIP Tagesausflug', description: 'VIP-Transfer von Istanbul nach Sapanca und Maşukiye. Komfortabler Tür-zu-Tür-Transport für einen erholsamen Tagesausflug am See.' },
    ru: { title: 'Трансфер Стамбул–Сапанджа | VIP однодневная поездка', description: 'VIP-трансфер из Стамбула в Сапанджу и Мащукийе. Комфортная доставка от двери до двери для расслабляющего дня у озера.' },
    ar: { title: 'نقل من إسطنبول إلى سبانجة | VIP رحلة يوم', description: 'نقل VIP من إسطنبول إلى سبانجة وماشوكية. نقل مريح من الباب إلى الباب لرحلة يوم مريحة على ضفاف البحيرة.' },
  },
  'istanbul-gunubirlik-turlar': {
    en: { title: 'Istanbul Day Tours | Private Guided Excursions', description: "Discover Istanbul with private day tours. Bosphorus cruise, Historic Peninsula, Princes' Islands and more — with VIP transport and a professional guide." },
    de: { title: 'Istanbul Tagestouren | Private Ausflüge', description: "Entdecken Sie Istanbul mit privaten Tagestouren. Bosporus-Kreuzfahrt, Historische Halbinsel, Prinzeninseln und mehr — mit VIP-Transport und Reiseleiter." },
    ru: { title: 'Однодневные туры Стамбул | Частные экскурсии', description: 'Откройте Стамбул в частных однодневных турах. Босфор, Исторический полуостров, Принцевы острова и многое другое с VIP-транспортом и гидом.' },
    ar: { title: 'جولات يومية إسطنبول | رحلات موجهة خاصة', description: 'اكتشف إسطنبول في جولات يومية خاصة. مضيق البوسفور والشبه جزيرة التاريخية وجزر الأمراء والمزيد مع نقل VIP ومرشد محترف.' },
  },
  'sapanca-masukiye-turu': {
    en: { title: 'Sapanca & Maşukiye Tour | Day Trip from Istanbul', description: 'Private Sapanca and Maşukiye day tour from Istanbul. Enjoy the lake, nature walks, and waterfalls with comfortable VIP transport.' },
    de: { title: 'Sapanca & Maşukiye Tour | Tagesausflug aus Istanbul', description: 'Privater Tagesausflug nach Sapanca und Maşukiye ab Istanbul. Genießen Sie den See, Naturwanderwege und Wasserfälle mit komfortablem VIP-Transport.' },
    ru: { title: 'Тур Сапанджа и Мащукийе | Экскурсия из Стамбула', description: 'Частный однодневный тур в Сапанджу и Мащукийе из Стамбула. Озеро, природные прогулки и водопады с комфортным VIP-транспортом.' },
    ar: { title: 'جولة سبانجة وماشوكية | رحلة يوم من إسطنبول', description: 'جولة يوم خاصة إلى سبانجة وماشوكية من إسطنبول. استمتع بالبحيرة والمشي في الطبيعة والشلالات مع نقل VIP مريح.' },
  },
  'bursa-gunubirlik-tur': {
    en: { title: 'Bursa Day Tour from Istanbul | Private Excursion', description: 'Private day tour to Bursa from Istanbul. Visit the Grand Mosque, Green Bursa, cable car, and local markets with VIP transport.' },
    de: { title: 'Bursa Tagesausflug aus Istanbul | Private Tour', description: 'Privater Tagesausflug nach Bursa ab Istanbul. Besuchen Sie die Große Moschee, Grünes Bursa, die Seilbahn und lokale Märkte mit VIP-Transport.' },
    ru: { title: 'Однодневный тур в Бурсу из Стамбула | Частная экскурсия', description: 'Частный однодневный тур в Бурсу из Стамбула. Великая мечеть, Зелёная Бурса, канатная дорога и местные рынки с VIP-транспортом.' },
    ar: { title: 'جولة يوم بورصة من إسطنبول | رحلة خاصة', description: 'جولة يوم خاصة إلى بورصة من إسطنبول. زيارة الجامع الكبير وبورصة الخضراء والتلفريك والأسواق المحلية مع نقل VIP.' },
  },
  'yalova-gunubirlik-tur': {
    en: { title: 'Yalova Day Tour from Istanbul | Private Excursion', description: 'Private day tour to Yalova from Istanbul. Enjoy thermal springs, botanical gardens, and coastal nature with comfortable VIP transport.' },
    de: { title: 'Yalova Tagesausflug aus Istanbul | Private Tour', description: 'Privater Tagesausflug nach Yalova ab Istanbul. Genießen Sie Thermalquellen, botanische Gärten und Küstennatur mit komfortablem VIP-Transport.' },
    ru: { title: 'Однодневный тур в Ялову из Стамбула | Частная экскурсия', description: 'Частный однодневный тур в Ялову из Стамбула. Термальные источники, ботанические сады и прибрежная природа с комфортным VIP-транспортом.' },
    ar: { title: 'جولة يوم يالوا من إسطنبول | رحلة خاصة', description: 'جولة يوم خاصة إلى يالوا من إسطنبول. استمتع بالينابيع الحرارية والحدائق النباتية والطبيعة الساحلية مع نقل VIP مريح.' },
  },
};

// ── Types ────────────────────────────────────────────────────────────────────
interface Props {
  params: Promise<{ lang: string; slug: string[] }>;
}

// ── generateMetadata ─────────────────────────────────────────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isValidLang(lang)) return {};

  const pathKey = slug.join('/');
  if (!PAGE_MAP[pathKey]) return {};

  const meta = PAGE_META[pathKey]?.[lang];
  const title = meta?.title ?? 'VIP Transfer Istanbul';
  const description = meta?.description ?? undefined;

  // Canonical is the Turkish root path; this page is the lang-prefixed alternate.
  const canonicalPath = `/${pathKey}`;
  const pageUrl = `${SITE.siteUrl}/${lang}${canonicalPath}`;

  // All supported langs have static dictionaries → always published.
  const alternates = await buildAlternates(canonicalPath, [...SUPPORTED_LANGS]);

  return {
    title,
    description,
    alternates: {
      canonical: pageUrl,
      languages: alternates.languages,
    },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: 'VIP Transfer Istanbul',
      locale: getOgLocale(lang),
      type: 'website',
      images: [SITE.ogImage],
    },
    robots: { index: true, follow: true },
  };
}

// ── Page component ───────────────────────────────────────────────────────────
export default async function LocalizedPassthrough({ params }: Props) {
  const { lang, slug } = await params;

  if (!isValidLang(lang)) notFound();

  const pathKey = slug.join('/');
  const Page = PAGE_MAP[pathKey];

  if (!Page) notFound();

  // Build JSON-LD for this locale-prefixed page.
  const schemaType = PAGE_SCHEMA_TYPE[pathKey] ?? 'WebPage';
  const meta = PAGE_META[pathKey]?.[lang];
  const pageUrl = `${SITE.siteUrl}/${lang}/${pathKey}`;

  const jsonLd =
    schemaType === 'Service'
      ? {
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: meta?.title ?? 'VIP Transfer Istanbul',
          description: meta?.description,
          url: pageUrl,
          inLanguage: lang,
          provider: {
            '@type': 'LocalBusiness',
            name: 'VIP Transfer Istanbul',
            url: SITE.siteUrl,
            telephone: SITE.phoneE164,
            email: SITE.email,
          },
          areaServed: { '@type': 'City', name: 'İstanbul' },
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: meta?.title ?? 'VIP Transfer Istanbul',
          description: meta?.description,
          url: pageUrl,
          inLanguage: lang,
          publisher: {
            '@type': 'Organization',
            name: 'VIP Transfer Istanbul',
            url: SITE.siteUrl,
            telephone: SITE.phoneE164,
            email: SITE.email,
          },
        };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'VIP Transfer Istanbul', item: SITE.siteUrl },
      { '@type': 'ListItem', position: 2, name: meta?.title ?? pathKey, item: pageUrl },
    ],
  };

  return (
    <>
      <Page />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
    </>
  );
}
