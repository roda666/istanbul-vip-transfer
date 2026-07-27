import { motion } from 'framer-motion';
import { Users, Luggage, Wifi, Wind, UserCheck, Droplets, Star } from 'lucide-react';
import vitoImage from '@assets/generated_images/mercedes-vito.jpg';
import sprinterImage from '@assets/generated_images/mercedes-sprinter.jpg';

const vehicles = [
  {
    name: 'Mercedes Vito',
    tagline: 'Executive Sınıf',
    image: vitoImage,
    passengers: 7,
    luggage: 7,
    description: 'Küçük gruplar ve aileler için ideal olan Mercedes Vito, üstün konforuyla her yolculuğu ayrıcalıklı kılar.',
    features: [
      { icon: Wifi, label: 'WiFi' },
      { icon: Wind, label: 'İklimlendirme' },
      { icon: UserCheck, label: 'Meet & Greet' },
      { icon: Star, label: 'Deri Koltuklar' },
    ],
    price: 'Fiyat Al',
  },
  {
    name: 'Mercedes Sprinter VIP',
    tagline: 'Prestige Sınıf',
    image: sprinterImage,
    passengers: 13,
    luggage: 13,
    description: 'Büyük gruplar ve kurumsal transferler için VIP Sprinter — geniş iç mekan, tam konfor, lüks donanım.',
    features: [
      { icon: Wifi, label: 'WiFi' },
      { icon: Wind, label: 'İklimlendirme' },
      { icon: UserCheck, label: 'Meet & Greet' },
      { icon: Star, label: 'Lüks Koltuklar' },
      { icon: Droplets, label: 'Su İkramı' },
    ],
    price: 'Fiyat Al',
    featured: true,
  },
];

export default function VehicleFleet() {
  const scrollToBooking = () => {
    document.querySelector('#rezervasyon')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="araclar" className="py-28 relative" style={{ background: '#111111' }} data-testid="vehicles-section">
      {/* Top divider */}
      <div className="gold-divider mb-0" />

      {/* Background decoration */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.3), transparent)' }} />

      <div className="max-w-6xl mx-auto px-5 md:px-8">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          data-testid="vehicles-header"
        >
          <span className="text-xs tracking-[0.3em] uppercase mb-4 block" style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>
            Araç Filosu
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mb-5" style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#FFFFFF' }}>
            Lüks Mercedes Filomuz
          </h2>
          <div className="mx-auto mb-6" style={{ width: '60px', height: '1px', background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }} />
          <p className="text-base max-w-xl mx-auto" style={{ color: '#888', fontFamily: 'Inter, sans-serif' }}>
            Her ihtiyaca özel, en yüksek standartta iki araç seçeneği — her ikisi de tam konforlu.
          </p>
        </motion.div>

        {/* Vehicle Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {vehicles.map((vehicle, i) => (
            <motion.div
              key={vehicle.name}
              className="group relative rounded-xl overflow-hidden cursor-pointer"
              style={{
                background: 'linear-gradient(160deg, #161616 0%, #1A1A1A 100%)',
                border: vehicle.featured ? '1px solid rgba(201, 168, 76, 0.4)' : '1px solid rgba(201, 168, 76, 0.15)',
                boxShadow: vehicle.featured ? '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.1)' : '0 20px 40px rgba(0,0,0,0.4)',
              }}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7, delay: i * 0.15 }}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              data-testid={`vehicle-card-${i}`}
            >
              {/* Gold top accent line */}
              <div
                className="h-[2px] w-full"
                style={{
                  background: vehicle.featured
                    ? 'linear-gradient(90deg, transparent, #E5C36A 30%, #C9A84C 50%, #E5C36A 70%, transparent)'
                    : 'linear-gradient(90deg, transparent, #C9A84C 50%, transparent)',
                }}
              />

              {/* Featured badge */}
              {vehicle.featured && (
                <div
                  className="absolute top-6 right-6 z-10 px-3 py-1 rounded-full text-[10px] tracking-widest uppercase"
                  style={{ background: 'linear-gradient(135deg, #C9A84C, #E5C36A)', color: '#0A0A0A', fontFamily: 'Inter, sans-serif' }}
                >
                  En Popüler
                </div>
              )}

              {/* Vehicle Image */}
              <div className="relative h-56 md:h-64 overflow-hidden" style={{ background: 'linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 100%)' }}>
                <img
                  src={vehicle.image}
                  alt={vehicle.name}
                  className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #161616 0%, transparent 50%)' }} />
              </div>

              {/* Content */}
              <div className="p-7">
                <div className="mb-1">
                  <span className="text-xs tracking-[0.2em] uppercase" style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>{vehicle.tagline}</span>
                </div>
                <h3 className="text-2xl font-bold mb-3" style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#FFFFFF' }}>
                  {vehicle.name}
                </h3>
                <p className="text-sm mb-6 leading-relaxed" style={{ color: '#888', fontFamily: 'Inter, sans-serif' }}>
                  {vehicle.description}
                </p>

                {/* Capacity */}
                <div className="flex items-center gap-6 mb-6 pb-6" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
                  <div className="flex items-center gap-2">
                    <Users size={16} style={{ color: '#C9A84C' }} />
                    <span className="text-sm" style={{ color: '#CCC', fontFamily: 'Inter, sans-serif' }}>
                      <strong style={{ color: '#C9A84C' }}>{vehicle.passengers}</strong> Yolcu
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Luggage size={16} style={{ color: '#C9A84C' }} />
                    <span className="text-sm" style={{ color: '#CCC', fontFamily: 'Inter, sans-serif' }}>
                      <strong style={{ color: '#C9A84C' }}>{vehicle.luggage}</strong> Bagaj
                    </span>
                  </div>
                </div>

                {/* Features */}
                <div className="flex flex-wrap gap-2 mb-8">
                  {vehicle.features.map((feature) => (
                    <div
                      key={feature.label}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded"
                      style={{ background: 'rgba(201, 168, 76, 0.08)', border: '1px solid rgba(201, 168, 76, 0.2)', fontFamily: 'Inter, sans-serif' }}
                    >
                      <feature.icon size={12} style={{ color: '#C9A84C' }} />
                      <span className="text-xs" style={{ color: '#CCC' }}>{feature.label}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button
                  onClick={scrollToBooking}
                  className="w-full py-3.5 rounded text-sm font-semibold tracking-widest uppercase transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                  style={{
                    background: vehicle.featured ? 'linear-gradient(135deg, #C9A84C, #E5C36A)' : 'transparent',
                    border: vehicle.featured ? 'none' : '1px solid rgba(201, 168, 76, 0.4)',
                    color: vehicle.featured ? '#0A0A0A' : '#C9A84C',
                    fontFamily: 'Inter, sans-serif',
                    letterSpacing: '0.1em',
                  }}
                  data-testid={`vehicle-cta-${i}`}
                >
                  Rezervasyon Yap
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
