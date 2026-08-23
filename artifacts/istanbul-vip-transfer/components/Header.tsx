'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Phone, ChevronDown } from 'lucide-react';
import { getNav } from '@/lib/nav-config';
import { useLang } from '@/lib/i18n/context';
import { useSiteSettings } from '@/components/SiteSettingsContext';
import { localizedPublicPath } from '@/lib/localized-service-path';
import type { PublicServiceNavigationGroup } from '@/lib/public-service-catalog-types';
import LanguageSelector from './LanguageSelector';

interface HeaderProps {
  /** Active, published services grouped by their CMS category. */
  serviceNavigationGroups?: PublicServiceNavigationGroup[];
}

export default function Header({ serviceNavigationGroups }: HeaderProps = {}) {
  const { lang, dict } = useLang();
  const cs = useSiteSettings();
  const nav = getNav(lang, dict, serviceNavigationGroups);

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const [mobileOpenGroups, setMobileOpenGroups] = useState<Set<string>>(new Set());
  const pathname = usePathname();
  const dropdownWrapRef = useRef<HTMLDivElement>(null);
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setDropdownOpen(false);
    setMobileServicesOpen(false);
    setMobileOpenGroups(new Set());
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (dropdownOpen) {
        setDropdownOpen(false);
        dropdownTriggerRef.current?.focus();
      } else if (menuOpen) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dropdownOpen, menuOpen]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!dropdownWrapRef.current?.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [dropdownOpen]);

  const toggleMobileGroup = (label: string) => {
    setMobileOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) { next.delete(label); } else { next.add(label); }
      return next;
    });
  };

  const mainEntries = nav.filter((e) => !e.cta);
  const ctaEntry = nav.find((e) => e.cta);
  const accessibleGold = '#9A6A12';

  // German has longer nav labels — tighten tracking + padding to avoid wrapping
  const isDE = lang === 'de';
  const navLinkCls = `text-xs ${isDE ? 'tracking-wide px-1.5' : 'tracking-wider px-2'} uppercase whitespace-nowrap transition-colors duration-300 py-7 block focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C79A35] rounded`;
  const homePath = localizedPublicPath('/', lang);
  const servicesPath = localizedPublicPath('/hizmetler', lang);

  return (
    <>
      <header
        className={`sticky top-0 left-0 right-0 z-50 transition-all duration-400 ${
          scrolled
            ? 'bg-[#FFFDF8]/95 backdrop-blur-xl border-b border-[#D9E2EC] shadow-sm'
            : 'bg-[#FFFDF8] border-b border-[#D9E2EC]'
        }`}
        data-testid="header"
      >
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="flex items-center justify-between h-20">

            {/* ── Logo ── */}
            <div className="flex-shrink-0 ivt-hdr-logo">
              <Link href={homePath} className="flex flex-col leading-none" data-testid="logo-link">
                <span
                  className="text-xl md:text-2xl font-bold tracking-widest uppercase whitespace-nowrap"
                   style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#9A6A12', letterSpacing: '0.15em' }}
                >
                  VIP Transfer
                </span>
                <span
                  className="text-[10px] tracking-[0.35em] uppercase"
                  style={{ color: '#50677A', fontFamily: 'Inter, sans-serif', marginTop: '1px' }}
                >
                  Istanbul
                </span>
              </Link>
            </div>

            {/* ── Desktop navigation ── */}
            <nav
              className="hidden xl:flex items-center"
              data-testid="desktop-nav"
              aria-label={dict.header.desktopNav}
            >
              {mainEntries.map((entry, i) => {
                if (entry.groups) {
                  const isActive =
                    pathname === servicesPath ||
                    entry.groups.some((g) => g.items.some((item) => pathname === item.href));

                  return (
                    <div key={entry.label} ref={dropdownWrapRef} className="relative flex items-center">
                      <Link
                        href={entry.href!}
                        className={navLinkCls}
                        style={{ fontFamily: 'Inter, sans-serif', color: isActive ? accessibleGold : '#263F55' }}
                        onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.color = accessibleGold; }}
                        onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.color = '#263F55'; }}
                        data-testid="nav-hizmetler-link"
                      >
                        {entry.label}
                      </Link>

                      <button
                        ref={dropdownTriggerRef}
                        aria-expanded={dropdownOpen}
                        aria-controls="hizmetler-dropdown"
                        aria-label={dict.header.servicesSubmenuToggle}
                        className="flex items-center justify-center w-11 h-11 mr-1 rounded transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C79A35]"
                        style={{ color: isActive ? accessibleGold : '#50677A' }}
                        onClick={() => setDropdownOpen((o) => !o)}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = accessibleGold; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = isActive ? accessibleGold : '#50677A'; }}
                      >
                        <ChevronDown
                          size={12}
                          aria-hidden="true"
                          style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                        />
                      </button>

                      {/* Dropdown — always in DOM; CSS transitions drive entry AND exit */}
                      <div
                        id="hizmetler-dropdown"
                        role="navigation"
                        aria-label={dict.header.servicesSubmenu}
                        className="ivt-hdr-dropdown absolute top-full left-1/2 mt-0 rounded-xl shadow-xl border overflow-hidden"
                        data-open={String(dropdownOpen)}
                        aria-hidden={!dropdownOpen}
                        style={{
                          translate: '-50% 0',
                          width: '600px',
                          background: 'rgba(255,253,248,0.98)',
                          borderColor: '#D9E2EC',
                          backdropFilter: 'blur(20px)',
                          boxShadow: '0 20px 48px rgba(16,42,67,0.12)',
                        }}
                      >
                        <div className="grid grid-cols-2">
                          {entry.groups.map((group, gi) => (
                            <div
                              key={group.groupLabel}
                              className="p-5"
                              style={{
                                borderRight: gi % 2 === 0 ? '1px solid rgba(217,226,236,0.7)' : undefined,
                                borderBottom: gi < 2 ? '1px solid rgba(217,226,236,0.7)' : undefined,
                              }}
                            >
                              <p
                                className="text-[10px] tracking-[0.18em] uppercase mb-3"
                                style={{ color: '#8A6516', fontFamily: 'Inter, sans-serif' }}
                              >
                                {group.groupLabel}
                              </p>
                              <ul className="space-y-2.5">
                                {group.items.map((item) => {
                                  const active = pathname === item.href;
                                  return (
                                    <li key={item.href}>
                                      <Link
                                        href={item.href}
                                        className="text-xs flex items-center gap-2 group transition-colors duration-200 focus:outline-none focus-visible:underline"
                                        style={{ color: active ? '#8A6516' : '#50677A', fontFamily: 'Inter, sans-serif' }}
                                        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#8A6516'; }}
                                        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = active ? '#8A6516' : '#50677A'; }}
                                        onClick={() => setDropdownOpen(false)}
                                      >
                                        <span
                                          className="h-px flex-shrink-0 transition-all duration-200 group-hover:w-5"
                                          style={{ width: '12px', background: 'rgba(199,154,53,0.5)' }}
                                        />
                                        {item.label}
                                      </Link>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ))}
                        </div>
                        <div
                          className="px-5 py-3 flex items-center justify-between"
                          style={{ borderTop: '1px solid rgba(217,226,236,0.8)', background: 'rgba(199,154,53,0.04)' }}
                        >
                          <Link
                            href={servicesPath}
                            className="text-[10px] tracking-[0.15em] uppercase transition-colors focus:outline-none focus-visible:underline"
                            style={{ color: '#8A6516', fontFamily: 'Inter, sans-serif' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.75'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}
                            onClick={() => setDropdownOpen(false)}
                          >
                            {dict.header.allServices}
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                }

                const isActive = pathname === entry.href;
                return (
                  <div
                    key={entry.href}
                    className="ivt-hdr-nav-item"
                    style={{ '--delay': `${0.08 * i + 0.15}s` } as React.CSSProperties}
                  >
                    <Link
                      href={entry.href!}
                      className={navLinkCls}
                      style={{ fontFamily: 'Inter, sans-serif', color: isActive ? '#8A6516' : '#263F55' }}
                      onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.color = '#8A6516'; }}
                      onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.color = '#263F55'; }}
                      data-testid={`nav-link-${i}`}
                    >
                      {entry.label}
                    </Link>
                  </div>
                );
              })}
            </nav>

            {/* ── Desktop right CTAs ── */}
            <div className="hidden xl:flex items-center gap-2 flex-shrink-0">
              <LanguageSelector variant="light" />
              {ctaEntry && (
                <div className="ivt-hdr-cta">
                  <Link
                    href={ctaEntry.href!}
                    className="text-xs tracking-wider uppercase whitespace-nowrap px-4 py-2 rounded-lg border transition-all duration-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#102A43]"
                    style={{ borderColor: '#102A43', color: '#102A43', fontFamily: 'Inter, sans-serif' }}
                    onMouseEnter={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.background = '#102A43'; el.style.color = '#FFFFFF'; }}
                    onMouseLeave={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.background = 'transparent'; el.style.color = '#102A43'; }}
                    data-testid="nav-rezervasyon-cta"
                  >
                    {ctaEntry.label}
                  </Link>
                </div>
              )}
              <a
                href={cs.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ivt-hdr-wa flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A36A]"
                style={{ background: '#16A36A', color: '#102A43', fontFamily: 'Inter, sans-serif' }}
                data-testid="header-whatsapp-cta"
              >
                <Phone size={13} aria-hidden="true" />
                {dict.header.whatsappCta}
              </a>
            </div>

            {/* ── Hamburger ── */}
            <button
              className="xl:hidden p-2 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C79A35]"
              style={{ color: '#102A43' }}
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? dict.header.menuClose : dict.header.menuOpen}
              aria-expanded={menuOpen}
              data-testid="hamburger-button"
            >
              {menuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile menu ─────────────────────────────────────────────────────────
          Conditionally rendered so it's absent from the DOM when closed.
          CSS handles the entry animation; exit is instant (no AnimatePresence).  */}
      {menuOpen && (
        <div
          className="ivt-hdr-mobile-overlay fixed inset-0 z-40 lg:hidden overflow-y-auto overflow-x-hidden"
          data-testid="mobile-menu"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-[#FFFDF8]/98 backdrop-blur-2xl"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />

          <nav
            className="ivt-hdr-mobile-nav relative top-20 border-t px-6 pb-8 flex flex-col"
            style={{ borderColor: '#D9E2EC' }}
            aria-label={dict.header.mobileMenu}
          >
            {mainEntries.map((entry, i) => {
              if (entry.groups) {
                const isActive =
                  pathname === servicesPath ||
                  entry.groups.some((g) => g.items.some((item) => pathname === item.href));

                return (
                  <div key={entry.label} style={{ borderBottom: '1px solid rgba(217,226,236,0.8)' }}>
                    <div className="flex items-center">
                      <Link
                        href={entry.href!}
                        className="flex-1 py-4 text-2xl transition-colors duration-300 focus:outline-none"
                        style={{ fontFamily: 'Playfair Display, Georgia, serif', color: isActive ? '#C99A32' : '#102A43' }}
                        data-testid="mobile-nav-hizmetler-link"
                      >
                        {entry.label}
                      </Link>
                      <button
                        className="p-3 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C79A35] rounded"
                        aria-expanded={mobileServicesOpen}
                        aria-label={dict.header.servicesSubmenuToggle}
                        onClick={() => setMobileServicesOpen((o) => !o)}
                        style={{ color: '#C99A32' }}
                      >
                        <ChevronDown
                          size={20}
                          aria-hidden="true"
                          style={{ transform: mobileServicesOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.22s' }}
                        />
                      </button>
                    </div>

                    {/* Services accordion — CSS grid-template-rows trick (open & close animated) */}
                    <div className="ivt-hdr-accordion" data-open={String(mobileServicesOpen)}>
                      <div> {/* direct child: overflow + min-height set by .ivt-hdr-accordion > * */}
                        <div className="pb-3 space-y-1 pl-2">
                          {entry.groups.map((group) => {
                            const groupOpen = mobileOpenGroups.has(group.groupLabel);
                            return (
                              <div key={group.groupLabel}>
                                <button
                                  className="w-full flex items-center justify-between py-2.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C79A35] rounded"
                                  aria-expanded={groupOpen}
                                  onClick={() => toggleMobileGroup(group.groupLabel)}
                                >
                                  <span
                                    className="text-xs tracking-[0.14em] uppercase"
                                    style={{ color: '#C99A32', fontFamily: 'Inter, sans-serif' }}
                                  >
                                    {group.groupLabel}
                                  </span>
                                  <ChevronDown
                                    size={13}
                                    aria-hidden="true"
                                    style={{ color: '#C99A32', flexShrink: 0, transform: groupOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                                  />
                                </button>

                                {/* Group items accordion — same CSS grid trick */}
                                <div className="ivt-hdr-accordion" data-open={String(groupOpen)}>
                                  <ul className="pl-3 space-y-0.5 pb-1">
                                    {group.items.map((item) => (
                                      <li key={item.href}>
                                        <Link
                                          href={item.href}
                                          className="flex items-center gap-3 py-2.5 text-base transition-colors duration-200 focus:outline-none"
                                          style={{
                                            color: pathname === item.href ? '#C99A32' : '#50677A',
                                            fontFamily: 'Inter, sans-serif',
                                            minHeight: '44px',
                                          }}
                                          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#C99A32'; }}
                                          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = pathname === item.href ? '#C99A32' : '#50677A'; }}
                                        >
                                          <span className="h-px flex-shrink-0" style={{ width: '10px', background: 'rgba(199,154,53,0.4)' }} />
                                          {item.label}
                                        </Link>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={entry.href}
                  className="ivt-hdr-mobile-item"
                  style={{ borderBottom: '1px solid rgba(217,226,236,0.8)', '--delay': `${i * 0.05}s` } as React.CSSProperties}
                >
                  <Link
                    href={entry.href!}
                    className="block py-4 text-2xl transition-colors duration-300 focus:outline-none"
                    style={{
                      fontFamily: 'Playfair Display, Georgia, serif',
                      color: pathname === entry.href ? '#C99A32' : '#102A43',
                      minHeight: '44px',
                    }}
                    data-testid={`mobile-nav-link-${i}`}
                  >
                    {entry.label}
                  </Link>
                </div>
              );
            })}

            {/* Language selector (mobile) */}
            <div
              className="ivt-hdr-mobile-fade pt-5"
              style={{ '--delay': '0.32s' } as React.CSSProperties}
            >
              <div style={{ borderBottom: '1px solid rgba(217,226,236,0.8)', paddingBottom: '16px' }}>
                <LanguageSelector variant="light" />
              </div>
            </div>

            {/* Mobile CTAs */}
            <div
              className="ivt-hdr-mobile-fade pt-6 space-y-3"
              style={{ '--delay': '0.38s' } as React.CSSProperties}
            >
              {ctaEntry && (
                <Link
                  href={ctaEntry.href!}
                  className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl border text-base font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#102A43]"
                  style={{ borderColor: '#102A43', color: '#102A43', fontFamily: 'Inter, sans-serif', minHeight: '52px' }}
                  data-testid="mobile-rezervasyon-cta"
                >
                  {ctaEntry.label}
                </Link>
              )}
              <a
                href={cs.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl text-base font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A36A]"
                style={{ background: '#16A36A', color: '#102A43', fontFamily: 'Inter, sans-serif', minHeight: '52px' }}
                data-testid="mobile-whatsapp-cta"
              >
                <Phone size={18} aria-hidden="true" />
                {dict.header.whatsappCta}
              </a>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
