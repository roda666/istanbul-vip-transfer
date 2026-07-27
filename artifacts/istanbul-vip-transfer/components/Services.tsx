'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Plane, Hotel, Map, Briefcase, PartyPopper, Route, ArrowRight } from 'lucide-react';

const services = [
  {
    icon: Plane,
    title: 'Havalimanı Transferi',
    description: 'İstanbul Havalimanı (IST) ve Sabiha Gökçen (SAW) transferleri için rezervasyon alıyoruz.',
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
    <section id="hizmetler" className="py-28 relative" style={{ background: '#0A0A0A' }} data-testid="services-section">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          data-testid="services-header"
        >
          <span className="text-xs tracking-[0.3em] uppercase mb-4 block" style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>
            Hizmetlerimiz
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mb-5" style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#FFFFFF' }}>
            Her İhtiyaca Uygun Transfer
          </h2>
          <div className="mx-auto mb-6" style={{ width: '60px', height: '1px', background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }} />
          <p className="text-base max-w-xl mx-auto" style={{ color: '#888', fontFamily: 'Inter, sans-serif' }}>
            Bireysel ya da kurumsal — tüm transfer ihtiyaçlarınız için kapsamlı VIP hizmet.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((service, i) => {
            const card = (
              <motion.div
                key={service.title}
                className="group relative p-8 rounded-xl overflow-hidden cursor-pointer transition-all duration-500 h-full"
                style={{
                  background: 'linear-gradient(160deg, #161616 0%, #1A1A1A 100%)',
                  border: '1px solid rgba(201,168,76,0.12)',
                }}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.6, delay: (i % 3) * 0.1 }}
                whileHover={{ y: -4, borderColor: 'rgba(201,168,76,0.35)', transition: { duration: 0.3 } }}
                data-testid={`service-card-${i}`}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: 'radial-gradient(ellipse at top left, rgba(201,168,76,0.06) 0%, transparent 70%)' }} />
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center mb-6 transition-all duration-300 group-hover:scale-110"
                  style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.05))', border: '1px solid rgba(201,168,76,0.25)' }}
                >
                  <service.icon size={22} style={{ color: '#C9A84C' }} />
                </div>
                <h3 className="text-xl font-semibold mb-3 transition-colors duration-300 group-hover:text-[#E5C36A]"
                  style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#FFFFFF' }}>
                  {service.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: '#888', fontFamily: 'Inter, sans-serif' }}>
                  {service.description}
                </p>
                {'href' in service && (
                  <div className="flex items-center gap-1.5 mt-5 text-xs font-semibold tracking-widest uppercase transition-colors duration-300 group-hover:text-[#E5C36A]"
                    style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>
                    Detaylar
                    <ArrowRight size={12} className="transition-transform duration-300 group-hover:translate-x-1" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 h-[1px] w-0 group-hover:w-full transition-all duration-500"
                  style={{ background: 'linear-gradient(90deg, #C9A84C, transparent)' }} />
              </motion.div>
            );
            return 'href' in service ? (
              <Link key={service.title} href={service.href!} className="block">
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
