'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Plane, Hotel, Map, Briefcase, PartyPopper, Route, ArrowRight } from 'lucide-react';

const services = [
  {
    icon: Plane,
    title: 'İstanbul Havalimanı (IST) Transfer',
    description: 'İstanbul Havalimanı\'ndan her destinasyona Mercedes Vito ve Sprinter ile profesyonel karşılama ve transfer.',
    href: '/istanbul-havalimani-transfer',
  },
  {
    icon: Plane,
    title: 'Sabiha Gökçen (SAW) Transfer',
    description: 'Sabiha Gökçen Havalimanı\'ndan İstanbul\'un her noktasına Mercedes Vito ve Sprinter ile VIP transfer.',
    href: '/sabiha-gokcen-havalimani-transfer',
  },
  {
    icon: Hotel,
    title: 'Otel Transferi',
    description: 'İstanbul\'un tüm otellerinden kapıdan kapıya sorunsuz transfer hizmeti.',
  },
  {
    icon: Map,
    title: 'Şehir Turu',
    description: 'İstanbul\'un tarihi ve modern güzelliklerini özel şoförlü aracınızla keşfedin.',
  },
  {
    icon: Briefcase,
    title: 'Kurumsal Transfer',
    description: 'İş toplantıları, konferanslar ve kurumsal etkinlikler için güvenilir ve temsili transfer.',
  },
  {
    icon: PartyPopper,
    title: 'Özel Etkinlik Transferi',
    description: 'Düğün, gala ve özel davetler için lüks araç kiralama ve konvoy hizmeti.',
  },
  {
    icon: Route,
    title: 'Şehirler Arası Transfer',
    description: 'İstanbul\'dan Türkiye\'nin farklı şehirlerine Mercedes Vito ve Sprinter araçlarla konforlu, kapıdan kapıya özel transfer.',
    href: '/sehirler-arasi-transfer',
  },
];

export default function Services() {
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
            Hizmetlerimiz
          </span>
          <h2
            className="text-4xl md:text-5xl font-bold mb-5"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}
          >
            Her İhtiyaca Uygun Transfer
          </h2>
          <div
            className="mx-auto mb-6"
            style={{ width: '60px', height: '3px', background: 'linear-gradient(90deg, #C79A35, #E4B84B)', borderRadius: '2px' }}
          />
          <p className="text-base max-w-xl mx-auto" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
            Bireysel ya da kurumsal — tüm transfer ihtiyaçlarınız için kapsamlı VIP hizmet.
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
                    Detaylar
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
