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
    <section id="hakkimizda" className="py-28 relative" style={{ background: '#111111' }} data-testid="trust-section">
      <div className="gold-divider absolute top-0 left-0 right-0" />

      {/* Background radial */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, rgba(201, 168, 76, 0.04) 0%, transparent 70%)' }}
      />

      <div className="max-w-6xl mx-auto px-5 md:px-8">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          data-testid="trust-header"
        >
          <span className="text-xs tracking-[0.3em] uppercase mb-4 block" style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>
            Neden Biz
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mb-5" style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#FFFFFF' }}>
            Hizmet Anlayışımız
          </h2>
          <div className="mx-auto" style={{ width: '60px', height: '1px', background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }} />
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="relative text-center p-8 rounded-xl overflow-hidden group"
              style={{
                background: 'linear-gradient(160deg, #161616 0%, #1A1A1A 100%)',
                border: '1px solid rgba(201, 168, 76, 0.15)',
              }}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, delay: i * 0.12 }}
              data-testid={`trust-card-${i}`}
            >
              {/* Gold top border */}
              <div className="absolute top-0 left-4 right-4 h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }} />

              {/* Icon */}
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: 'rgba(201, 168, 76, 0.1)', border: '1px solid rgba(201, 168, 76, 0.25)' }}
              >
                <stat.icon size={24} style={{ color: '#C9A84C' }} />
              </div>

              {/* Number */}
              <div
                className="text-4xl md:text-5xl font-bold mb-1"
                style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#C9A84C', lineHeight: 1 }}
                data-testid={`trust-number-${i}`}
              >
                {stat.number}
              </div>

              {/* Label */}
              <div
                className="text-xs tracking-[0.2em] uppercase mb-4"
                style={{ color: '#E5E5E5', fontFamily: 'Inter, sans-serif' }}
              >
                {stat.label}
              </div>

              {/* Description */}
              <p className="text-sm leading-relaxed" style={{ color: '#666', fontFamily: 'Inter, sans-serif' }}>
                {stat.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
