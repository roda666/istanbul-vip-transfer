'use client';

import Link from 'next/link';
import { Phone, MapPin, Mail, Lock, ShieldCheck, Banknote, ArrowLeftRight, Smartphone } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { useSiteSettings } from '@/components/SiteSettingsContext';
import { localePath } from '@/lib/locale-path';
import { localizedServicePath } from '@/lib/localized-service-path';
import LanguageSelector from './LanguageSelector';
import { trackEvent } from '@/lib/analytics';

interface FooterProps {
  /** Slugs where admin set showInNav=false — passed from the root server layout. */
  hiddenNavSlugs?: string[];
}

// ── Visa SVG badge ────────────────────────────────────────────────────────────
function VisaBadge() {
  return (
    <span
      aria-label="Visa"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: '#1A1F71', borderRadius: '5px', padding: '4px 8px',
        height: '28px', minWidth: '44px',
      }}
    >
      <span style={{
        color: '#FFFFFF', fontFamily: 'Helvetica Neue, Arial, sans-serif',
        fontStyle: 'italic', fontWeight: 700, fontSize: '14px', letterSpacing: '-0.02em',
      }}>VISA</span>
    </span>
  );
}

// ── Mastercard SVG badge ──────────────────────────────────────────────────────
function MastercardBadge() {
  return (
    <span
      aria-label="Mastercard"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '3px',
        background: '#252525', borderRadius: '5px', padding: '4px 8px',
        height: '28px',
      }}
    >
      {/* Two overlapping circles */}
      <svg width="32" height="20" viewBox="0 0 32 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="12" cy="10" r="10" fill="#EB001B" />
        <circle cx="20" cy="10" r="10" fill="#F79E1B" fillOpacity="0.9" />
        <path d="M16 4.3a10 10 0 0 1 0 11.4A10 10 0 0 1 16 4.3z" fill="#FF5F00" />
      </svg>
    </span>
  );
}

// ── 3D Secure badge ───────────────────────────────────────────────────────────
function ThreeDSecureBadge() {
  return (
    <span
      aria-label="3D Secure"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(96,165,250,0.25)',
        borderRadius: '5px', padding: '3px 7px', height: '28px',
        color: '#93C5FD', fontFamily: 'Inter, sans-serif', fontSize: '10px', fontWeight: 600,
        letterSpacing: '0.04em', whiteSpace: 'nowrap',
      }}
    >
      <ShieldCheck size={12} strokeWidth={2.5} />
      3D Secure
    </span>
  );
}

// ── SSL badge ─────────────────────────────────────────────────────────────────
function SslBadge() {
  return (
    <span
      aria-label="SSL Secure"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        background: 'rgba(5,150,105,0.15)', border: '1px solid rgba(52,211,153,0.25)',
        borderRadius: '5px', padding: '3px 7px', height: '28px',
        color: '#6EE7B7', fontFamily: 'Inter, sans-serif', fontSize: '10px', fontWeight: 600,
        letterSpacing: '0.04em',
      }}
    >
      <Lock size={11} strokeWidth={2.5} />
      SSL
    </span>
  );
}

// ── TÜRSAB badge ──────────────────────────────────────────────────────────────
function TursabBadge({ tursabNo, label }: { tursabNo: string; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
        background: 'linear-gradient(135deg, #92400E 0%, #B45309 100%)',
        border: '1px solid rgba(251,191,36,0.4)',
        borderRadius: '8px', padding: '8px 14px',
        minWidth: '130px',
      }}
    >
      <span style={{
        color: '#FCD34D', fontFamily: 'Inter, sans-serif', fontSize: '12px',
        fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
      }}>
        TÜRSAB
      </span>
      <span style={{
        color: 'rgba(255,255,255,0.85)', fontFamily: 'Inter, sans-serif',
        fontSize: '9px', letterSpacing: '0.06em', marginTop: '1px',
      }}>
        {label}
      </span>
      {tursabNo && (
        <span style={{
          color: '#FDE68A', fontFamily: 'Inter, sans-serif',
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', marginTop: '2px',
        }}>
          Belge No: {tursabNo}
        </span>
      )}
    </span>
  );
}

export default function Footer({ hiddenNavSlugs }: FooterProps = {}) {
  const { lang, dict } = useLang();
  const cs = useSiteSettings();
  const p = (path: string) => localePath(path, lang);
  const servicePath = (slug: string) => localizedServicePath(slug, lang);
  const hidden = new Set(hiddenNavSlugs ?? []);

  const quickLinks = [
    { label: dict.footer.homeLink,        href: p('/') },
    { label: dict.footer.servicesLink,    href: p('/hizmetler') },
    { label: dict.footer.vehiclesLink,    href: p('/araclar') },
    { label: dict.footer.blogLink,        href: p('/blog') },
    { label: dict.footer.aboutLink,       href: p('/hakkimizda') },
    { label: dict.footer.reservationLink, href: p('/#rezervasyon') },
    { label: dict.footer.contactLink,     href: p('/iletisim') },
  ];

  const services = [
    { slug: 'istanbul-havalimani-transfer',       label: dict.nav.istTransfer,       href: servicePath('istanbul-havalimani-transfer') },
    { slug: 'sabiha-gokcen-havalimani-transfer',  label: dict.nav.sawTransfer,       href: servicePath('sabiha-gokcen-havalimani-transfer') },
    { slug: 'vip-transfer',                       label: dict.nav.vipTransfer,       href: servicePath('vip-transfer') },
    { slug: 'otel-transfer',                      label: dict.nav.hotelTransfer,     href: servicePath('otel-transfer') },
    { slug: 'sehirler-arasi-transfer',            label: dict.nav.intercityTransfer, href: servicePath('sehirler-arasi-transfer') },
    { slug: 'soforlu-arac-kiralama',              label: dict.nav.chauffeur,         href: servicePath('soforlu-arac-kiralama') },
    { slug: 'kurumsal-vip-transfer',              label: dict.nav.corporateTransfer, href: servicePath('kurumsal-vip-transfer') },
  ].filter(s => !hidden.has(s.slug));

  const linkHoverStyle = {
    color: 'rgba(255,255,255,0.65)',
    fontFamily: 'Inter, sans-serif',
  };

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
              <Link href={p('/')}>
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
              {dict.footer.tagline}
            </p>
            {/* Company legal name (small, below tagline) */}
            {cs.companyLegalName && (
              <p className="text-xs mt-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'Inter, sans-serif' }}>
                {cs.companyLegalName}
                {cs.companyTradeName && ` · ${cs.companyTradeName}`}
              </p>
            )}
          </div>

          {/* Quick Links */}
          <div>
            <h3
              className="text-xs tracking-[0.2em] uppercase mb-6"
              style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}
            >
              {dict.footer.quickLinks}
            </h3>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm flex items-center gap-2 group transition-colors duration-300 focus:outline-none focus-visible:underline"
                    style={linkHoverStyle}
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
            <h3
              className="text-xs tracking-[0.2em] uppercase mb-6"
              style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}
            >
              {dict.footer.services}
            </h3>
            <ul className="space-y-3">
              {services.map((service) => (
                <li key={service.href}>
                  <Link
                    href={service.href}
                    className="text-sm flex items-center gap-2 group transition-colors duration-300 focus:outline-none focus-visible:underline"
                    style={linkHoverStyle}
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
                  href={p('/hizmetler')}
                  className="text-xs tracking-wider uppercase transition-colors duration-300 mt-2 block focus:outline-none focus-visible:underline"
                  style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif', opacity: 0.75 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.75'; }}
                >
                  {dict.footer.allServices}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3
              className="text-xs tracking-[0.2em] uppercase mb-6"
              style={{ color: '#C79A35', fontFamily: 'Inter, sans-serif' }}
            >
              {dict.footer.contact}
            </h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Phone size={15} style={{ color: '#C79A35', flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
                <div>
                  <a
                    href={cs.phoneTel}
                    className="text-sm transition-colors duration-300 focus:outline-none focus-visible:underline"
                    style={{ color: 'rgba(255,255,255,0.88)', fontFamily: 'Inter, sans-serif' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#C79A35'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.88)'; }}
                    onClick={() => trackEvent('phone_click', { source: 'footer', page_path: window.location.pathname })}
                    dir="ltr"
                  >
                    {cs.phoneDisplay}
                  </a>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter, sans-serif' }}>
                    {dict.footer.available247}
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Mail size={15} style={{ color: '#C79A35', flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
                <div>
                  <a
                    href={cs.emailMailto}
                    className="text-sm transition-colors duration-300 break-all focus:outline-none focus-visible:underline"
                    style={{ color: 'rgba(255,255,255,0.88)', fontFamily: 'Inter, sans-serif' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#C79A35'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.88)'; }}
                    dir="ltr"
                  >
                    {cs.email}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={15} style={{ color: '#C79A35', flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
                <div>
                  {cs.fullAddress ? (
                    <>
                      <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.88)', fontFamily: 'Inter, sans-serif' }}>
                        {cs.fullAddress}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter, sans-serif' }}>
                        {dict.footer.locationServing}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.88)', fontFamily: 'Inter, sans-serif' }}>
                        {dict.footer.locationCity}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter, sans-serif' }}>
                        {dict.footer.locationServing}
                      </p>
                    </>
                  )}
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* ── Trust & Payment band ──────────────────────────────────────────── */}
        <div
          className="mt-12 pt-8"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">

            {/* Left: TÜRSAB badge */}
            {cs.tursabNo && (
              <div className="flex flex-col gap-2">
                <p
                  className="text-xs tracking-[0.15em] uppercase mb-1"
                  style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, sans-serif' }}
                >
                  {dict.footer.tursabLabel}
                </p>
                <TursabBadge tursabNo={cs.tursabNo} label={dict.footer.tursabLabel} />
              </div>
            )}

            {/* Center: Payment methods */}
            <div className="flex flex-col gap-3">
              <p
                className="text-xs tracking-[0.15em] uppercase"
                style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, sans-serif' }}
              >
                {dict.footer.paymentMethods}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {/* Card brand logos */}
                <VisaBadge />
                <MastercardBadge />
                {/* Security badges */}
                <ThreeDSecureBadge />
                <SslBadge />
                {/* Local payment options */}
                <span
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '5px', padding: '3px 8px', height: '28px',
                    color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter, sans-serif',
                    fontSize: '10px', fontWeight: 500, whiteSpace: 'nowrap',
                  }}
                >
                  <Banknote size={11} strokeWidth={2} />
                  {dict.footer.cashPayment}
                </span>
                <span
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '5px', padding: '3px 8px', height: '28px',
                    color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter, sans-serif',
                    fontSize: '10px', fontWeight: 500, whiteSpace: 'nowrap',
                  }}
                >
                  <ArrowLeftRight size={11} strokeWidth={2} />
                  {dict.footer.bankTransfer}
                </span>
              </div>
            </div>

            {/* Right: Google Play (conditional) */}
            {cs.googlePlayUrl && (
              <div className="flex flex-col gap-2">
                <p
                  className="text-xs tracking-[0.15em] uppercase mb-1"
                  style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, sans-serif' }}
                >
                  {dict.footer.googlePlayLabel}
                </p>
                <a
                  href={cs.googlePlayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={dict.footer.googlePlayLabel}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '10px',
                    background: '#000000', border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px', padding: '8px 14px',
                    color: '#FFFFFF', textDecoration: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.5)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.2)'; }}
                >
                  <Smartphone size={20} style={{ color: '#78C5F0' }} />
                  <div>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '9px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em', lineHeight: 1 }}>GET IT ON</p>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1.3 }}>Google Play</p>
                  </div>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Legal links */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pb-4">
          {([
            { href: p('/yasal/kvkk-aydinlatma-metni'), label: dict.booking.kvkkLink },
            { href: p('/yasal/cerez-politikasi'),       label: dict.footer.cookieLink },
            { href: p('/yasal/kullanim-kosullari'),     label: dict.footer.termsLink },
            { href: p('/yasal/gizlilik-politikasi'),    label: dict.footer.privacyLink },
          ] as { href: string; label: string }[]).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs transition-colors duration-300 focus:outline-none focus-visible:underline"
              style={{ color: 'rgba(255,255,255,0.42)', fontFamily: 'Inter, sans-serif' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.75)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.42)'; }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div
          className="mt-0 pt-7 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
          data-testid="footer-bottom"
        >
          <div className="text-center md:text-left">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter, sans-serif' }}>
              &copy; {new Date().getFullYear()} VIP Transfer Istanbul. {dict.footer.copyright}
            </p>
            {cs.companyLegalName && (
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'Inter, sans-serif' }}>
                {cs.companyLegalName}
                {cs.tursabNo && ` · TÜRSAB ${cs.tursabNo}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter, sans-serif' }}>
              {dict.footer.premium}
            </p>
            <LanguageSelector variant="dark" />
          </div>
        </div>
      </div>
    </footer>
  );
}
