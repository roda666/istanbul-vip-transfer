'use client';

import { motion } from 'framer-motion';
import { Clock, Plane, Car, User } from 'lucide-react';

const stats = [
  {
    icon: Clock,
    number: '7/24',
    label: 'Rezervasyon Desteği',
    description: 'Her saat, her gün. Geç gece varışı veya sabah erken uçuş olsun — WhatsApp ile ulaşabilirsiniz.',
  },
  {
    icon: Plane,
    number: 'IST & SAW',
    label: 'Havalimanı Transferi',
    description: 'İstanbul Havalimanı (IST) ve Sabiha Gökçen Havalimanı (SAW) için transfer rezervasyonu alıyoruz.',
  },
  {
    icon: Car,
    number: 'Vito & Sprinter',
    label: 'VIP Araç Seçenekleri',
    description: 'Mercedes Vito ve Mercedes Sprinter VIP ile bireysel ve grup transferleri düzenliyoruz.',
  },
  {
    icon: User,
    number: 'Meet & Greet',
    label: 'Karşılama Hizmeti',
    description: 'Sürücünüz isim tabelasıyla karşılar, bagajlarınıza yardımcı olur ve sizi hedefinize ulaştırır.',
  },
];

export default function TrustSignals() {
  return (
    <section
      id="hakkimizda"
      className="py-24 relative"
      style={{ background: '#EAF2F8' }}
      data-testid="trust-section"
    >
      {/* Top border */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: '#D9E2EC' }} aria-hidden="true" />

      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          data-testid="trust-header"
        >
          <span
            className="text-xs tracking-[0.3em] uppercase mb-4 block"
            style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}
          >
            Neden Biz
          </span>
          <h2
            className="text-4xl md:text-5xl font-bold mb-5"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}
          >
            Hizmet Anlayışımız
          </h2>
          <div
            className="mx-auto"
            style={{ width: '60px', height: '3px', background: 'linear-gradient(90deg, #C79A35, #E4B84B)', borderRadius: '2px' }}
          />
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="relative text-center p-8 rounded-2xl overflow-hidden group"
              style={{
                background: '#FFFFFF',
                border: '1px solid #D9E2EC',
                boxShadow: '0 2px 16px rgba(16,42,67,0.06)',
                transition: 'box-shadow 0.25s, transform 0.25s',
              }}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, delay: i * 0.12 }}
              whileHover={{ y: -4, boxShadow: '0 8px 32px rgba(16,42,67,0.12)' }}
              data-testid={`trust-card-${i}`}
            >
              {/* Top gold accent */}
              <div
                className="absolute top-0 left-6 right-6 h-[2px]"
                style={{ background: 'linear-gradient(90deg, transparent, #C79A35, transparent)' }}
                aria-hidden="true"
              />
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: 'rgba(199,154,53,0.1)', border: '1px solid rgba(199,154,53,0.25)' }}
              >
                <stat.icon size={24} style={{ color: '#C79A35' }} aria-hidden="true" />
              </div>
              <div
                className="text-3xl md:text-4xl font-bold mb-1"
                style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#C79A35', lineHeight: 1 }}
                data-testid={`trust-number-${i}`}
              >
                {stat.number}
              </div>
              <div
                className="text-xs tracking-[0.2em] uppercase mb-3"
                style={{ color: '#102A43', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}
              >
                {stat.label}
              </div>
              <p className="text-sm leading-relaxed" style={{ color: '#627D98', fontFamily: 'Inter, sans-serif' }}>
                {stat.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
