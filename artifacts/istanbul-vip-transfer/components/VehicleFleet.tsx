'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Users, Luggage, Wifi, Wind, UserCheck, Droplets, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { isolateLtrValues } from '@/lib/i18n/bidi';

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

/** Single vehicle card (extracted for carousel use) */
function VehicleCard({ vehicle, i, cta, popular, passengers: passLabel, luggage: lugLabel, lang, scrollToBooking }: {
  vehicle: DisplayVehicle;
  i: number;
  cta: string;
  popular: string;
  passengers: string;
  luggage: string;
  lang: string;
  scrollToBooking: () => void;
}) {
  return (
    <motion.div
      className="group relative rounded-2xl overflow-hidden"
      style={{
        background: '#FFFFFF',
        border: vehicle.featured ? '1px solid rgba(199,154,53,0.5)' : '1px solid #D9E2EC',
        boxShadow: vehicle.featured
          ? '0 8px 40px rgba(16,42,67,0.1)'
          : '0 4px 24px rgba(16,42,67,0.07)',
        minWidth: '320px',
        width: '320px',
        flexShrink: 0,
        scrollSnapAlign: 'start',
      }}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: Math.min(i * 0.08, 0.4) }}
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
          {popular}
        </div>
      )}

      {/* Vehicle Image */}
      <div className="relative overflow-hidden" style={{ height: '200px', background: '#EAF2F8' }}>
        <Image
          src={vehicle.image}
          alt={vehicle.alt}
          fill
          className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
          sizes="320px"
        />
        <div
          className="absolute inset-x-0 bottom-0 h-16"
          style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.4) 0%, transparent 100%)' }}
          aria-hidden="true"
        />
      </div>

      {/* Content */}
      <div className="p-6">
        <span
          className="text-xs tracking-[0.2em] uppercase font-semibold block mb-1"
          style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}
        >
          {isolateLtrValues(vehicle.tagline, lang)}
        </span>
        <h3
          className="text-xl font-bold mb-2"
          style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}
        >
          {isolateLtrValues(vehicle.name, lang)}
        </h3>
        <p className="text-sm mb-4 leading-relaxed" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
          {isolateLtrValues(vehicle.description, lang)}
        </p>

        {/* Capacity */}
        <div
          className="flex items-center gap-5 mb-4 pb-4"
          style={{ borderBottom: '1px solid #D9E2EC' }}
        >
          <div className="flex items-center gap-1.5">
            <Users size={14} style={{ color: '#C99A32' }} aria-hidden="true" />
            <span className="text-sm" style={{ color: '#263F55', fontFamily: 'Inter, sans-serif' }}>
              <strong dir="ltr" style={{ color: '#C99A32', unicodeBidi: 'isolate' }}>{vehicle.passengers}</strong> {passLabel}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Luggage size={14} style={{ color: '#C99A32' }} aria-hidden="true" />
            <span className="text-sm" style={{ color: '#263F55', fontFamily: 'Inter, sans-serif' }}>
              <strong dir="ltr" style={{ color: '#C99A32', unicodeBidi: 'isolate' }}>{vehicle.luggage}</strong> {lugLabel}
            </span>
          </div>
        </div>

        {/* Features */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {vehicle.features.map((feature) => (
            <div
              key={feature.label}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
              style={{
                background: 'rgba(199,154,53,0.08)',
                border: '1px solid rgba(199,154,53,0.2)',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              <feature.icon size={11} style={{ color: '#C79A35' }} aria-hidden="true" />
              <span className="text-xs" style={{ color: '#263F55' }}>{isolateLtrValues(feature.label, lang)}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={scrollToBooking}
          className="w-full py-3 rounded-xl text-sm font-semibold tracking-wider uppercase transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            background: vehicle.featured ? '#C79A35' : 'transparent',
            border: vehicle.featured ? 'none' : '1.5px solid #102A43',
            color: '#102A43',
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
          {cta}
        </button>
      </div>
    </motion.div>
  );
}

export default function VehicleFleet() {
  const { dict, lang } = useLang();
  const v = dict.vehicles;
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

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

  // Update prev/next button state on scroll
  function updateScrollState() {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    updateScrollState();
    return () => el.removeEventListener('scroll', updateScrollState);
  }, [displayVehicles]);

  function scrollBy(dir: 'prev' | 'next') {
    const el = trackRef.current;
    if (!el) return;
    const cardWidth = 320 + 24; // card min-width + gap
    el.scrollBy({ left: dir === 'next' ? cardWidth : -cardWidth, behavior: 'smooth' });
  }

  // Mouse drag support (desktop)
  function onMouseDown(e: React.MouseEvent) {
    isDragging.current = true;
    startX.current = e.pageX - (trackRef.current?.offsetLeft ?? 0);
    scrollLeft.current = trackRef.current?.scrollLeft ?? 0;
    if (trackRef.current) trackRef.current.style.cursor = 'grabbing';
  }
  function onMouseUp() {
    isDragging.current = false;
    if (trackRef.current) trackRef.current.style.cursor = 'grab';
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!isDragging.current || !trackRef.current) return;
    e.preventDefault();
    const x = e.pageX - trackRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    trackRef.current.scrollLeft = scrollLeft.current - walk;
  }

  const GOLD = '#C79A35';
  const NAV_BTN: React.CSSProperties = {
    width: '40px', height: '40px', borderRadius: '50%',
    border: `1px solid rgba(199,154,53,0.4)`,
    background: 'rgba(255,255,255,0.95)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(16,42,67,0.12)',
    transition: 'all 0.2s',
    flexShrink: 0,
  };

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
          className="text-center mb-12"
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

        {/* Carousel */}
        <div style={{ position: 'relative' }}>
          {/* Nav buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button
              onClick={() => scrollBy('prev')}
              disabled={!canPrev}
              style={{ ...NAV_BTN, opacity: canPrev ? 1 : 0.35, color: GOLD }}
              aria-label="Önceki araç"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => scrollBy('next')}
              disabled={!canNext}
              style={{ ...NAV_BTN, opacity: canNext ? 1 : 0.35, color: GOLD }}
              aria-label="Sonraki araç"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Scrollable track */}
          <div
            ref={trackRef}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onMouseMove={onMouseMove}
            style={{
              display: 'flex',
              gap: '24px',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              paddingBottom: '12px',
              cursor: 'grab',
              /* Hide scrollbar visually but keep function */
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            } as React.CSSProperties}
          >
            {displayVehicles.map((vehicle, i) => (
              <VehicleCard
                key={vehicle.name}
                vehicle={vehicle}
                i={i}
                cta={v.cta}
                popular={v.popular}
                passengers={v.passengers}
                luggage={v.luggage}
                lang={lang}
                scrollToBooking={scrollToBooking}
              />
            ))}
          </div>

          {/* Dot indicators */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '16px' }}>
            {displayVehicles.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  const el = trackRef.current;
                  if (!el) return;
                  el.scrollTo({ left: i * (320 + 24), behavior: 'smooth' });
                }}
                aria-label={`Araç ${i + 1}`}
                style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: GOLD, border: 'none', cursor: 'pointer',
                  opacity: 0.3, padding: 0,
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.3'; }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Hide scrollbar in WebKit browsers */}
      <style>{`
        #araclar [style*="overflow-x"]::-webkit-scrollbar { display: none; }
      `}</style>
    </section>
  );
}
