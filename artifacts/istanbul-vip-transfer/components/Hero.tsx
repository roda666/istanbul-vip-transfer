'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { ChevronDown, Star } from 'lucide-react';

export default function Hero() {
  const scrollToBooking = () => {
    document.querySelector('#rezervasyon')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      id="hero"
      className="relative min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden"
      data-testid="hero-section"
    >
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/istanbul-hero.jpg"
          alt="İstanbul Boğaz Köprüsü gece manzarası"
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(10,10,10,0.65) 0%, rgba(10,10,10,0.45) 40%, rgba(10,10,10,0.75) 80%, rgba(10,10,10,1) 100%)' }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(10,10,10,0.5) 100%)' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-5 md:px-8 max-w-5xl mx-auto pt-24">
        {/* Badge */}
        <motion.div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 border"
          style={{ borderColor: 'rgba(201,168,76,0.4)', background: 'rgba(201,168,76,0.08)', backdropFilter: 'blur(10px)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          data-testid="hero-badge"
        >
          <Star size={12} fill="#C9A84C" stroke="none" />
          <span className="text-[11px] tracking-[0.25em] uppercase" style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>
            İstanbul&apos;un Prestijli Transfer Hizmeti
          </span>
          <Star size={12} fill="#C9A84C" stroke="none" />
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          className="text-4xl sm:text-5xl md:text-7xl font-bold leading-tight mb-6"
          style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#FFFFFF', lineHeight: 1.1 }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.35 }}
          data-testid="hero-headline"
        >
          İstanbul&apos;u{' '}
          <span style={{ color: '#C9A84C' }}>Konforla</span>
          <br />
          Keşfedin
        </motion.h1>

        {/* Gold divider */}
        <motion.div
          className="mx-auto mb-7"
          style={{ width: '80px', height: '1px', background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }}
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.55 }}
        />

        {/* Subheadline */}
        <motion.p
          className="text-base md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed"
          style={{ color: '#B0B0B0', fontFamily: 'Inter, sans-serif', fontWeight: 300 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          data-testid="hero-subheadline"
        >
          Havalimanından otelinize, toplantınıza ve her hedefe — lüks Mercedes araçlarımız ve profesyonel sürücülerimizle zamanında, güvenle ulaşın.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.65 }}
        >
          <button
            onClick={scrollToBooking}
            className="px-10 py-4 rounded text-sm font-semibold tracking-widest uppercase transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, #C9A84C, #E5C36A)',
              color: '#0A0A0A',
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.12em',
              minWidth: '220px',
            }}
            data-testid="hero-booking-cta"
          >
            Rezervasyon Yap
          </button>
          <a
            href="tel:+905055877006"
            className="px-10 py-4 rounded text-sm font-semibold tracking-widest uppercase transition-all duration-300 hover:-translate-y-0.5"
            style={{
              border: '1px solid rgba(201,168,76,0.5)',
              color: '#C9A84C',
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.12em',
              minWidth: '220px',
              backdropFilter: 'blur(10px)',
              background: 'rgba(201,168,76,0.05)',
            }}
            data-testid="hero-call-link"
          >
            Hemen Ara
          </a>
        </motion.div>

        {/* Trust bar */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-6 md:gap-10 mt-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.9 }}
          data-testid="hero-trust-bar"
        >
          {[
            { number: 'IST & SAW', label: 'Havalimanı Transfer' },
            { number: '7/24', label: 'Rezervasyon Desteği' },
            { number: 'Vito & Sprinter', label: 'VIP Araç Seçenekleri' },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center" data-testid={`hero-trust-item-${i}`}>
              <span className="text-2xl md:text-3xl font-bold" style={{ color: '#C9A84C', fontFamily: 'Playfair Display, Georgia, serif' }}>
                {item.number}
              </span>
              <span className="text-[11px] tracking-widest uppercase mt-1" style={{ color: '#666', fontFamily: 'Inter, sans-serif' }}>
                {item.label}
              </span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer"
        onClick={scrollToBooking}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
        data-testid="hero-scroll-indicator"
      >
        <span className="text-[10px] tracking-[0.3em] uppercase" style={{ color: '#666', fontFamily: 'Inter, sans-serif' }}>
          Aşağı Kaydır
        </span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown size={20} style={{ color: '#C9A84C' }} />
        </motion.div>
      </motion.div>
    </section>
  );
}
