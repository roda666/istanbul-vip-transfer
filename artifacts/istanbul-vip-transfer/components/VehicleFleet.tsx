'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Users, Luggage, Wifi, Wind, UserCheck, Droplets, Star } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';

const FEATURE_ICON_MAP: Record<string, React.ElementType> = {
  WIFI:       Wifi,
  CLIMATE:    Wind,
  MEET_GREET: UserCheck,
  LEATHER:    Star,
  LUXURY:     Star,
  WATER:      Droplets,
};

interface DbVehicle {
  id: number;
  displayName: string;
  displayShortDesc: string;
  displayTagline: string;
  coverImage: string | null;
  coverImageAlt: string | null;
  passengerCapacity: number;
  luggageCapacity: number;
  features: Array<{ icon: string; label: string }>;
  isFeatured: boolean;
}

interface DisplayVehicle {
  name: string;
  alt: string;
  tagline: string;
  image: string;
  passengers: number;
  luggage: number;
  description: string;
  features: Array<{ icon: React.ElementType; label: string }>;
  featured: boolean;
}

function adaptDbVehicle(vehicle: DbVehicle): DisplayVehicle {
  return {
    name:        vehicle.displayName,
    alt:         vehicle.coverImageAlt ?? vehicle.displayName,
    tagline:     vehicle.displayTagline,
    image:       vehicle.coverImage ?? '/images/mercedes-vito.jpg',
    passengers:  vehicle.passengerCapacity,
    luggage:     vehicle.luggageCapacity,
    description: vehicle.displayShortDesc,
    features:    (vehicle.features ?? []).map(f => ({
      icon:  FEATURE_ICON_MAP[f.icon] ?? Star,
      label: f.label,
    })),
    featured: vehicle.isFeatured,
  };
}

export default function VehicleFleet() {
  const { dict } = useLang();
  const v = dict.vehicles;

  const scrollToBooking = () => {
    document.querySelector('#rezervasyon')?.scrollIntoView({ behavior: 'smooth' });
  };

  const staticVehicles: DisplayVehicle[] = [
    {
      name: 'Mercedes Vito',
      alt: v.vitoAlt,
      tagline: v.vitoTagline,
      image: '/images/mercedes-vito.jpg',
      passengers: 7,
      luggage: 7,
      description: v.vitoDesc,
      features: [
        { icon: Wifi,      label: 'WiFi' },
        { icon: Wind,      label: v.featureClimate },
        { icon: UserCheck, label: 'Meet & Greet' },
        { icon: Star,      label: v.featureLeather },
      ],
      featured: false,
    },
    {
      name: 'Mercedes Sprinter VIP',
      alt: v.sprinterAlt,
      tagline: v.sprinterTagline,
      image: '/images/mercedes-sprinter.jpg',
      passengers: 13,
      luggage: 13,
      description: v.sprinterDesc,
      features: [
        { icon: Wifi,      label: 'WiFi' },
        { icon: Wind,      label: v.featureClimate },
        { icon: UserCheck, label: 'Meet & Greet' },
        { icon: Star,      label: v.featureLuxury },
        { icon: Droplets,  label: v.featureWater },
      ],
      featured: true,
    },
  ];

  const [dbVehicles, setDbVehicles] = useState<DisplayVehicle[] | null>(null);

  useEffect(() => {
    const lang = (typeof document !== 'undefined' && document.documentElement.lang) || 'tr';
    fetch(`/data/vehicles?lang=${lang}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { vehicles?: DbVehicle[] } | null) => {
        if (d?.vehicles?.length) {
          setDbVehicles(d.vehicles.map(adaptDbVehicle));
        }
      })
      .catch(() => {});
  }, []);

  const displayVehicles: DisplayVehicle[] = dbVehicles ?? staticVehicles;

  return (
    <section
      id="araclar"
      className="py-24 relative"
      style={{ background: '#F7F8FC' }}
      data-testid="vehicles-section"
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: '#D9E2EC' }} aria-hidden="true" />
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        {/* Section Header */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          data-testid="vehicles-header"
        >
          <span
            className="text-xs tracking-[0.3em] uppercase mb-4 block"
            style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}
          >
            {v.sectionLabel}
          </span>
          <h2
            className="text-4xl md:text-5xl font-bold mb-5"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}
          >
            {v.heading}
          </h2>
          <div
            className="mx-auto mb-6"
            style={{ width: '60px', height: '3px', background: 'linear-gradient(90deg, #C79A35, #E4B84B)', borderRadius: '2px' }}
          />
          <p className="text-base max-w-xl mx-auto" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
            {v.subheading}
          </p>
        </motion.div>

        {/* Vehicle Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
          {displayVehicles.map((vehicle, i) => (
            <motion.div
              key={vehicle.name}
              className="group relative rounded-2xl overflow-hidden"
              style={{
                background: '#FFFFFF',
                border: vehicle.featured ? '1px solid rgba(199,154,53,0.5)' : '1px solid #D9E2EC',
                boxShadow: vehicle.featured
                  ? '0 8px 40px rgba(16,42,67,0.1)'
                  : '0 4px 24px rgba(16,42,67,0.07)',
              }}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7, delay: i * 0.15 }}
              whileHover={{ y: -6, boxShadow: '0 16px 56px rgba(16,42,67,0.13)', transition: { duration: 0.3 } }}
              data-testid={`vehicle-card-${i}`}
            >
              {/* Top accent bar */}
              <div
                className="h-[3px] w-full"
                style={{
                  background: vehicle.featured
                    ? 'linear-gradient(90deg, transparent, #E4B84B 30%, #C79A35 50%, #E4B84B 70%, transparent)'
                    : 'linear-gradient(90deg, transparent, #C79A35 50%, transparent)',
                }}
                aria-hidden="true"
              />
              {vehicle.featured && (
                <div
                  className="absolute top-6 right-6 z-10 px-3 py-1 rounded-full text-[10px] tracking-widest uppercase font-semibold"
                  style={{ background: '#C79A35', color: '#102A43', fontFamily: 'Inter, sans-serif' }}
                >
                  {v.popular}
                </div>
              )}

              {/* Vehicle Image */}
              <div
                className="relative h-56 md:h-64 overflow-hidden"
                style={{ background: '#EAF2F8' }}
              >
                <Image
                  src={vehicle.image}
                  alt={vehicle.alt}
                  fill
                  className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div
                  className="absolute inset-x-0 bottom-0 h-16"
                  style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.4) 0%, transparent 100%)' }}
                  aria-hidden="true"
                />
              </div>

              {/* Content */}
              <div className="p-7">
                <div className="mb-1">
                  <span
                    className="text-xs tracking-[0.2em] uppercase font-semibold"
                    style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}
                  >
                    {vehicle.tagline}
                  </span>
                </div>
                <h3
                  className="text-2xl font-bold mb-3"
                  style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}
                >
                  {vehicle.name}
                </h3>
                <p className="text-sm mb-5 leading-relaxed" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
                  {vehicle.description}
                </p>

                {/* Capacity */}
                <div
                  className="flex items-center gap-6 mb-5 pb-5"
                  style={{ borderBottom: '1px solid #D9E2EC' }}
                >
                  <div className="flex items-center gap-2">
                    <Users size={16} style={{ color: '#C99A32' }} aria-hidden="true" />
                    <span className="text-sm" style={{ color: '#263F55', fontFamily: 'Inter, sans-serif' }}>
                      <strong style={{ color: '#C99A32' }}>{vehicle.passengers}</strong> {v.passengers}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Luggage size={16} style={{ color: '#C99A32' }} aria-hidden="true" />
                    <span className="text-sm" style={{ color: '#263F55', fontFamily: 'Inter, sans-serif' }}>
                      <strong style={{ color: '#C99A32' }}>{vehicle.luggage}</strong> {v.luggage}
                    </span>
                  </div>
                </div>

                {/* Features */}
                <div className="flex flex-wrap gap-2 mb-7">
                  {vehicle.features.map((feature) => (
                    <div
                      key={feature.label}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                      style={{
                        background: 'rgba(199,154,53,0.08)',
                        border: '1px solid rgba(199,154,53,0.2)',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      <feature.icon size={12} style={{ color: '#C79A35' }} aria-hidden="true" />
                      <span className="text-xs" style={{ color: '#263F55' }}>{feature.label}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button
                  onClick={scrollToBooking}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold tracking-wider uppercase transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{
                    background: vehicle.featured ? '#C79A35' : 'transparent',
                    border: vehicle.featured ? 'none' : '1.5px solid #102A43',
                    color: vehicle.featured ? '#102A43' : '#102A43',
                    fontFamily: 'Inter, sans-serif',
                    letterSpacing: '0.08em',
                  }}
                  onMouseEnter={(e) => {
                    if (!vehicle.featured) {
                      (e.currentTarget as HTMLButtonElement).style.background = '#102A43';
                      (e.currentTarget as HTMLButtonElement).style.color = '#FFFFFF';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!vehicle.featured) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      (e.currentTarget as HTMLButtonElement).style.color = '#102A43';
                    }
                  }}
                  data-testid={`vehicle-cta-${i}`}
                >
                  {v.cta}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
