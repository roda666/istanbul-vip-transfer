'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Phone } from 'lucide-react';

const navLinks = [
  { label: 'Ana Sayfa', href: '/' },
  { label: 'Araçlar', href: '/araclar' },
  { label: 'Hizmetler', href: '/vip-transfer' },
  { label: 'Hakkımızda', href: '/hakkimizda' },
  { label: 'İletişim', href: '/iletisim' },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

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
              <Link href="/" className="flex flex-col leading-none group" data-testid="logo-link">
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

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-8" data-testid="desktop-nav">
              {navLinks.map((link, i) => {
                const isActive = pathname === link.href;
                return (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * i + 0.2, duration: 0.4 }}
                  >
                    <Link
                      href={link.href}
                      className="text-sm tracking-widest uppercase transition-colors duration-300 hover:text-[#C9A84C]"
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        letterSpacing: '0.1em',
                        color: isActive ? '#C9A84C' : '#999',
                      }}
                      data-testid={`nav-link-${i}`}
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            {/* WhatsApp CTA */}
            <motion.a
              href="https://wa.me/905326600847"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center gap-2.5 px-5 py-2.5 rounded text-sm font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #C9A84C, #E5C36A)',
                color: '#0A0A0A',
                fontFamily: 'Inter, sans-serif',
                letterSpacing: '0.03em',
              }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              data-testid="header-whatsapp-cta"
            >
              <Phone size={15} />
              WhatsApp ile Ara
            </motion.a>

            {/* Hamburger */}
            <button
              className="lg:hidden p-2 rounded text-[#C9A84C]"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menüyü aç/kapat"
              data-testid="hamburger-button"
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            data-testid="mobile-menu"
          >
            <div
              className="absolute inset-0 bg-[#0A0A0A]/95 backdrop-blur-2xl"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              className="absolute top-20 left-0 right-0 border-t border-[#C9A84C]/20 px-6 py-8 flex flex-col gap-6"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Link
                    href={link.href}
                    className="text-2xl transition-colors duration-300 hover:text-[#C9A84C]"
                    style={{
                      fontFamily: 'Playfair Display, Georgia, serif',
                      color: pathname === link.href ? '#C9A84C' : '#E5E5E5',
                    }}
                    data-testid={`mobile-nav-link-${i}`}
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
              <motion.a
                href="https://wa.me/905326600847"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center justify-center gap-2.5 px-6 py-4 rounded text-base font-semibold"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #E5C36A)', color: '#0A0A0A', fontFamily: 'Inter, sans-serif' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                data-testid="mobile-whatsapp-cta"
              >
                <Phone size={18} />
                WhatsApp ile Ara
              </motion.a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
