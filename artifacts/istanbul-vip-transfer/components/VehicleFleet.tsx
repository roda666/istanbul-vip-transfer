'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Users, Luggage, Wifi, Wind, UserCheck, Droplets, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { useHomepageCms } from '@/lib/homepage-cms-context';
import { resolveHomepageCtaAction } from '@/lib/homepage-cta-route';
import { getPublicUiCopy } from '@/lib/i18n/public-ui';
import { isolateLtrValues } from '@/lib/i18n/bidi';
import type { Dictionary } from '@/lib/i18n/types';
import { groupFleetVehicles, normalizeVehicleType, type VehicleType } from '@/lib/vehicle-options';
import { isSuccessfulVehicleResponse } from '@/lib/vehicle-api-contract';

const FEATURE_ICON_MAP: Record<string, React.ElementType> = {
  WIFI:       Wifi,
  CLIMATE:    Wind,
  MEET_GREET: UserCheck,
  LEATHER:    Star,
  LUXURY:     Star,
  WATER:      Droplets,
};

const SAFE_NEUTRAL_FEATURE_LABELS: Record<string, string> = {
  WIFI: 'WiFi',
  MEET_GREET: 'Meet & Greet',
};

const DRAG_START_THRESHOLD_PX = 6;
const DRAG_CLICK_SUPPRESSION_MS = 350;

interface DbVehicle {
  id: number;
  displayName: string;
  displayShortDesc: string;
  displayTagline: string;
  coverImage: string;
  coverImageAlt: string;
  passengerCapacity: number;
  luggageCapacity: number;
  features: Array<{ icon: string; label: string } | string>;
  isFeatured: boolean;
  vehicleType: string | null;
}

interface DisplayVehicle {
  name: string;
  alt: string;
  tagline: string;
  image: string;
  passengers: number;
  passengerCapacity: number;
  luggage: number;
  description: string;
  features: Array<{ icon: React.ElementType; label: string }>;
  featured: boolean;
  vehicleType: string | null;
}

function getFeatureParts(
  feature: DbVehicle['features'][number],
): { code: string; storedLabel?: string } {
  return typeof feature === 'string'
    ? { code: feature }
    : { code: feature.icon, storedLabel: feature.label };
}

function localizeFeatureLabel(
  feature: DbVehicle['features'][number],
  labels: Dictionary['vehicles'],
  lang: string,
): string {
  const { code, storedLabel } = getFeatureParts(feature);
  const localizedLabels: Partial<Record<string, string>> = {
    CLIMATE: labels.featureClimate,
    LEATHER: labels.featureLeather,
    LUXURY: labels.featureLuxury,
    WATER: labels.featureWater,
  };

  // Feature codes are language-neutral; prefer their current-locale labels so
  // legacy Turkish labels stored with vehicles cannot leak into public pages.
  return localizedLabels[code]
    ?? SAFE_NEUTRAL_FEATURE_LABELS[code]
    // Stored feature labels are Turkish source content, so they may only be
    // used on the Turkish page. Other locales receive no unsafe fallback.
    ?? (lang === 'tr' ? storedLabel ?? code : '');
}

function adaptDbVehicle(
  vehicle: DbVehicle,
  labels: Dictionary['vehicles'],
  lang: string,
): DisplayVehicle {
  return {
    name:        vehicle.displayName,
    alt:         vehicle.coverImageAlt,
    tagline:     vehicle.displayTagline,
    image:       vehicle.coverImage,
    passengers:  vehicle.passengerCapacity,
    passengerCapacity: vehicle.passengerCapacity,
    luggage:     vehicle.luggageCapacity,
    description: vehicle.displayShortDesc,
    features:    (vehicle.features ?? []).map(f => ({
      icon:  FEATURE_ICON_MAP[getFeatureParts(f).code] ?? Star,
      label: localizeFeatureLabel(f, labels, lang),
    })),
    featured: vehicle.isFeatured,
    vehicleType: normalizeVehicleType(vehicle.vehicleType),
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
          style={{ color: '#8A651C', fontFamily: 'Inter, sans-serif' }}
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
            <Users size={14} style={{ color: '#8A651C' }} aria-hidden="true" />
            <span className="text-sm" style={{ color: '#263F55', fontFamily: 'Inter, sans-serif' }}>
              <strong dir="ltr" style={{ color: '#8A651C', unicodeBidi: 'isolate' }}>{vehicle.passengers}</strong> {passLabel}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Luggage size={14} style={{ color: '#8A651C' }} aria-hidden="true" />
            <span className="text-sm" style={{ color: '#263F55', fontFamily: 'Inter, sans-serif' }}>
              <strong dir="ltr" style={{ color: '#8A651C', unicodeBidi: 'isolate' }}>{vehicle.luggage}</strong> {lugLabel}
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
              <feature.icon size={11} style={{ color: '#8A651C' }} aria-hidden="true" />
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

export default function VehicleFleet({ homepageMode = false }: { homepageMode?: boolean }) {
  const { dict, lang } = useLang();
  const v = dict.vehicles;
  const cms = useHomepageCms();
  const section = homepageMode ? cms?.vehiclesSection : null;
  const ui = getPublicUiCopy(lang);
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const activePointerId = useRef<number | null>(null);
  const didDrag = useRef(false);
  const suppressClicksUntil = useRef(0);
  const cleanupPointerTracking = useRef<(() => void) | null>(null);

  useEffect(() => () => {
    cleanupPointerTracking.current?.();
  }, []);

  const scrollToBooking = () => {
    const action = resolveHomepageCtaAction(section?.ctaRoute, lang);
    if (action.kind === 'navigate') {
      window.location.assign(action.href);
      return;
    }

    if (action.target === '#rezervasyon') document.dispatchEvent(new Event('ivt:booking-open'));
    document.querySelector(action.target)?.scrollIntoView({ behavior: 'smooth' });
  };

  const [dbVehicles, setDbVehicles] = useState<DisplayVehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [vehiclesError, setVehiclesError] = useState(false);
  const [vehiclesRequest, setVehiclesRequest] = useState(0);

  useEffect(() => {
    let active = true;
    setDbVehicles([]);
    setVehiclesLoading(true);
    setVehiclesError(false);
    fetch(`/data/vehicles?lang=${encodeURIComponent(lang)}`)
      .then(async (response) => {
        if (!isSuccessfulVehicleResponse(response)) throw new Error(`Vehicle request failed (${response.status})`);
        return response.json() as Promise<{ vehicles?: DbVehicle[] }>;
      })
      .then((d: { vehicles?: DbVehicle[] } | null) => {
        if (!active) return;
        if (!d || !Array.isArray(d.vehicles)) {
          setVehiclesError(true);
          return;
        }
        setDbVehicles(d.vehicles.map(vehicle => adaptDbVehicle(vehicle, v, lang)));
      })
      .catch(() => { if (active) setVehiclesError(true); })
      .finally(() => { if (active) setVehiclesLoading(false); });
    return () => { active = false; };
  }, [lang, v, vehiclesRequest]);

  const displayVehicles = dbVehicles;
  const fleetGroups = groupFleetVehicles(displayVehicles);
  const fleetGroupLabels: Record<VehicleType, string> = {
    minivan: 'Minivan',
    minibus: 'Minibüs',
    midibus: 'Midibüs',
    bus: 'Otobüs',
  };

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

  function finishPointerDrag() {
    if (!isDragging.current) return;

    isDragging.current = false;
    activePointerId.current = null;
    if (didDrag.current) {
      // Click follows pointerup in the browser event sequence. Hold a brief,
      // drag-only guard so releasing over a card CTA cannot activate it.
      suppressClicksUntil.current = Date.now() + DRAG_CLICK_SUPPRESSION_MS;
    }
    cleanupPointerTracking.current?.();
    cleanupPointerTracking.current = null;
    if (trackRef.current) trackRef.current.style.cursor = 'grab';
  }

  // Window-level pointer tracking preserves the drag lifecycle after the
  // pointer leaves the track without retargeting a normal CTA click to the
  // track (as element-level pointer capture would). Touch pointers are left to
  // native scrolling so mobile, trackpad and keyboard behaviour stay unchanged.
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;

    const el = e.currentTarget;
    // A new pointer sequence is an intentional fresh interaction, not the
    // synthetic click that follows the previous drag's pointerup.
    suppressClicksUntil.current = 0;
    isDragging.current = true;
    activePointerId.current = e.pointerId;
    didDrag.current = false;
    startX.current = e.clientX;
    scrollLeft.current = el.scrollLeft;
    el.style.cursor = 'grabbing';

    const handlePointerMove = (event: PointerEvent) => {
      if (activePointerId.current !== event.pointerId) return;

      const distance = event.clientX - startX.current;
      if (!didDrag.current && Math.abs(distance) < DRAG_START_THRESHOLD_PX) return;

      didDrag.current = true;
      event.preventDefault();
      el.scrollLeft = scrollLeft.current - distance * 1.5;
    };
    const handlePointerEnd = (event: PointerEvent) => {
      if (activePointerId.current === event.pointerId) finishPointerDrag();
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      window.removeEventListener('blur', finishPointerDrag);
    };

    cleanupPointerTracking.current?.();
    cleanupPointerTracking.current = cleanup;
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    window.addEventListener('blur', finishPointerDrag);
  }

  function suppressClickAfterDrag(e: React.MouseEvent<HTMLDivElement>) {
    if (Date.now() >= suppressClicksUntil.current) return;
    e.preventDefault();
    e.stopPropagation();
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

  if (section && !section.enabled) return null;

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
            style={{ color: '#8A651C', fontFamily: 'Inter, sans-serif' }}
          >
            {v.sectionLabel}
          </span>
          <h2
            className="text-4xl md:text-5xl font-bold mb-5"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}
          >
            {section?.heading ?? v.heading}
          </h2>
          <div
            className="mx-auto mb-6"
            style={{ width: '60px', height: '3px', background: 'linear-gradient(90deg, #C79A35, #E4B84B)', borderRadius: '2px' }}
          />
          <p className="text-base max-w-xl mx-auto" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
            {section?.description ?? v.subheading}
          </p>
        </motion.div>

          {/* Homepage is a compact carousel. The dedicated fleet page keeps
              the same cards but makes the authoritative classes explicit. */}
          {vehiclesLoading && (
            <div role="status" aria-live="polite" aria-label={ui.location.loading} className="flex gap-6 overflow-hidden pb-3">
              <span className="sr-only">{ui.location.loading}</span>
              {[0, 1, 2].map((index) => (
                <div key={index} aria-hidden="true" className="h-[390px] min-w-[320px] animate-pulse rounded-2xl border border-[#D9E2EC] bg-white">
                  <div className="h-[200px] bg-[#EAF2F8]" />
                  <div className="space-y-4 p-6">
                    <div className="h-3 w-1/3 rounded bg-[#EAF2F8]" />
                    <div className="h-6 w-2/3 rounded bg-[#EAF2F8]" />
                    <div className="h-3 w-full rounded bg-[#EAF2F8]" />
                    <div className="h-3 w-4/5 rounded bg-[#EAF2F8]" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {vehiclesError && !vehiclesLoading && (
            <div role="alert" className="rounded-xl border border-[#D9E2EC] bg-white p-6 text-center">
              <p className="mb-4 text-sm" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>{ui.errors.message}</p>
              <button type="button" onClick={() => setVehiclesRequest((request) => request + 1)}
                className="rounded-lg border border-[#102A43] px-4 py-2 text-sm font-semibold"
                style={{ color: '#102A43', fontFamily: 'Inter, sans-serif' }}>
                {ui.errors.retry}
              </button>
            </div>
          )}
          {!vehiclesLoading && !vehiclesError && !homepageMode && fleetGroups.length > 0 && (
            <div className="space-y-10">
              {fleetGroups.map((group) => (
                <div key={group.type}>
                  <h3 className="mb-4 text-xl font-bold" style={{ color: '#102A43', fontFamily: 'Playfair Display, Georgia, serif' }}>
                    {fleetGroupLabels[group.type]}
                  </h3>
                  <div className="flex gap-6 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none' }}>
                    {group.vehicles.map((vehicle, i) => (
                      <VehicleCard key={vehicle.name} vehicle={vehicle} i={i}
                        cta={section?.ctaText ?? v.cta} popular={v.popular}
                        passengers={v.passengers} luggage={v.luggage} lang={lang}
                        scrollToBooking={scrollToBooking} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!vehiclesLoading && !vehiclesError && homepageMode && (
            <div style={{ position: 'relative' }}>
          {/* Nav buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button
              onClick={() => scrollBy('prev')}
              disabled={!canPrev}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#102A43] focus-visible:ring-offset-2"
              style={{ ...NAV_BTN, opacity: canPrev ? 1 : 0.35, color: GOLD }}
              aria-label={ui.vehicles.previous}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => scrollBy('next')}
              disabled={!canNext}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#102A43] focus-visible:ring-offset-2"
              style={{ ...NAV_BTN, opacity: canNext ? 1 : 0.35, color: GOLD }}
              aria-label={ui.vehicles.next}
            >
              <ChevronRight size={18} />
            </button>
            </div>

          {/* Scrollable track */}
          <div
            ref={trackRef}
            onPointerDown={onPointerDown}
            onClickCapture={suppressClickAfterDrag}
            onDragStart={e => e.preventDefault()}
            data-testid="vehicle-track"
            style={{
              display: 'flex',
              gap: '24px',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              paddingBottom: '12px',
              cursor: 'grab',
              userSelect: 'none',
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
                cta={section?.ctaText ?? v.cta}
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
                aria-label={ui.vehicles.slide(i + 1)}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#102A43] focus-visible:ring-offset-2"
                style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  background: `radial-gradient(circle, ${GOLD} 0 4px, transparent 5px)`, border: 'none', cursor: 'pointer',
                  opacity: 0.3, padding: 0,
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.3'; }}
              />
            ))}
          </div>
            </div>
          )}
        </div>

      {/* Hide scrollbar in WebKit browsers */}
      <style>{`
        #araclar [style*="overflow-x"]::-webkit-scrollbar { display: none; }
      `}</style>
    </section>
  );
}
