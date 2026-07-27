'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Phone, ChevronDown } from 'lucide-react';
import { SITE } from '@/lib/site-config';
import { NAV } from '@/lib/nav-config';

export default function Header() {
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

  // Close everything on route change
  useEffect(() => {
    setMenuOpen(false);
    setDropdownOpen(false);
    setMobileServicesOpen(false);
    setMobileOpenGroups(new Set());
  }, [pathname]);

  // Escape closes focused menu layer
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

  // Click-outside closes the desktop dropdown
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

  // NAV split: regular items vs CTA
  const mainEntries = NAV.filter((e) => !e.cta);
  const ctaEntry = NAV.find((e) => e.cta);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-[#C9A84C]/15 shadow-2xl'
            : 'bg-transparent'
        }`}
        data-testid="header"
      >
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Link href="/" className="flex flex-col leading-none" data-testid="logo-link">
                <span
                  className="text-xl md:text-2xl font-bold tracking-widest uppercase"
                  style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#C9A84C', letterSpacing: '0.15em' }}
                >
                  VIP Transfer
                </span>
                <span
                  className="text-[10px] tracking-[0.35em] uppercase"
                  style={{ color: '#888', fontFamily: 'Inter, sans-serif', marginTop: '1px' }}
                >
                  Istanbul
                </span>
              </Link>
            </motion.div>

            {/* ── Desktop navigation ── */}
            <nav
              className="hidden lg:flex items-center"
              data-testid="desktop-nav"
              aria-label="Ana menü"
            >
              {mainEntries.map((entry, i) => {
                /* ── Hizmetler with dropdown ── */
                if (entry.groups) {
                  const isActive =
                    pathname === '/hizmetler' ||
                    entry.groups.some((g) => g.items.some((item) => pathname === item.href));

                  return (
                    <div
                      key={entry.label}
                      ref={dropdownWrapRef}
                      className="relative flex items-center"
                    >
                      {/* Link to hub page */}
                      <Link
                        href={entry.href!}
                        className="text-xs tracking-wider uppercase transition-colors duration-300 hover:text-[#C9A84C] px-2 py-7 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C9A84C] rounded"
                        style={{
                          fontFamily: 'Inter, sans-serif',
                          color: isActive ? '#C9A84C' : '#999',
                        }}
                        data-testid="nav-hizmetler-link"
                      >
                        {entry.label}
                      </Link>

                      {/* Chevron toggles dropdown */}
                      <button
                        ref={dropdownTriggerRef}
                        aria-expanded={dropdownOpen}
                        aria-controls="hizmetler-dropdown"
                        aria-label="Hizmetler alt menüsünü aç veya kapat"
                        className="flex items-center justify-center w-5 h-5 mr-1 rounded transition-colors hover:text-[#C9A84C] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C9A84C]"
                        style={{ color: isActive ? '#C9A84C' : '#666' }}
                        onClick={() => setDropdownOpen((o) => !o)}
                      >
                        <ChevronDown
                          size={12}
                          aria-hidden="true"
                          style={{
                            transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </button>

                      {/* ── Mega-menu dropdown ── */}
                      <AnimatePresence>
                        {dropdownOpen && (
                          <motion.div
                            id="hizmetler-dropdown"
                            role="navigation"
                            aria-label="Hizmetler alt menüsü"
                            className="absolute top-full left-1/2 mt-0 rounded-sm shadow-2xl border overflow-hidden"
                            style={{
                              translate: '-50% 0',
                              width: '600px',
                              background: 'rgba(8,8,8,0.98)',
                              borderColor: 'rgba(201,168,76,0.2)',
                              backdropFilter: 'blur(24px)',
                            }}
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.16 }}
                          >
                            <div className="grid grid-cols-2">
                              {entry.groups.map((group, gi) => (
                                <div
                                  key={group.groupLabel}
                                  className="p-5"
                                  style={{
                                    borderRight: gi % 2 === 0 ? '1px solid rgba(201,168,76,0.08)' : undefined,
                                    borderBottom: gi < 2 ? '1px solid rgba(201,168,76,0.08)' : undefined,
                                  }}
                                >
                                  <p
                                    className="text-[10px] tracking-[0.18em] uppercase mb-3"
                                    style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
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
                                            className="text-xs flex items-center gap-2 group transition-colors duration-200 hover:text-[#C9A84C] focus:outline-none focus-visible:underline"
                                            style={{
                                              color: active ? '#C9A84C' : '#888',
                                              fontFamily: 'Inter, sans-serif',
                                            }}
                                            onClick={() => setDropdownOpen(false)}
                                          >
                                            <span
                                              className="h-px flex-shrink-0 transition-all duration-200 group-hover:w-5"
                                              style={{ width: '12px', background: 'rgba(201,168,76,0.5)' }}
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
                            {/* Footer strip */}
                            <div
                              className="px-5 py-3 flex items-center justify-between"
                              style={{ borderTop: '1px solid rgba(201,168,76,0.1)', background: 'rgba(201,168,76,0.03)' }}
                            >
                              <Link
                                href="/hizmetler"
                                className="text-[10px] tracking-[0.15em] uppercase transition-colors hover:text-[#C9A84C] focus:outline-none focus-visible:underline"
                                style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
                                onClick={() => setDropdownOpen(false)}
                              >
                                Tüm Hizmetleri Görüntüle →
                              </Link>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                }

                /* ── Regular link ── */
                const isActive = pathname === entry.href;
                return (
                  <motion.div
                    key={entry.href}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 * i + 0.15, duration: 0.4 }}
                  >
                    <Link
                      href={entry.href!}
                      className="text-xs tracking-wider uppercase transition-colors duration-300 hover:text-[#C9A84C] px-2 py-7 block focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C9A84C] rounded"
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        color: isActive ? '#C9A84C' : '#999',
                      }}
                      data-testid={`nav-link-${i}`}
                    >
                      {entry.label}
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            {/* ── Desktop right-side CTAs ── */}
            <div className="hidden lg:flex items-center gap-2">
              {ctaEntry && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.25 }}
                >
                  <Link
                    href={ctaEntry.href!}
                    className="text-xs tracking-wider uppercase px-4 py-2 rounded border transition-all duration-300 hover:bg-[#C9A84C]/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C9A84C]"
                    style={{
                      borderColor: 'rgba(201,168,76,0.5)',
                      color: '#C9A84C',
                      fontFamily: 'Inter, sans-serif',
                    }}
                    data-testid="nav-rezervasyon-cta"
                  >
                    {ctaEntry.label}
                  </Link>
                </motion.div>
              )}
              <motion.a
                href={SITE.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(135deg, #C9A84C, #E5C36A)',
                  color: '#0A0A0A',
                  fontFamily: 'Inter, sans-serif',
                }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                data-testid="header-whatsapp-cta"
              >
                <Phone size={13} aria-hidden="true" />
                WhatsApp ile Ara
              </motion.a>
            </div>

            {/* Hamburger */}
            <button
              className="lg:hidden p-2 rounded text-[#C9A84C] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C9A84C]"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
              aria-expanded={menuOpen}
              data-testid="hamburger-button"
            >
              {menuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile menu ── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-40 lg:hidden overflow-y-auto overflow-x-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            data-testid="mobile-menu"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-[#0A0A0A]/97 backdrop-blur-2xl"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />

            <motion.nav
              className="relative top-20 border-t border-[#C9A84C]/20 px-6 pb-8 flex flex-col"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.25 }}
              aria-label="Mobil menü"
            >
              {mainEntries.map((entry, i) => {
                /* ── Hizmetler accordion ── */
                if (entry.groups) {
                  const isActive =
                    pathname === '/hizmetler' ||
                    entry.groups.some((g) => g.items.some((item) => pathname === item.href));

                  return (
                    <div key={entry.label} style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
                      {/* Row: link + chevron toggle */}
                      <div className="flex items-center">
                        <Link
                          href={entry.href!}
                          className="flex-1 py-4 text-2xl transition-colors duration-300 hover:text-[#C9A84C] focus:outline-none"
                          style={{
                            fontFamily: 'Playfair Display, Georgia, serif',
                            color: isActive ? '#C9A84C' : '#E5E5E5',
                          }}
                          data-testid="mobile-nav-hizmetler-link"
                        >
                          {entry.label}
                        </Link>
                        <button
                          className="p-3 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C9A84C] rounded"
                          aria-expanded={mobileServicesOpen}
                          aria-label="Hizmetler alt kategorilerini aç veya kapat"
                          onClick={() => setMobileServicesOpen((o) => !o)}
                          style={{ color: '#C9A84C' }}
                        >
                          <ChevronDown
                            size={20}
                            aria-hidden="true"
                            style={{
                              transform: mobileServicesOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.22s',
                            }}
                          />
                        </button>
                      </div>

                      {/* Groups sub-accordion */}
                      <AnimatePresence initial={false}>
                        {mobileServicesOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="pb-3 space-y-1 pl-2">
                              {entry.groups.map((group) => {
                                const groupOpen = mobileOpenGroups.has(group.groupLabel);
                                return (
                                  <div key={group.groupLabel}>
                                    <button
                                      className="w-full flex items-center justify-between py-2.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C9A84C] rounded"
                                      aria-expanded={groupOpen}
                                      onClick={() => toggleMobileGroup(group.groupLabel)}
                                    >
                                      <span
                                        className="text-xs tracking-[0.14em] uppercase"
                                        style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
                                      >
                                        {group.groupLabel}
                                      </span>
                                      <ChevronDown
                                        size={13}
                                        aria-hidden="true"
                                        style={{
                                          color: '#C9A84C',
                                          flexShrink: 0,
                                          transform: groupOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                          transition: 'transform 0.2s',
                                        }}
                                      />
                                    </button>

                                    <AnimatePresence initial={false}>
                                      {groupOpen && (
                                        <motion.ul
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: 'auto', opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          transition={{ duration: 0.18 }}
                                          className="overflow-hidden pl-3 space-y-0.5 pb-1"
                                        >
                                          {group.items.map((item) => (
                                            <li key={item.href}>
                                              <Link
                                                href={item.href}
                                                className="flex items-center gap-3 py-2.5 text-base transition-colors duration-200 hover:text-[#C9A84C] focus:outline-none"
                                                style={{
                                                  color: pathname === item.href ? '#C9A84C' : '#AAA',
                                                  fontFamily: 'Inter, sans-serif',
                                                  minHeight: '44px',
                                                }}
                                              >
                                                <span
                                                  className="h-px flex-shrink-0"
                                                  style={{ width: '10px', background: 'rgba(201,168,76,0.4)' }}
                                                />
                                                {item.label}
                                              </Link>
                                            </li>
                                          ))}
                                        </motion.ul>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                }

                /* ── Regular link ── */
                return (
                  <motion.div
                    key={entry.href}
                    style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link
                      href={entry.href!}
                      className="block py-4 text-2xl transition-colors duration-300 hover:text-[#C9A84C] focus:outline-none"
                      style={{
                        fontFamily: 'Playfair Display, Georgia, serif',
                        color: pathname === entry.href ? '#C9A84C' : '#E5E5E5',
                        minHeight: '44px',
                      }}
                      data-testid={`mobile-nav-link-${i}`}
                    >
                      {entry.label}
                    </Link>
                  </motion.div>
                );
              })}

              {/* Mobile CTAs */}
              <motion.div
                className="pt-6 space-y-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.38 }}
              >
                {ctaEntry && (
                  <Link
                    href={ctaEntry.href!}
                    className="flex items-center justify-center gap-2 px-6 py-4 rounded border text-base font-medium transition-colors hover:bg-[#C9A84C]/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C9A84C]"
                    style={{
                      borderColor: 'rgba(201,168,76,0.5)',
                      color: '#C9A84C',
                      fontFamily: 'Inter, sans-serif',
                      minHeight: '52px',
                    }}
                    data-testid="mobile-rezervasyon-cta"
                  >
                    {ctaEntry.label}
                  </Link>
                )}
                <a
                  href={SITE.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2.5 px-6 py-4 rounded text-base font-semibold focus:outline-none"
                  style={{
                    background: 'linear-gradient(135deg, #C9A84C, #E5C36A)',
                    color: '#0A0A0A',
                    fontFamily: 'Inter, sans-serif',
                    minHeight: '52px',
                  }}
                  data-testid="mobile-whatsapp-cta"
                >
                  <Phone size={18} aria-hidden="true" />
                  WhatsApp ile Ara
                </a>
              </motion.div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
