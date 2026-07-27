'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

interface Crumb {
  label: string;
  href?: string;
}

interface PageHeroProps {
  breadcrumbs: Crumb[];
  title: string;
  subtitle?: string;
}

export default function PageHero({ breadcrumbs, title, subtitle }: PageHeroProps) {
  return (
    <section
      className="relative pt-36 pb-20 text-center overflow-hidden"
      style={{ background: '#0A0A0A' }}
    >
      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center top, rgba(201,168,76,0.07) 0%, transparent 60%)' }}
      />

      <div className="relative z-10 max-w-4xl mx-auto px-5 md:px-8">
        {/* Breadcrumb */}
        <nav
          className="flex items-center justify-center gap-1.5 mb-8 text-xs flex-wrap"
          aria-label="Breadcrumb"
        >
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight size={11} style={{ color: '#444' }} />}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="transition-colors duration-200 hover:text-[#C9A84C]"
                  style={{ color: '#666', fontFamily: 'Inter, sans-serif' }}
                >
                  {crumb.label}
                </Link>
              ) : (
                <span style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}>
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>

        {/* H1 */}
        <motion.h1
          className="text-3xl sm:text-4xl md:text-6xl font-bold mb-6"
          style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#FFFFFF', lineHeight: 1.15 }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          {title}
        </motion.h1>

        {/* Gold divider */}
        <motion.div
          className="mx-auto mb-6"
          style={{ width: '60px', height: '1px', background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }}
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
        />

        {/* Subtitle */}
        {subtitle && (
          <motion.p
            className="text-base md:text-lg max-w-2xl mx-auto leading-relaxed"
            style={{ color: '#888', fontFamily: 'Inter, sans-serif' }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
          >
            {subtitle}
          </motion.p>
        )}
      </div>

      {/* Bottom gold line */}
      <div className="gold-divider absolute bottom-0 left-0 right-0" />
    </section>
  );
}
