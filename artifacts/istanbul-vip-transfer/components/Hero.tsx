'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { ChevronDown, Star } from 'lucide-react';
import { SITE } from '@/lib/site-config';
import { useLang } from '@/lib/i18n/context';
import { useHomepageCms } from '@/lib/homepage-cms-context';

export default function Hero() {
  const { dict } = useLang();
  const cms = useHomepageCms();

  // Use CMS data where published; fall back to static i18n dictionary
  const h = cms?.hero
    ? {
        badge:             cms.hero.badge,
        headline1:         cms.hero.headline1,
        headlineAccent:    cms.hero.headlineAccent,
        headline2:         cms.hero.headline2,
        subheadline:       cms.hero.subheadline,
        ctaBooking:        cms.hero.ctaBookingText,
        ctaCall:           cms.hero.ctaCallText,
        trustAirportLabel: cms.heroStats.find(s => s.key === 'airport')?.label ?? dict.hero.trustAirportLabel,
        trustSupportLabel: cms.heroStats.find(s => s.key === 'support')?.label ?? dict.hero.trustSupportLabel,
        trustVehiclesLabel:cms.heroStats.find(s => s.key === 'vehicles')?.label ?? dict.hero.trustVehiclesLabel,
        scrollHint:        dict.hero.scrollHint,
        scrollAriaLabel:   dict.hero.scrollAriaLabel,
        imageAlt:          cms.hero.imageAlt,
        imageSrc:          cms.hero.imagePath,
      }
    : {
        ...dict.hero,
        imageSrc: '/images/istanbul-vip-transfer-hero.webp',
      };

  const scrollToBooking = () => {
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
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-7 border"
              style={{ borderColor: 'rgba(199,154,53,0.35)', background: 'rgba(199,154,53,0.08)' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              data-testid="hero-badge"
            >
              <Star size={12} fill="#C79A35" stroke="none" aria-hidden="true" />
              <span
                className="text-[11px] tracking-[0.22em] uppercase"
                style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}
              >
                {h.badge}
              </span>
              <Star size={12} fill="#C79A35" stroke="none" aria-hidden="true" />
            </motion.div>

            {/* H1 */}
            <motion.h1
              className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-5"
              style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43', lineHeight: 1.1 }}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.25 }}
              data-testid="hero-headline"
            >
              {h.headline1}{' '}
              <span style={{ color: '#C79A35' }}>{h.headlineAccent}</span>
              <br />
              {h.headline2}
            </motion.h1>

            {/* Gold accent bar */}
            <motion.div
              className="mb-6"
              style={{ width: '72px', height: '3px', background: 'linear-gradient(90deg, #C79A35, #E4B84B)', borderRadius: '2px', originX: 0 } as React.CSSProperties}
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.7, delay: 0.4 }}
            />

            {/* Subheadline */}
            <motion.p
              className="text-base md:text-lg mb-8 max-w-xl leading-relaxed"
              style={{ color: '#50677A', fontFamily: 'Inter, sans-serif', fontWeight: 400 }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.42 }}
              data-testid="hero-subheadline"
            >
              {h.subheadline}
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-10"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.54 }}
            >
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
                href={SITE.phoneTel}
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
            </motion.div>

            {/* Trust bar */}
            <motion.div
              className="flex flex-wrap items-center gap-6 md:gap-8 pt-7"
              style={{ borderTop: '1px solid #D9E2EC' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              data-testid="hero-trust-bar"
            >
              {[
                { number: 'IST & SAW', label: h.trustAirportLabel },
                { number: '7/24',      label: h.trustSupportLabel },
                { number: 'Vito & Sprinter', label: h.trustVehiclesLabel },
              ].map((item, i) => (
                <div key={i} className="flex flex-col" data-testid={`hero-trust-item-${i}`}>
                  <span
                    className="text-lg sm:text-xl font-bold"
                    style={{ color: '#C79A35', fontFamily: 'Playfair Display, Georgia, serif' }}
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
            </motion.div>
          </div>

          {/* ── Right: Istanbul image panel ── */}
          <motion.div
            className="order-2 relative"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.3 }}
          >
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
                aspectRatio: '4 / 3',
                boxShadow: '0 24px 64px rgba(16,42,67,0.16), 0 4px 16px rgba(16,42,67,0.08)',
                zIndex: 1,
              }}
            >
              <Image
                src={h.imageSrc ?? '/images/istanbul-vip-transfer-hero.webp'}
                alt={h.imageAlt}
                fill
                className="object-cover object-center"
                priority
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator — desktop only */}
      <motion.button
        type="button"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center gap-1.5 bg-transparent border-0 p-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C79A35] rounded"
        onClick={scrollToBooking}
        aria-label={h.scrollAriaLabel}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.1 }}
        data-testid="hero-scroll-indicator"
      >
        <span
          className="text-[10px] tracking-[0.28em] uppercase"
          style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
        >
          {h.scrollHint}
        </span>
        <motion.div
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown size={18} style={{ color: '#C79A35' }} aria-hidden="true" />
        </motion.div>
      </motion.button>
    </section>
  );
}
