'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Phone, MapPin, Mail } from 'lucide-react';
import { SITE } from '@/lib/site-config';
import LanguageSelector from './LanguageSelector';

const quickLinks = [
  { label: 'Ana Sayfa', href: '/' },
  { label: 'Hizmetler', href: '/hizmetler' },
  { label: 'Araçlarımız', href: '/araclar' },
  { label: 'Blog', href: '/blog' },
  { label: 'Hakkımızda', href: '/hakkimizda' },
  { label: 'Rezervasyon', href: '/#rezervasyon' },
  { label: 'İletişim', href: '/iletisim' },
];

const services: { label: string; href: string }[] = [
  { label: 'İstanbul Havalimanı Transfer', href: '/istanbul-havalimani-transfer' },
  { label: 'Sabiha Gökçen Transfer', href: '/sabiha-gokcen-havalimani-transfer' },
  { label: 'VIP Transfer', href: '/vip-transfer' },
  { label: 'Otel Transferi', href: '/otel-transfer' },
  { label: 'Şehirler Arası Transfer', href: '/sehirler-arasi-transfer' },
  { label: 'Şoförlü Araç Kiralama', href: '/soforlu-arac-kiralama' },
  { label: 'Kurumsal VIP Transfer', href: '/kurumsal-vip-transfer' },
];

export default function Footer() {
  return (
    <footer
      style={{ background: '#102A43', borderTop: '1px solid rgba(255,255,255,0.08)' }}
      data-testid="footer"
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">

          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="mb-5">
              <Link href="/">
                <div
                  className="text-2xl font-bold tracking-widest uppercase mb-1"
                  style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#C79A35', letterSpacing: '0.15em' }}
                >
                  VIP Transfer
                </div>
                <div
                  className="text-[10px] tracking-[0.35em] uppercase"
                  style={{ color: 'rgba(255,255,255,0.65)', fontFamily: 'Inter, sans-serif' }}
                >
                  Istanbul
                </div>
              </Link>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)', fontFamily: 'Inter, sans-serif' }}>
              İstanbul&apos;un en güvenilir VIP transfer hizmeti. Lüks Mercedes araçlar, profesyonel sürücüler, 7/24 hizmet.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4
              className="text-xs tracking-[0.2em] uppercase mb-6"
              style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}
            >
              Hızlı Bağlantılar
            </h4>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm flex items-center gap-2 group transition-colors duration-300 focus:outline-none focus-visible:underline"
                    style={{ color: 'rgba(255,255,255,0.65)', fontFamily: 'Inter, sans-serif' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#C79A35'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.65)'; }}
                    data-testid={`footer-link-${link.label}`}
                  >
                    <span
                      className="h-px transition-all duration-300 group-hover:w-6 flex-shrink-0"
                      style={{ width: '16px', background: '#C79A35', opacity: 0.5 }}
                    />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4
              className="text-xs tracking-[0.2em] uppercase mb-6"
              style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}
            >
              Hizmetlerimiz
            </h4>
            <ul className="space-y-3">
              {services.map((service) => (
                <li key={service.href}>
                  <Link
                    href={service.href}
                    className="text-sm flex items-center gap-2 group transition-colors duration-300 focus:outline-none focus-visible:underline"
                    style={{ color: 'rgba(255,255,255,0.65)', fontFamily: 'Inter, sans-serif' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#C79A35'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.65)'; }}
                  >
                    <span
                      className="h-px transition-all duration-300 group-hover:w-6 flex-shrink-0"
                      style={{ width: '16px', background: '#C79A35', opacity: 0.5, display: 'inline-block' }}
                    />
                    {service.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/hizmetler"
                  className="text-xs tracking-wider uppercase transition-colors duration-300 mt-2 block focus:outline-none focus-visible:underline"
                  style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif', opacity: 0.75 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.75'; }}
                >
                  Tüm Hizmetler →
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4
              className="text-xs tracking-[0.2em] uppercase mb-6"
              style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}
            >
              İletişim
            </h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Phone size={15} style={{ color: '#C79A35', flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
                <div>
                  <a
                    href={SITE.phoneTel}
                    className="text-sm transition-colors duration-300 focus:outline-none focus-visible:underline"
                    style={{ color: 'rgba(255,255,255,0.88)', fontFamily: 'Inter, sans-serif' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#C79A35'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.88)'; }}
                  >
                    {SITE.phoneDisplay}
                  </a>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter, sans-serif' }}>
                    7/24 Açık
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Mail size={15} style={{ color: '#C79A35', flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
                <div>
                  <a
                    href={SITE.emailMailto}
                    className="text-sm transition-colors duration-300 break-all focus:outline-none focus-visible:underline"
                    style={{ color: 'rgba(255,255,255,0.88)', fontFamily: 'Inter, sans-serif' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#C79A35'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.88)'; }}
                  >
                    {SITE.email}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={15} style={{ color: '#C79A35', flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
                <div>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.88)', fontFamily: 'Inter, sans-serif' }}>
                    İstanbul, Türkiye
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter, sans-serif' }}>
                    Tüm İstanbul&apos;a hizmet
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <motion.div
          className="mt-14 pt-7 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          data-testid="footer-bottom"
        >
          <p className="text-xs text-center md:text-left" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter, sans-serif' }}>
            &copy; {new Date().getFullYear()} VIP Transfer Istanbul. Tüm hakları saklıdır.
          </p>
          <div className="flex items-center gap-4">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter, sans-serif' }}>
              İstanbul&apos;un Premium Transfer Hizmeti
            </p>
            <LanguageSelector variant="dark" />
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
