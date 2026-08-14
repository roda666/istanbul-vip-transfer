'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Plane, Hotel, Map, Briefcase, PartyPopper, Route, ArrowRight } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { localePath } from '@/lib/locale-path';

interface Props {
  /**
   * Slugs of service pages that the admin has set showOnHomepage=false.
   * Cards whose slug appears here are hidden from the grid.
   * Passed from the parent server component after a DB visibility fetch.
   */
  hiddenSlugs?: Set<string>;
}

export default function Services({ hiddenSlugs }: Props = {}) {
  const { lang, dict } = useLang();
  const s = dict.services;
  const p = (path: string) => localePath(path, lang);

  /**
   * Pick the localised string for the current locale.
   * Falls back to English — NEVER falls through to Arabic or Turkish
   * for LTR locales that don't yet have a dedicated entry.
   */
  const t = (map: Record<string, string>): string => map[lang] ?? map.en ?? '';

  const services = [
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
  // Filter out services hidden by admin (showOnHomepage=false in CMS)
  ].filter(svc => !svc.slug || !hiddenSlugs?.has(svc.slug));

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
            {s.sectionLabel}
          </span>
          <h2
            className="text-4xl md:text-5xl font-bold mb-5"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}
          >
            {s.heading}
          </h2>
          <div
            className="mx-auto mb-6"
            style={{ width: '60px', height: '3px', background: 'linear-gradient(90deg, #C79A35, #E4B84B)', borderRadius: '2px' }}
          />
          <p className="text-base max-w-xl mx-auto" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
            {s.subheading}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((service, i) => {
            const card = (
              <motion.div
                key={service.title}
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
                  {service.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
                  {service.description}
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
              <Link key={service.title} href={service.href!} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C79A35] rounded-2xl">
                {card}
              </Link>
            ) : (
              <div key={service.title}>{card}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
