'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Plane, Hotel, Map, Briefcase, PartyPopper, Route, ArrowRight } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { localePath } from '@/lib/locale-path';

export default function Services() {
  const { lang, dict } = useLang();
  const s = dict.services;
  const p = (path: string) => localePath(path, lang);

  const serviceDesc = (tr: string, en: string, de: string, ru: string, ar: string) =>
    lang === 'tr' ? tr : lang === 'en' ? en : lang === 'de' ? de : lang === 'ru' ? ru : ar;

  const services = [
    {
      icon: Plane,
      title: dict.nav.istTransfer,
      description: serviceDesc(
        "İstanbul Havalimanı'ndan her destinasyona Mercedes Vito ve Sprinter ile profesyonel karşılama ve transfer.",
        "Professional meet & greet and transfer from Istanbul Airport to any destination with Mercedes Vito and Sprinter.",
        "Professioneller Empfang und Transfer vom Istanbul Flughafen zu jedem Ziel mit Mercedes Vito und Sprinter.",
        "Профессиональная встреча и трансфер из аэропорта Стамбула в любую точку на Mercedes Vito и Sprinter.",
        "استقبال احترافي ونقل من مطار إسطنبول إلى أي وجهة بسيارات مرسيدس فيتو وسبرينتر.",
      ),
      href: p('/istanbul-havalimani-transfer'),
    },
    {
      icon: Plane,
      title: dict.nav.sawTransfer,
      description: serviceDesc(
        "Sabiha Gökçen Havalimanı'ndan İstanbul'un her noktasına Mercedes Vito ve Sprinter ile VIP transfer.",
        "VIP transfer from Sabiha Gökçen Airport to every point in Istanbul with Mercedes Vito and Sprinter.",
        "VIP-Transfer vom Flughafen Sabiha Gökçen zu jedem Punkt in Istanbul mit Mercedes Vito und Sprinter.",
        "VIP-трансфер из аэропорта Сабиха Гёкчен в любую точку Стамбула на Mercedes Vito и Sprinter.",
        "نقل VIP من مطار صبيحة كوكجن إلى كل نقطة في إسطنبول بسيارات مرسيدس فيتو وسبرينتر.",
      ),
      href: p('/sabiha-gokcen-havalimani-transfer'),
    },
    {
      icon: Hotel,
      title: dict.nav.hotelTransfer,
      description: serviceDesc(
        "İstanbul'un tüm otellerinden kapıdan kapıya sorunsuz transfer hizmeti.",
        "Seamless door-to-door transfer service from all hotels in Istanbul.",
        "Nahtloser Tür-zu-Tür-Transferservice von allen Hotels in Istanbul.",
        "Беспроблемный трансфер «от двери до двери» из всех отелей Стамбула.",
        "خدمة نقل سلسة من الباب إلى الباب من جميع فنادق إسطنبول.",
      ),
    },
    {
      icon: Map,
      title: serviceDesc("Şehir Turu", "City Tour", "Stadtführung", "Городской тур", "جولة المدينة"),
      description: serviceDesc(
        "İstanbul'un tarihi ve modern güzelliklerini özel şoförlü aracınızla keşfedin.",
        "Explore Istanbul's historic and modern beauty with your private chauffeur.",
        "Entdecken Sie Istanbuls historische und moderne Schönheiten mit Ihrem privaten Fahrer.",
        "Откройте для себя историческую и современную красоту Стамбула с личным водителем.",
        "استكشف جمال إسطنبول التاريخي والحديث مع سائقك الخاص.",
      ),
    },
    {
      icon: Briefcase,
      title: dict.nav.corporateTransfer,
      description: serviceDesc(
        "İş toplantıları, konferanslar ve kurumsal etkinlikler için güvenilir ve temsili transfer.",
        "Reliable and representative transfer for business meetings, conferences and corporate events.",
        "Zuverlässiger und repräsentativer Transfer für Geschäftsmeetings, Konferenzen und Firmenveranstaltungen.",
        "Надёжный и представительный трансфер для деловых встреч, конференций и корпоративных мероприятий.",
        "نقل موثوق ومميز لاجتماعات الأعمال والمؤتمرات والفعاليات المؤسسية.",
      ),
    },
    {
      icon: PartyPopper,
      title: serviceDesc("Özel Etkinlik Transferi", "Special Event Transfer", "Sonderveranstaltungs-Transfer", "Трансфер для особых мероприятий", "نقل للمناسبات الخاصة"),
      description: serviceDesc(
        "Düğün, gala ve özel davetler için lüks araç kiralama ve konvoy hizmeti.",
        "Luxury vehicle hire and convoy service for weddings, galas and private events.",
        "Luxusfahrzeugmiete und Konvoiservice für Hochzeiten, Galas und private Veranstaltungen.",
        "Аренда роскошных автомобилей и кортеж для свадеб, гала-вечеров и частных мероприятий.",
        "تأجير سيارات فاخرة وخدمة موكب للأعراس والحفلات الرسمية والفعاليات الخاصة.",
      ),
    },
    {
      icon: Route,
      title: dict.nav.intercityTransfer,
      description: serviceDesc(
        "İstanbul'dan Türkiye'nin farklı şehirlerine Mercedes Vito ve Sprinter araçlarla konforlu, kapıdan kapıya özel transfer.",
        "Comfortable door-to-door private transfer from Istanbul to other Turkish cities with Mercedes Vito and Sprinter.",
        "Komfortabler Tür-zu-Tür-Privattransfer von Istanbul in andere türkische Städte mit Mercedes Vito und Sprinter.",
        "Комфортный частный трансфер «от двери до двери» из Стамбула в другие города Турции на Mercedes Vito и Sprinter.",
        "نقل خاص مريح من الباب إلى الباب من إسطنبول إلى مدن تركية أخرى بسيارات مرسيدس فيتو وسبرينتر.",
      ),
      href: p('/sehirler-arasi-transfer'),
    },
  ];

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
