'use client';

import Image from 'next/image';
import { ChevronDown, Star } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { useSiteSettings } from '@/components/SiteSettingsContext';
import { useHomepageCms } from '@/lib/homepage-cms-context';

export default function Hero({ homepageMode = false }: { homepageMode?: boolean }) {
  const { dict } = useLang();
  const cms = useHomepageCms();
  const cs = useSiteSettings();
  const homepageCms = homepageMode ? cms : null;

  if (homepageCms?.hero && !homepageCms.hero.enabled) return null;

  // Use CMS data where published; fall back to static i18n dictionary
  const h = homepageCms?.hero
    ? {
        badge:             homepageCms.hero.badge,
        headline1:         homepageCms.hero.headline1,
        headlineAccent:    homepageCms.hero.headlineAccent,
        headline2:         homepageCms.hero.headline2,
        subheadline:       homepageCms.hero.subheadline,
        ctaBooking:        homepageCms.hero.ctaBookingText,
        ctaCall:           homepageCms.hero.ctaCallText,
        scrollHint:        dict.hero.scrollHint,
        scrollAriaLabel:   dict.hero.scrollAriaLabel,
        imageAlt:          homepageCms.hero.imageAlt,
        imageSrc:          homepageCms.hero.imagePath,
      }
    : {
        ...dict.hero,
        imageSrc: '/images/istanbul-havalimani-mercedes-vip-transfer-hero.webp',
      };
  const trustItems = homepageCms?.heroStats
    ? homepageCms.heroStats
      .filter((stat) => stat.enabled)
      .sort((a, b) => a.order - b.order)
      .map((stat) => ({ number: stat.numberText, label: stat.label }))
    : [
      { number: 'IST & SAW', label: dict.hero.trustAirportLabel },
      { number: '7/24', label: dict.hero.trustSupportLabel },
      { number: 'Vito & Sprinter', label: dict.hero.trustVehiclesLabel },
    ];
  const heroMetrics = homepageCms?.heroMetrics
    ? homepageCms.heroMetrics
      .filter((metric) => metric.enabled)
      .sort((a, b) => a.order - b.order)
      .map((metric) => ({ value: metric.valueText, label: metric.label }))
    : [
      { value: '12.000+', label: 'Transferler' },
      { value: '4.9 ★', label: 'Puan' },
      { value: '%99.7', label: 'Zamanında' },
      { value: '1.500+', label: 'Müşteri' },
    ];
  const heroImageAlt = h.imageAlt?.trim()
    || `${h.headline1} ${h.headlineAccent} ${h.headline2}`.trim()
    || 'Istanbul VIP transfer vehicle';

  const scrollToBooking = () => {
    document.dispatchEvent(new Event('ivt:booking-open'));
    document.querySelector('#rezervasyon')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      id="hero"
      className="relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #FFFDF8 0%, #F7F8FC 55%, #EEF3F9 100%)' }}
      data-testid="hero-section"
    >
      {/* Decorative radial glow — top right */}
      <div
        className="absolute top-0 right-0 w-[600px] h-[600px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 70% 30%, rgba(199,154,53,0.09) 0%, transparent 65%)',
          transform: 'translate(15%, -15%)',
        }}
        aria-hidden="true"
      />
      {/* Decorative radial glow — bottom left */}
      <div
        className="absolute bottom-0 left-0 w-[400px] h-[400px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(22,140,140,0.06) 0%, transparent 70%)',
          transform: 'translate(-20%, 20%)',
        }}
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-5 md:px-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 xl:gap-16 items-center py-16 lg:py-0 lg:min-h-[calc(100dvh-80px)]">

          {/* ── Left: Content ── */}
          <div className="order-1">
            {/* Badge */}
            <div
              className="ivt-hero-badge inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-7 border"
              style={{ borderColor: 'rgba(199,154,53,0.35)', background: 'rgba(199,154,53,0.08)' }}
              data-testid="hero-badge"
            >
              <Star size={12} fill="#C79A35" stroke="none" aria-hidden="true" />
              <span
                className="text-[11px] tracking-[0.22em] uppercase"
                style={{ color: '#8A651C', fontFamily: 'Inter, sans-serif' }}
              >
                {h.badge}
              </span>
              <Star size={12} fill="#C79A35" stroke="none" aria-hidden="true" />
            </div>

            {/* H1 */}
            <h1
              className="ivt-hero-h1 text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-5"
              style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43', lineHeight: 1.1 }}
              data-testid="hero-headline"
            >
              {h.headline1}{' '}
              <span style={{ color: '#8A651C' }}>{h.headlineAccent}</span>
              <br />
              {h.headline2}
            </h1>

            {/* Gold accent bar */}
            <div
              className="ivt-hero-bar mb-6"
              style={{ width: '72px', height: '3px', background: 'linear-gradient(90deg, #C79A35, #E4B84B)', borderRadius: '2px' }}
            />

            {/* Subheadline */}
            <p
              className="ivt-hero-sub text-base md:text-lg mb-8 max-w-xl leading-relaxed"
              style={{
                color: '#50677A',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                // This paragraph is the mobile LCP candidate. Do not make its
                // first paint wait for the decorative entrance animation.
                animation: 'none',
                opacity: 1,
                transform: 'none',
              }}
              data-testid="hero-subheadline"
            >
              {h.subheadline}
            </p>

            {/* CTA Buttons */}
            <div className="ivt-hero-cta flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-10">
              <button
                onClick={scrollToBooking}
                className="px-8 py-3.5 rounded-xl text-sm font-semibold tracking-wide transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C79A35] focus-visible:ring-offset-2"
                style={{
                  background: '#C79A35',
                  color: '#102A43',
                  fontFamily: 'Inter, sans-serif',
                  letterSpacing: '0.06em',
                }}
                data-testid="hero-booking-cta"
              >
                {h.ctaBooking}
              </button>
              <a
                href={cs.phoneTel}
                className="px-8 py-3.5 rounded-xl text-sm font-semibold tracking-wide transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#102A43] focus-visible:ring-offset-2 text-center"
                style={{
                  background: '#102A43',
                  color: '#FFFFFF',
                  fontFamily: 'Inter, sans-serif',
                  letterSpacing: '0.06em',
                }}
                data-testid="hero-call-link"
              >
                {h.ctaCall}
              </a>
            </div>

            {/* Trust bar */}
            <div
              className="ivt-hero-trust flex flex-wrap items-center gap-6 pb-7 pt-7 md:gap-8"
              style={{ borderTop: '1px solid #D9E2EC' }}
              data-testid="hero-trust-bar"
            >
              {trustItems.map((item, i) => (
                <div key={i} className="flex flex-col" data-testid={`hero-trust-item-${i}`}>
                  <span
                    className="text-lg sm:text-xl font-bold"
                    style={{ color: '#8A651C', fontFamily: 'Playfair Display, Georgia, serif' }}
                    dir="ltr"
                  >
                    {item.number}
                  </span>
                  <span
                    className="text-[11px] tracking-wider uppercase mt-0.5"
                    style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Metrics Strip */}
            <div
              className="ivt-hero-metrics mb-10 grid grid-cols-2 border-y border-[#D7C28E] py-7 md:grid-cols-4 md:py-8"
              style={{
                background: 'linear-gradient(90deg, rgba(199,154,53,0.035), rgba(255,255,255,0.28), rgba(199,154,53,0.035))',
              }}
              data-testid="hero-metrics-strip"
            >
              {heroMetrics.map((metric, i) => (
                <div
                  key={i}
                  className={[
                    'flex min-w-0 flex-col items-center px-3 text-center sm:px-5',
                    i === 0 ? 'pl-0' : '',
                    i === 1 || i === 3 ? 'border-l border-[#D9E2EC]' : '',
                    i >= 2 ? 'mt-6 border-t border-[#D9E2EC] pt-6 md:mt-0 md:border-t-0 md:pt-0' : '',
                    i === 2 ? 'pl-0 md:border-l md:border-[#D9E2EC] md:pl-5' : '',
                  ].join(' ')}
                  data-testid={`hero-metric-${i}`}
                >
                  <span
                    className="mb-3 h-0.5 w-8 rounded-full"
                    style={{ background: 'linear-gradient(90deg, #C79A35, #E4B84B)' }}
                    aria-hidden="true"
                  />
                  <span
                    className="whitespace-nowrap text-[2rem] font-extrabold leading-none tracking-[-0.025em] sm:text-[2.25rem] md:text-[1.9rem] xl:text-[2.25rem]"
                    style={{
                      color: '#7A5815',
                      fontFamily: 'Playfair Display, Georgia, serif',
                      textShadow: '0 1px 0 rgba(255,255,255,0.8)',
                    }}
                    dir="ltr"
                  >
                    {metric.value}
                  </span>
                  <span
                    className="mt-2 text-xs font-semibold uppercase leading-snug tracking-[0.12em]"
                    style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
                  >
                    {metric.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Istanbul image panel ── */}
          <div className="ivt-hero-img order-2 relative">
            {/* Decorative offset frame */}
            <div
              className="absolute inset-0 rounded-2xl xl:rounded-3xl pointer-events-none"
              style={{
                transform: 'translate(14px, 14px)',
                border: '2px solid rgba(199,154,53,0.28)',
                zIndex: 0,
              }}
              aria-hidden="true"
            />
            {/* Image container */}
            <div
              className="relative rounded-2xl xl:rounded-3xl overflow-hidden"
              style={{
                aspectRatio: '16 / 9',
                boxShadow: '0 24px 64px rgba(16,42,67,0.16), 0 4px 16px rgba(16,42,67,0.08)',
                zIndex: 1,
              }}
            >
              <Image
                src={h.imageSrc ?? '/images/istanbul-vip-transfer-hero.webp'}
                alt={heroImageAlt}
                fill
                className="object-cover object-center"
                priority
                fetchPriority="high"
                quality={60}
                sizes="(max-width: 640px) calc(100vw - 2.5rem), (max-width: 1024px) calc(100vw - 4rem), 50vw"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator — desktop only */}
      <button
        type="button"
        className="ivt-hero-scroll absolute bottom-6 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center gap-1.5 bg-transparent border-0 p-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C79A35] rounded"
        onClick={scrollToBooking}
        aria-label={h.scrollAriaLabel}
        data-testid="hero-scroll-indicator"
      >
        <span
          className="text-[10px] tracking-[0.28em] uppercase"
          style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
        >
          {h.scrollHint}
        </span>
        <div className="ivt-hero-chevron">
          <ChevronDown size={18} style={{ color: '#C79A35' }} aria-hidden="true" />
        </div>
      </button>
    </section>
  );
}
