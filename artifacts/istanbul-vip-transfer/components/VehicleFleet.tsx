'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Users, Luggage, Wifi, Wind, UserCheck, Droplets, Star } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { useHomepageCms } from '@/lib/homepage-cms-context';
import { resolveHomepageCtaAction } from '@/lib/homepage-cta-route';
import { getPublicUiCopy } from '@/lib/i18n/public-ui';
import { isolateLtrValues } from '@/lib/i18n/bidi';
import type { Dictionary } from '@/lib/i18n/types';
import { isSuccessfulVehicleResponse } from '@/lib/vehicle-api-contract';
import CardCarouselStrip from '@/components/CardCarouselStrip';

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
    ?? (code.startsWith('CUSTOM_') ? storedLabel : undefined)
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
    features:    (vehicle.features ?? [])
      .map(f => ({
        icon:  FEATURE_ICON_MAP[getFeatureParts(f).code] ?? Star,
        label: localizeFeatureLabel(f, labels, lang),
      }))
      .filter(feature => feature.label.trim().length > 0),
    featured: vehicle.isFeatured,
  };
}

/** Shared vehicle card used by the homepage, service pages, and fleet grid. */
function VehicleCard({ vehicle, i, cta, popular, passengers: passLabel, luggage: lugLabel, lang, scrollToBooking, layout }: {
  vehicle: DisplayVehicle;
  i: number;
  cta: string;
  popular: string;
  passengers: string;
  luggage: string;
  lang: string;
  scrollToBooking: () => void;
  layout: 'grid' | 'carousel';
}) {
  const [imageFailed, setImageFailed] = useState(!vehicle.image);
  const compact = layout === 'carousel';

  return (
    <motion.div
      className={`ivt-vehicle-card group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl ${layout === 'carousel' ? 'ivt-card-strip-item' : ''}`}
      style={{
        background: '#FFFFFF',
        border: vehicle.featured ? '1px solid rgba(199,154,53,0.5)' : '1px solid #D9E2EC',
        boxShadow: vehicle.featured
          ? '0 8px 40px rgba(16,42,67,0.1)'
          : '0 4px 24px rgba(16,42,67,0.07)',
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
      <div
        className="relative aspect-[4/3] shrink-0 overflow-hidden"
        style={{ background: '#EAF2F8' }}
        data-testid={`vehicle-image-frame-${i}`}
      >
        {imageFailed ? (
          <div
            className="flex h-full w-full items-center justify-center px-4 text-center text-sm"
            style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
            role="img"
            aria-label={`${vehicle.name}: Görseli eksik`}
            data-testid={`vehicle-image-missing-${i}`}
          >
            Görseli eksik
          </div>
        ) : (
          <Image
            src={vehicle.image}
            alt={vehicle.alt || vehicle.name}
            width={1200}
            height={900}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
            sizes="(min-width: 1200px) 25vw, (min-width: 900px) 33vw, (min-width: 480px) 50vw, 100vw"
            data-testid={`vehicle-image-${i}`}
          />
        )}
        <div
          className="absolute inset-x-0 bottom-0 h-16"
          style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.4) 0%, transparent 100%)' }}
          aria-hidden="true"
        />
      </div>

      {/* Content */}
      <div className={`flex flex-1 flex-col ${compact ? 'p-4 sm:p-[18px]' : 'p-5 sm:p-6'}`}>
        <span
          className={`${compact ? 'mb-1 text-[10px] leading-[1.4] sm:text-[11px]' : 'mb-2 min-h-[36px] text-[11px] leading-[1.45] sm:text-xs'} block break-words font-semibold uppercase tracking-[0.14em] sm:tracking-[0.16em]`}
          style={{ color: '#8A651C', fontFamily: 'Inter, sans-serif' }}
          data-testid={`vehicle-tagline-${i}`}
        >
          {isolateLtrValues(vehicle.tagline, lang)}
        </span>
        <h3
          className={`${compact ? 'mb-1.5 text-[clamp(0.98rem,1.3vw,1.12rem)] leading-[1.28]' : 'mb-2 min-h-[58px] text-[clamp(1rem,1.45vw,1.2rem)] leading-[1.35]'} break-words font-bold`}
          style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}
          data-testid={`vehicle-name-${i}`}
        >
          {isolateLtrValues(vehicle.name, lang)}
        </h3>
        <p
          className={`${compact ? 'mb-3 text-[11.5px] leading-[1.5] sm:text-xs lg:text-[13px]' : 'mb-4 min-h-[126px] text-[12px] leading-[1.65] sm:text-[13px] lg:text-sm'} break-words`}
          style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
          data-testid={`vehicle-description-${i}`}
        >
          {isolateLtrValues(vehicle.description, lang)}
        </p>

        {/* Capacity */}
        <div
          className={`${compact ? 'mb-3 mt-auto gap-x-3 gap-y-1.5 pb-3' : 'mb-4 min-h-[44px] gap-x-5 gap-y-2 pb-4'} flex shrink-0 flex-wrap items-start border-b border-[#D9E2EC]`}
          data-testid={`vehicle-capacity-${i}`}
        >
          <div className="flex items-center gap-1.5">
            <Users size={14} style={{ color: '#8A651C' }} aria-hidden="true" />
            <span className={compact ? 'text-xs' : 'text-sm'} style={{ color: '#263F55', fontFamily: 'Inter, sans-serif' }}>
              <strong dir="ltr" style={{ color: '#8A651C', unicodeBidi: 'isolate' }}>{vehicle.passengers}</strong> {passLabel}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Luggage size={14} style={{ color: '#8A651C' }} aria-hidden="true" />
            <span className={compact ? 'text-xs' : 'text-sm'} style={{ color: '#263F55', fontFamily: 'Inter, sans-serif' }}>
              <strong dir="ltr" style={{ color: '#8A651C', unicodeBidi: 'isolate' }}>{vehicle.luggage}</strong> {lugLabel}
            </span>
          </div>
        </div>

        {/* Features */}
        <div
          className={compact
            ? 'mb-3 grid shrink-0 grid-cols-2 content-start gap-1.5'
            : 'mb-5 flex min-h-[112px] shrink-0 flex-wrap content-start items-start gap-1.5'}
          data-testid={`vehicle-features-${i}`}
        >
          {vehicle.features.map((feature) => (
            <div
              key={feature.label}
              className={`flex min-w-0 items-start gap-1 rounded-lg ${compact ? 'px-2 py-1' : 'px-2.5 py-1'}`}
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
          className="flex h-12 w-full shrink-0 items-center justify-center rounded-xl text-sm font-semibold uppercase tracking-wider transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
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
          style={{
            background: vehicle.featured ? '#C79A35' : 'transparent',
            border: vehicle.featured ? 'none' : '1.5px solid #102A43',
            color: '#102A43',
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.08em',
            marginTop: 'auto',
          }}
          data-testid={`vehicle-cta-${i}`}
        >
          {cta}
        </button>
      </div>
    </motion.div>
  );
}

export default function VehicleFleet({
  homepageMode = false,
  layout = homepageMode ? 'carousel' : 'grid',
}: {
  homepageMode?: boolean;
  layout?: 'grid' | 'carousel';
}) {
  const { dict, lang } = useLang();
  const v = dict.vehicles;
  const cms = useHomepageCms();
  const section = homepageMode ? cms?.vehiclesSection : null;
  const ui = getPublicUiCopy(lang);

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
  if (section && !section.enabled) return null;

  return (
    <section
      id="araclar"
      className="relative py-16 md:py-20"
      style={{ background: '#F7F8FC' }}
      data-testid="vehicles-section"
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: '#D9E2EC' }} aria-hidden="true" />
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        {/* Section Header */}
        <motion.div
          className="mb-8 text-center md:mb-10"
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

           {/* Homepage and service pages use a compact carousel. The dedicated
               fleet page is a comparison grid so every vehicle is visible
               without horizontal scrolling. */}
          {vehiclesLoading && (
            <div
              role="status"
              aria-live="polite"
              aria-label={ui.location.loading}
               className={layout === 'grid'
                ? 'ivt-vehicle-grid grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3'
                : 'flex gap-6 overflow-hidden pb-3'}
            >
              <span className="sr-only">{ui.location.loading}</span>
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  aria-hidden="true"
                  className={`h-[390px] animate-pulse rounded-2xl border border-[#D9E2EC] bg-white ${layout === 'carousel' ? 'min-w-[320px]' : 'min-w-0'}`}
                >
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
           {!vehiclesLoading && !vehiclesError && layout === 'grid' && displayVehicles.length > 0 && (
             <div
               className="ivt-vehicle-grid grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3"
               data-testid="vehicles-grid"
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
                   layout="grid"
                 />
               ))}
            </div>
          )}
          {!vehiclesLoading && !vehiclesError && layout === 'carousel' && (
            <CardCarouselStrip
              itemCount={displayVehicles.length}
              previousLabel={ui.vehicles.previous}
              nextLabel={ui.vehicles.next}
              testId="vehicle-strip"
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
                  layout="carousel"
                />
              ))}
            </CardCarouselStrip>
          )}
        </div>
    </section>
  );
}
