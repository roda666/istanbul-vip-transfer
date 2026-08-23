'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Plane, Hotel, Map, Briefcase, PartyPopper, Route, ArrowRight, Heart, Building2, Home, type LucideIcon } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { localizedPublicPath, localizedServicePath } from '@/lib/localized-service-path';
import { useHomepageCms } from '@/lib/homepage-cms-context';
import type { HomepageServiceCopy } from '@/lib/homepage-public-content';
import type { PublicServiceCatalogItem } from '@/lib/public-service-catalog-types';

interface Props {
  /** Published CMS service rows, including category and homepage visibility. */
  catalogServices?: PublicServiceCatalogItem[];
  serviceCopy?: HomepageServiceCopy;
  homepageMode?: boolean;
}

interface HomepageServiceCard {
  slug: string;
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
}

function getServiceIcon(category: string | null, slug: string): LucideIcon {
  const value = `${category ?? ''} ${slug}`.toLocaleLowerCase('tr-TR');
  if (value.includes('havaliman') || value.includes('airport')) return Plane;
  if (value.includes('otel') || value.includes('hotel')) return Hotel;
  if (value.includes('tur') || value.includes('tour')) return Map;
  if (value.includes('sehirler') || value.includes('intercity')) return Route;
  if (value.includes('kurumsal') || value.includes('corporate')) return Briefcase;
  if (value.includes('gelin') || value.includes('wedding')) return Heart;
  if (value.includes('villa')) return Home;
  if (value.includes('etkinlik') || value.includes('event')) return PartyPopper;
  return Building2;
}

export default function Services({ catalogServices, serviceCopy, homepageMode = false }: Props = {}) {
  const { lang, dict } = useLang();
  const s = dict.services;
  const cms = useHomepageCms();
  const section = homepageMode ? cms?.servicesSection : null;
  const p = (path: string) => localizedPublicPath(path, lang);

  if (section && !section.enabled) return null;

  /**
   * Pick the localised string for the current locale.
   * Falls back to English — NEVER falls through to Arabic or Turkish
   * for LTR locales that don't yet have a dedicated entry.
   */
  const t = (map: Record<string, string>): string => map[lang] ?? map.en ?? '';

  const fallbackServices: HomepageServiceCard[] = [
    {
      slug: 'istanbul-havalimani-transfer',
      icon: Plane,
      title: dict.nav.istTransfer,
      description: t({
        tr: "İstanbul Havalimanı'ndan her destinasyona Mercedes Vito ve Sprinter ile profesyonel karşılama ve transfer.",
        en: 'Professional meet & greet and transfer from Istanbul Airport to any destination with Mercedes Vito and Sprinter.',
        de: 'Professioneller Empfang und Transfer vom Istanbul Flughafen zu jedem Ziel mit Mercedes Vito und Sprinter.',
        ru: 'Профессиональная встреча и трансфер из аэропорта Стамбула в любую точку на Mercedes Vito и Sprinter.',
        ar: 'استقبال احترافي ونقل من مطار إسطنبول إلى أي وجهة بسيارات مرسيدس فيتو وسبرينتر.',
        es: 'Recepción profesional y traslado desde el Aeropuerto de Estambul a cualquier destino con Mercedes Vito y Sprinter.',
        fr: "Accueil professionnel et transfert depuis l'aéroport d'Istanbul vers toute destination avec Mercedes Vito et Sprinter.",
        it: "Accoglienza professionale e trasferimento dall'Aeroporto di Istanbul verso qualsiasi destinazione con Mercedes Vito e Sprinter.",
        nl: 'Professionele begroeting en transfer van de luchthaven Istanbul naar elke bestemming met Mercedes Vito en Sprinter.',
      }),
      href: p('/istanbul-havalimani-transfer'),
    },
    {
      icon: Plane,
      title: dict.nav.sawTransfer,
      description: t({
        tr: "Sabiha Gökçen Havalimanı'ndan İstanbul'un her noktasına Mercedes Vito ve Sprinter ile VIP transfer.",
        en: 'VIP transfer from Sabiha Gökçen Airport to every point in Istanbul with Mercedes Vito and Sprinter.',
        de: 'VIP-Transfer vom Flughafen Sabiha Gökçen zu jedem Punkt in Istanbul mit Mercedes Vito und Sprinter.',
        ru: 'VIP-трансфер из аэропорта Сабиха Гёкчен в любую точку Стамбула на Mercedes Vito и Sprinter.',
        ar: 'نقل VIP من مطار صبيحة كوكجن إلى كل نقطة في إسطنبول بسيارات مرسيدس فيتو وسبرينتر.',
        es: 'Traslado VIP desde el Aeropuerto de Sabiha Gökçen a todos los puntos de Estambul con Mercedes Vito y Sprinter.',
        fr: "Transfert VIP depuis l'aéroport Sabiha Gökçen vers tous les points d'Istanbul avec Mercedes Vito et Sprinter.",
        it: "Transfer VIP dall'aeroporto Sabiha Gökçen verso ogni punto di Istanbul con Mercedes Vito e Sprinter.",
        nl: 'VIP-transfer van de luchthaven Sabiha Gökçen naar elk punt in Istanbul met Mercedes Vito en Sprinter.',
      }),
      slug: 'sabiha-gokcen-havalimani-transfer',
      href: p('/sabiha-gokcen-havalimani-transfer'),
    },
    {
      slug: 'otel-transfer',
      icon: Hotel,
      title: dict.nav.hotelTransfer,
      description: t({
        tr: "İstanbul'un tüm otellerinden kapıdan kapıya sorunsuz transfer hizmeti.",
        en: 'Seamless door-to-door transfer service from all hotels in Istanbul.',
        de: 'Nahtloser Tür-zu-Tür-Transferservice von allen Hotels in Istanbul.',
        ru: 'Беспроблемный трансфер «от двери до двери» из всех отелей Стамбула.',
        ar: 'خدمة نقل سلسة من الباب إلى الباب من جميع فنادق إسطنبول.',
        es: 'Servicio de traslado puerta a puerta sin interrupciones desde todos los hoteles de Estambul.',
        fr: "Service de transfert porte-à-porte sans interruption depuis tous les hôtels d'Istanbul.",
        it: 'Servizio di trasferimento porta a porta senza interruzioni da tutti gli hotel di Istanbul.',
        nl: 'Naadloze deur-tot-deur transferservice vanuit alle hotels in Istanbul.',
      }),
    },
    {
      slug: 'istanbul-gunubirlik-turlar',
      icon: Map,
      title: t({
        tr: 'Şehir Turu',
        en: 'City Tour',
        de: 'Stadtführung',
        ru: 'Городской тур',
        ar: 'جولة المدينة',
        es: 'Tour por la ciudad',
        fr: 'Visite de la ville',
        it: 'Tour della città',
        nl: 'Stadstour',
      }),
      description: t({
        tr: "İstanbul'un tarihi ve modern güzelliklerini özel şoförlü aracınızla keşfedin.",
        en: "Explore Istanbul's historic and modern beauty with your private chauffeur.",
        de: "Entdecken Sie Istanbuls historische und moderne Schönheiten mit Ihrem privaten Fahrer.",
        ru: 'Откройте для себя историческую и современную красоту Стамбула с личным водителем.',
        ar: 'استكشف جمال إسطنبول التاريخي والحديث مع سائقك الخاص.',
        es: 'Descubra la belleza histórica y moderna de Estambul con su conductor privado.',
        fr: "Découvrez la beauté historique et moderne d'Istanbul avec votre chauffeur privé.",
        it: 'Scopri la bellezza storica e moderna di Istanbul con il tuo autista privato.',
        nl: 'Ontdek de historische en moderne schoonheid van Istanbul met uw privéchauffeur.',
      }),
    },
    {
      slug: 'kurumsal-vip-transfer',
      icon: Briefcase,
      title: dict.nav.corporateTransfer,
      description: t({
        tr: 'İş toplantıları, konferanslar ve kurumsal etkinlikler için güvenilir ve temsili transfer.',
        en: 'Reliable and representative transfer for business meetings, conferences and corporate events.',
        de: 'Zuverlässiger und repräsentativer Transfer für Geschäftsmeetings, Konferenzen und Firmenveranstaltungen.',
        ru: 'Надёжный и представительный трансфер для деловых встреч, конференций и корпоративных мероприятий.',
        ar: 'نقل موثوق ومميز لاجتماعات الأعمال والمؤتمرات والفعاليات المؤسسية.',
        es: 'Traslado fiable y representativo para reuniones de negocios, conferencias y eventos corporativos.',
        fr: "Transfert fiable et représentatif pour les réunions d'affaires, conférences et événements d'entreprise.",
        it: 'Trasferimento affidabile e rappresentativo per riunioni di lavoro, conferenze ed eventi aziendali.',
        nl: 'Betrouwbare en representatieve transfer voor zakelijke vergaderingen, conferenties en bedrijfsevenementen.',
      }),
    },
    {
      slug: 'vip-transfer',
      icon: PartyPopper,
      title: t({
        tr: 'Özel Etkinlik Transferi',
        en: 'Special Event Transfer',
        de: 'Sonderveranstaltungs-Transfer',
        ru: 'Трансфер для особых мероприятий',
        ar: 'نقل للمناسبات الخاصة',
        es: 'Traslado para eventos especiales',
        fr: 'Transfert pour événements spéciaux',
        it: 'Transfer per eventi speciali',
        nl: 'Transfer voor speciale evenementen',
      }),
      description: t({
        tr: 'Düğün, gala ve özel davetler için lüks araç kiralama ve konvoy hizmeti.',
        en: 'Luxury vehicle hire and convoy service for weddings, galas and private events.',
        de: 'Luxusfahrzeugmiete und Konvoiservice für Hochzeiten, Galas und private Veranstaltungen.',
        ru: 'Аренда роскошных автомобилей и кортеж для свадеб, гала-вечеров и частных мероприятий.',
        ar: 'تأجير سيارات فاخرة وخدمة موكب للأعراس والحفلات الرسمية والفعاليات الخاصة.',
        es: 'Alquiler de vehículos de lujo y servicio de convoy para bodas, galas y eventos privados.',
        fr: 'Location de véhicules de luxe et service de convoi pour mariages, galas et événements privés.',
        it: 'Noleggio di veicoli di lusso e servizio convoglio per matrimoni, gala e eventi privati.',
        nl: "Luxe voertuigverhuur en konvooiservice voor bruiloften, gala's en privé-evenementen.",
      }),
    },
    {
      slug: 'sehirler-arasi-transfer',
      icon: Route,
      title: dict.nav.intercityTransfer,
      description: t({
        tr: "İstanbul'dan Türkiye'nin farklı şehirlerine Mercedes Vito ve Sprinter araçlarla konforlu, kapıdan kapıya özel transfer.",
        en: 'Comfortable door-to-door private transfer from Istanbul to other Turkish cities with Mercedes Vito and Sprinter.',
        de: 'Komfortabler Tür-zu-Tür-Privattransfer von Istanbul in andere türkische Städte mit Mercedes Vito und Sprinter.',
        ru: 'Комфортный частный трансфер «от двери до двери» из Стамбула в другие города Турции на Mercedes Vito и Sprinter.',
        ar: 'نقل خاص مريح من الباب إلى الباب من إسطنبول إلى مدن تركية أخرى بسيارات مرسيدس فيتو وسبرينتر.',
        es: 'Cómodo traslado privado puerta a puerta desde Estambul a otras ciudades de Turquía con Mercedes Vito y Sprinter.',
        fr: "Transfert privé confortable de porte-à-porte depuis Istanbul vers d'autres villes de Turquie avec Mercedes Vito et Sprinter.",
        it: 'Comodo trasferimento privato porta a porta da Istanbul ad altre città della Turchia con Mercedes Vito e Sprinter.',
        nl: 'Comfortabele deur-tot-deur privétransfer van Istanbul naar andere Turkse steden met Mercedes Vito en Sprinter.',
      }),
      href: p('/sehirler-arasi-transfer'),
    },
    {
      slug: 'ankara-vip-transfer',
      icon: Plane,
      title: t({
        tr: 'Ankara VIP Transfer',
        en: 'Ankara VIP Transfer',
        de: 'Ankara VIP Transfer',
        ru: 'VIP-трансфер Анкара',
        ar: 'نقل VIP أنقرة',
        es: 'Transfer VIP Ankara',
        fr: 'Transfert VIP Ankara',
        it: 'Transfer VIP Ankara',
        nl: 'Ankara VIP Transfer',
      }),
      description: t({
        tr: "Ankara Esenboğa Havalimanı'ndan şehrin tüm noktalarına Mercedes Vito ve Sprinter ile profesyonel VIP transfer.",
        en: 'Professional VIP transfer from Ankara Esenboğa Airport to any point in the city with Mercedes Vito and Sprinter.',
        de: 'Professioneller VIP-Transfer vom Flughafen Ankara Esenboğa zu jedem Punkt der Stadt mit Mercedes Vito und Sprinter.',
        ru: 'Профессиональный VIP-трансфер из аэропорта Анкара Эсенбога в любую точку города на Mercedes Vito и Sprinter.',
        ar: 'نقل VIP احترافي من مطار أنقرة إيسنبوغا إلى أي نقطة في المدينة بسيارات مرسيدس فيتو وسبرينتر.',
        es: 'Transfer VIP profesional desde el aeropuerto Esenboğa de Ankara a cualquier punto de la ciudad con Mercedes Vito y Sprinter.',
        fr: "Transfert VIP professionnel depuis l'aéroport Esenboğa d'Ankara vers n'importe quel point de la ville avec Mercedes Vito et Sprinter.",
        it: "Transfer VIP professionale dall'aeroporto Esenboğa di Ankara verso qualsiasi punto della città con Mercedes Vito e Sprinter.",
        nl: 'Professionele VIP-transfer van luchthaven Ankara Esenboğa naar elk punt in de stad met Mercedes Vito en Sprinter.',
      }),
      href: p('/ankara-vip-transfer'),
    },
    {
      slug: 'antalya-vip-transfer',
      icon: Plane,
      title: t({
        tr: 'Antalya VIP Transfer',
        en: 'Antalya VIP Transfer',
        de: 'Antalya VIP Transfer',
        ru: 'VIP-трансфер Анталья',
        ar: 'نقل VIP أنطاليا',
        es: 'Transfer VIP Antalya',
        fr: 'Transfert VIP Antalya',
        it: 'Transfer VIP Antalya',
        nl: 'Antalya VIP Transfer',
      }),
      description: t({
        tr: "Antalya Havalimanı'ndan Kemer, Belek, Side ve Alanya'ya Mercedes ile konforlu VIP transfer.",
        en: 'Comfortable VIP transfer from Antalya Airport to Kemer, Belek, Side and Alanya with Mercedes.',
        de: 'Komfortabler VIP-Transfer vom Flughafen Antalya nach Kemer, Belek, Side und Alanya mit Mercedes.',
        ru: 'Комфортный VIP-трансфер из аэропорта Антальи в Кемер, Белек, Сиде и Аланью на Mercedes.',
        ar: 'نقل VIP مريح من مطار أنطاليا إلى كيمر وبيليك وسيدي وألانيا بسيارات مرسيدس.',
        es: 'Cómodo transfer VIP desde el aeropuerto de Antalya a Kemer, Belek, Side y Alanya con Mercedes.',
        fr: "Transfert VIP confortable depuis l'aéroport d'Antalya vers Kemer, Belek, Side et Alanya avec Mercedes.",
        it: "Comodo transfer VIP dall'aeroporto di Antalya a Kemer, Belek, Side e Alanya con Mercedes.",
        nl: 'Comfortabele VIP-transfer van luchthaven Antalya naar Kemer, Belek, Side en Alanya met Mercedes.',
      }),
      href: p('/antalya-vip-transfer'),
    },
    {
      slug: 'izmir-vip-transfer',
      icon: Plane,
      title: t({
        tr: 'İzmir VIP Transfer',
        en: 'Izmir VIP Transfer',
        de: 'Izmir VIP Transfer',
        ru: 'VIP-трансфер Измир',
        ar: 'نقل VIP إزمير',
        es: 'Transfer VIP Izmir',
        fr: 'Transfert VIP Izmir',
        it: 'Transfer VIP Izmir',
        nl: 'Izmir VIP Transfer',
      }),
      description: t({
        tr: "İzmir Adnan Menderes Havalimanı'ndan Çeşme, Alaçatı ve şehir merkezine Mercedes ile VIP transfer.",
        en: 'VIP transfer from Izmir Adnan Menderes Airport to Çeşme, Alaçatı and city centre with Mercedes.',
        de: 'VIP-Transfer vom Flughafen Izmir Adnan Menderes nach Çeşme, Alaçatı und ins Stadtzentrum mit Mercedes.',
        ru: 'VIP-трансфер из аэропорта Измир Аднан Мендерес в Чешме, Алачаты и центр города на Mercedes.',
        ar: 'نقل VIP من مطار إزمير أدنان مندريس إلى تشيشمه وألاتشاتي ووسط المدينة بسيارات مرسيدس.',
        es: 'Transfer VIP desde el aeropuerto Adnan Menderes de Izmir a Çeşme, Alaçatı y el centro de la ciudad con Mercedes.',
        fr: "Transfert VIP depuis l'aéroport Adnan Menderes d'Izmir vers Çeşme, Alaçatı et le centre-ville avec Mercedes.",
        it: "Transfer VIP dall'aeroporto Adnan Menderes di Izmir verso Çeşme, Alaçatı e il centro città con Mercedes.",
        nl: 'VIP-transfer van luchthaven Izmir Adnan Menderes naar Çeşme, Alaçatı en het stadscentrum met Mercedes.',
      }),
      href: p('/izmir-vip-transfer'),
    },
    {
      slug: 'gelin-arabasi-kiralama',
      icon: Heart,
      title: t({
        tr: 'Gelin Arabası Kiralama',
        en: 'Wedding Car Hire',
        de: 'Hochzeitsauto Mieten',
        ru: 'Аренда свадебного автомобиля',
        ar: 'تأجير سيارة الزفاف',
        es: 'Alquiler Coche de Boda',
        fr: 'Location Voiture de Mariage',
        it: 'Noleggio Auto da Sposa',
        nl: 'Bruidsauto Huren',
      }),
      description: t({
        tr: 'Düğününüz için özel süslemeli Mercedes Vito veya Sprinter ile lüks gelin arabası hizmeti.',
        en: 'Luxury wedding car service with specially decorated Mercedes Vito or Sprinter for your big day.',
        de: 'Luxus-Hochzeitsauto-Service mit speziell dekoriertem Mercedes Vito oder Sprinter für Ihren großen Tag.',
        ru: 'Роскошный свадебный автомобиль — специально украшенный Mercedes Vito или Sprinter для вашего особого дня.',
        ar: 'خدمة سيارة زفاف فاخرة مع مرسيدس فيتو أو سبرينتر مزينة خصيصاً ليوم زفافكم.',
        es: 'Servicio de coche de boda de lujo con Mercedes Vito o Sprinter especialmente decorado para su gran día.',
        fr: 'Service de voiture de mariage de luxe avec Mercedes Vito ou Sprinter spécialement décoré pour votre grand jour.',
        it: 'Servizio auto da sposa di lusso con Mercedes Vito o Sprinter appositamente decorata per il vostro giorno speciale.',
        nl: 'Luxe bruidsautodienst met speciaal versierde Mercedes Vito of Sprinter voor uw grote dag.',
      }),
      href: p('/gelin-arabasi-kiralama'),
    },
    {
      slug: 'vip-protokol-secim-araci',
      icon: Building2,
      title: t({
        tr: 'VIP Protokol ve Seçim Aracı',
        en: 'VIP Protocol & Campaign Vehicle',
        de: 'VIP-Protokoll & Wahlkampffahrzeug',
        ru: 'VIP-протокол и предвыборный автомобиль',
        ar: 'مركبة البروتوكول VIP والحملات الانتخابية',
        es: 'Vehículo VIP de Protocolo y Campaña',
        fr: 'Véhicule VIP Protocole & Campagne Électorale',
        it: 'Veicolo VIP Protocollo e Campagna Elettorale',
        nl: 'VIP Protocol- en Campagnevoertuig',
      }),
      description: t({
        tr: 'Protokol etkinlikleri ve seçim kampanyaları için diskret, profesyonel özel şoförlü VIP araç tahsisi.',
        en: 'Discreet, professional chauffeur-driven VIP vehicle allocation for protocol events and election campaigns.',
        de: 'Diskreter, professioneller VIP-Fahrzeugpool mit Fahrer für Protokollveranstaltungen und Wahlkampagnen.',
        ru: 'Деликатное, профессиональное выделение VIP-автомобиля с водителем для протокольных мероприятий и предвыборных кампаний.',
        ar: 'تخصيص مركبة VIP احترافية وسرية مع سائق لفعاليات البروتوكول والحملات الانتخابية.',
        es: 'Asignación discreta y profesional de vehículo VIP con conductor para eventos de protocolo y campañas electorales.',
        fr: "Attribution discrète et professionnelle d'un véhicule VIP avec chauffeur pour les événements protocolaires et les campagnes électorales.",
        it: 'Allocazione discreta e professionale di veicolo VIP con autista per eventi di protocollo e campagne elettorali.',
        nl: 'Discrete, professionele toewijzing van een VIP-voertuig met chauffeur voor protocolevenementen en verkiezingscampagnes.',
      }),
      href: p('/vip-protokol-secim-araci'),
    },
    {
      slug: 'gunluk-villa-kiralama',
      icon: Home,
      title: t({
        tr: 'Günlük Villa Kiralama',
        en: 'Daily Villa Rental',
        de: 'Tagesweise Villa Mieten',
        ru: 'Посуточная аренда виллы',
        ar: 'استئجار فيلا يومي',
        es: 'Alquiler de Villa por Día',
        fr: 'Location de Villa à la Journée',
        it: 'Affitto Villa Giornaliero',
        nl: 'Daghuur Villa',
      }),
      description: t({
        tr: "İstanbul çevresinde özel havuzlu günlük kiralık lüks villa. Transfer hizmetiyle birlikte.",
        en: 'Luxury daily villa rental with private pool near Istanbul. Includes transfer service.',
        de: 'Luxuriöse tagesweise Villenvermietung mit Privatpool in der Nähe von Istanbul. Inklusive Transferservice.',
        ru: 'Роскошная посуточная аренда виллы с частным бассейном вблизи Стамбула. Включает трансферный сервис.',
        ar: 'استئجار فيلا فاخرة يومي مع مسبح خاص بالقرب من إسطنبول. يشمل خدمة النقل.',
        es: 'Alquiler de villa de lujo por día con piscina privada cerca de Estambul. Incluye servicio de traslado.',
        fr: 'Location de villa de luxe à la journée avec piscine privée près d\'Istanbul. Comprend le service de transfert.',
        it: 'Affitto villa di lusso giornaliero con piscina privata vicino a Istanbul. Include servizio transfer.',
        nl: 'Luxe dagverhuur van villa met privézwembad nabij Istanbul. Inclusief transferservice.',
      }),
      href: p('/gunluk-villa-kiralama'),
    },
  ];
  // Public homepage calls always provide catalogServices. The fallback only
  // preserves isolated legacy renders that do not have a server catalog.
  const services: HomepageServiceCard[] = catalogServices
    ? catalogServices
      .filter((service) => service.showOnHomepage)
      .map((service) => ({
        slug: service.slug,
        icon: getServiceIcon(service.category, service.slug),
        title: service.title,
        description: service.excerpt ?? '',
        href: localizedServicePath(service.slug, lang),
      }))
    : fallbackServices;
  const allServicesHref = section?.allServicesRoute?.startsWith('/')
    ? (section.allServicesRoute.startsWith(`/${lang}/`) || section.allServicesRoute === `/${lang}`
      ? section.allServicesRoute
      : p(section.allServicesRoute))
    : p('/hizmetler');

  return (
    <section
      id="hizmetler"
      className="py-24 relative"
      style={{ background: '#FFFDF8' }}
      data-testid="services-section"
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: '#D9E2EC' }} aria-hidden="true" />
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          data-testid="services-header"
        >
          <span
            className="text-xs tracking-[0.3em] uppercase mb-4 block"
            style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}
          >
            {section?.eyebrow ?? s.sectionLabel}
          </span>
          <h2
            className="text-4xl md:text-5xl font-bold mb-5"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}
          >
            {section?.heading ?? s.heading}
          </h2>
          <div
            className="mx-auto mb-6"
            style={{ width: '60px', height: '3px', background: 'linear-gradient(90deg, #C79A35, #E4B84B)', borderRadius: '2px' }}
          />
          <p className="text-base max-w-xl mx-auto" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
            {section?.description ?? s.subheading}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((service, i) => {
            const managedCopy = service.slug ? serviceCopy?.[service.slug] : undefined;
            const title = managedCopy?.title ?? service.title;
            const description = managedCopy?.description ?? service.description;
            const card = (
              <motion.div
                key={service.slug ?? String(service.title)}
                className="group relative p-7 rounded-2xl overflow-hidden cursor-pointer h-full"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #D9E2EC',
                  boxShadow: '0 2px 12px rgba(16,42,67,0.05)',
                  transition: 'box-shadow 0.25s, transform 0.25s, border-color 0.25s',
                }}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.6, delay: (i % 3) * 0.1 }}
                whileHover={{
                  y: -4,
                  boxShadow: '0 12px 40px rgba(16,42,67,0.1)',
                  borderColor: 'rgba(199,154,53,0.4)',
                  transition: { duration: 0.25 },
                }}
                data-testid={`service-card-${i}`}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-colors duration-300 group-hover:bg-[#C79A35]/15"
                  style={{ background: 'rgba(199,154,53,0.1)', border: '1px solid rgba(199,154,53,0.2)' }}
                >
                  <service.icon size={22} style={{ color: '#C79A35' }} aria-hidden="true" />
                </div>
                <h3
                  className="text-lg font-semibold mb-3 transition-colors duration-300 group-hover:text-[#C79A35]"
                  style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}
                >
                  {title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
                  {description}
                </p>
                {'href' in service && (
                  <div
                    className="flex items-center gap-1.5 mt-5 text-xs font-semibold tracking-wider uppercase transition-colors duration-300 group-hover:text-[#C79A35]"
                    style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}
                  >
                    {s.detailsLink}
                    <ArrowRight size={12} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                  </div>
                )}
                {/* Bottom accent line on hover */}
                <div
                  className="absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full transition-all duration-500"
                  style={{ background: 'linear-gradient(90deg, #C79A35, transparent)' }}
                  aria-hidden="true"
                />
              </motion.div>
            );
            return 'href' in service ? (
              <Link key={service.slug ?? String(service.title)} href={service.href!} title={typeof title === 'string' ? title : undefined} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C79A35] rounded-2xl">
                {card}
              </Link>
            ) : (
              <div key={service.slug ?? String(service.title)}>{card}</div>
            );
          })}
        </div>
        <div className="text-center mt-10">
          <Link
            href={allServicesHref}
            className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C79A35] rounded"
            style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}
          >
            {section?.allServicesText ?? s.detailsLink}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
