'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Wrench,
  Car,
  BookOpen,
  HelpCircle,
  Menu as MenuIcon,
  Settings,
  Sparkles,
  History,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  AlignLeft,
  UserCircle,
  CalendarClock,
  Globe,
  Languages,
} from 'lucide-react';

// ── Design tokens ─────────────────────────────────────────────────────────────
const SIDEBAR_BG   = '#132A44';
const SIDEBAR_BG2  = '#1B3858';
const GOLD         = '#C99A32';
const NAV_TEXT     = 'rgba(255,255,255,0.75)';
const NAV_MUTED    = 'rgba(255,255,255,0.4)';
const NAV_ACTIVE_BG = 'rgba(201,154,50,0.18)';
const NAV_HOVER_BG  = 'rgba(255,255,255,0.07)';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin/dashboard',   label: 'Dashboard',           icon: <LayoutDashboard size={18} /> },
  { href: '/admin/sayfalar',    label: 'Sayfalar',            icon: <FileText size={18} /> },
  { href: '/admin/hizmetler',   label: 'Hizmetler',           icon: <Wrench size={18} /> },
  { href: '/admin/araclar',           label: 'Araçlar',              icon: <Car size={18} /> },
  { href: '/admin/rezervasyon-ayarlari', label: 'Rezervasyon Ayarları', icon: <CalendarClock size={18} /> },
  { href: '/admin/blog',              label: 'Blog',                 icon: <BookOpen size={18} /> },
  { href: '/admin/diller',      label: 'Dil Yönetimi',        icon: <Globe size={18} /> },
  { href: '/admin/ceviriler',   label: 'Çeviriler',           icon: <Languages size={18} /> },
  { href: '/admin/sss',         label: 'SSS',                 icon: <HelpCircle size={18} /> },
  { href: '/admin/menu',        label: 'Menü Yönetimi',       icon: <MenuIcon size={18} /> },
  { href: '/admin/ayarlar',     label: 'Site Ayarları',       icon: <Settings size={18} /> },
  { href: '/admin/ai-oneriler', label: 'AI İçerik Önerileri', icon: <Sparkles size={18} /> },
  { href: '/admin/gecmis',      label: 'İşlem Geçmişi',       icon: <History size={18} /> },
  { href: '/admin/hesabim',     label: 'Hesabım',             icon: <UserCircle size={18} /> },
];

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

export default function AdminSidebar({ userName, userEmail, userRole }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/admin/api/logout', { method: 'POST' });
      router.push('/admin/login');
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  function isActive(href: string) {
    if (href === '/admin/dashboard') return pathname === href;
    return pathname.startsWith(href);
  }

  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: SIDEBAR_BG }}>
      {/* Logo */}
      <div
        style={{
          padding: collapsed ? '20px 12px' : '20px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          minHeight: '64px',
        }}
      >
        {!collapsed && (
          <div>
            <div
              style={{
                fontFamily: 'Playfair Display, Georgia, serif',
                color: GOLD,
                fontSize: '15px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              VIP Transfer
            </div>
            <div
              style={{
                color: 'rgba(255,255,255,0.35)',
                fontSize: '10px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                fontFamily: 'Inter, sans-serif',
                marginTop: '2px',
              }}
            >
              Admin
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
          className="hidden lg:flex items-center justify-center"
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            padding: '5px',
            borderRadius: '6px',
          }}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }} aria-label="Admin menüsü">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                marginBottom: '2px',
                background: active ? NAV_ACTIVE_BG : 'transparent',
                color: active ? GOLD : NAV_TEXT,
                textDecoration: 'none',
                fontSize: '13px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: active ? 600 : 400,
                transition: 'background 0.15s, color 0.15s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderLeft: active ? `3px solid ${GOLD}` : '3px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = NAV_HOVER_BG;
                  (e.currentTarget as HTMLAnchorElement).style.color = '#fff';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                  (e.currentTarget as HTMLAnchorElement).style.color = NAV_TEXT;
                }
              }}
            >
              <span style={{ flexShrink: 0, color: active ? GOLD : 'rgba(255,255,255,0.55)' }}>
                {item.icon}
              </span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 8px 28px', flexShrink: 0 }}>
        {!collapsed && (
          <div
            style={{
              padding: '10px 12px',
              marginBottom: '4px',
              borderRadius: '8px',
              background: SIDEBAR_BG2,
            }}
          >
            <div
              style={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: '13px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {userName}
            </div>
            <div
              style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: '11px',
                fontFamily: 'Inter, sans-serif',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginTop: '2px',
              }}
            >
              {userEmail}
            </div>
            <div
              style={{
                color: GOLD,
                fontSize: '10px',
                fontFamily: 'Inter, sans-serif',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginTop: '3px',
                opacity: 0.8,
              }}
            >
              {userRole.replace('_', ' ')}
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          title={collapsed ? 'Çıkış' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
            padding: '9px 12px',
            borderRadius: '8px',
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            cursor: loggingOut ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            justifyContent: collapsed ? 'center' : 'flex-start',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(214,69,69,0.15)';
            (e.currentTarget as HTMLButtonElement).style.color = '#FCA5A5';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'none';
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)';
          }}
        >
          <LogOut size={18} style={{ flexShrink: 0 }} />
          {!collapsed && <span>{loggingOut ? 'Çıkılıyor...' : 'Çıkış'}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div
        className="hidden lg:flex"
        style={{
          width: collapsed ? '60px' : '240px',
          flexShrink: 0,
          height: '100dvh',
          position: 'sticky',
          top: 0,
          borderRight: '1px solid rgba(0,0,0,0.08)',
          transition: 'width 0.2s ease',
          overflowX: 'hidden',
          overflowY: 'visible',
          boxShadow: '2px 0 12px rgba(19,42,68,0.12)',
        }}
      >
        {sidebarContent}
      </div>

      {/* Mobile top bar */}
      <div
        className="lg:hidden flex items-center"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          height: '56px',
          background: SIDEBAR_BG,
          borderBottom: '1px solid rgba(0,0,0,0.1)',
          padding: '0 16px',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(19,42,68,0.15)',
        }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Menüyü aç"
          style={{ background: 'none', border: 'none', color: GOLD, cursor: 'pointer', padding: '4px', display: 'flex' }}
        >
          <AlignLeft size={22} />
        </button>
        <span
          style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            color: GOLD,
            fontSize: '14px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          VIP Transfer Admin
        </span>
      </div>

      {/* Mobile offset */}
      <div className="lg:hidden" style={{ height: '56px', flexShrink: 0 }} />

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 55,
              background: 'rgba(19,42,68,0.6)',
              backdropFilter: 'blur(4px)',
            }}
            aria-hidden="true"
          />
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: '260px',
              zIndex: 60,
              borderRight: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '4px 0 20px rgba(19,42,68,0.3)',
            }}
          >
            <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10 }}>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Menüyü kapat"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  padding: '6px',
                  display: 'flex',
                }}
              >
                <X size={18} />
              </button>
            </div>
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
}
