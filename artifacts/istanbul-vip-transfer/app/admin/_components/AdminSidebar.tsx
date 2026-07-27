'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Wrench,
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
} from 'lucide-react';

const GOLD = '#C9A84C';
const BG = '#111111';
const BG_HOVER = 'rgba(201,168,76,0.08)';
const BG_ACTIVE = 'rgba(201,168,76,0.14)';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { href: '/admin/sayfalar', label: 'Sayfalar', icon: <FileText size={18} /> },
  { href: '/admin/hizmetler', label: 'Hizmetler', icon: <Wrench size={18} /> },
  { href: '/admin/blog', label: 'Blog', icon: <BookOpen size={18} /> },
  { href: '/admin/sss', label: 'SSS', icon: <HelpCircle size={18} /> },
  { href: '/admin/menu', label: 'Menü Yönetimi', icon: <MenuIcon size={18} /> },
  { href: '/admin/ayarlar', label: 'Site Ayarları', icon: <Settings size={18} /> },
  { href: '/admin/ai-oneriler', label: 'AI İçerik Önerileri', icon: <Sparkles size={18} /> },
  { href: '/admin/gecmis', label: 'İşlem Geçmişi', icon: <History size={18} /> },
  { href: '/admin/hesabim', label: 'Hesabım', icon: <UserCircle size={18} /> },
];

interface Props {
  userName: string;
  userEmail: string;
  userRole: string;
}

export default function AdminSidebar({ userName, userEmail, userRole }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: BG,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: collapsed ? '20px 12px' : '20px 20px',
          borderBottom: '1px solid rgba(201,168,76,0.1)',
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
                color: '#444',
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
            background: 'none',
            border: 'none',
            color: '#555',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
          }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav
        style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}
        aria-label="Admin menüsü"
      >
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
                padding: collapsed ? '10px 12px' : '10px 12px',
                borderRadius: '8px',
                marginBottom: '2px',
                background: active ? BG_ACTIVE : 'transparent',
                color: active ? GOLD : '#777',
                textDecoration: 'none',
                fontSize: '13px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: active ? 600 : 400,
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLAnchorElement).style.background = BG_HOVER;
                if (!active) (e.currentTarget as HTMLAnchorElement).style.color = '#bbb';
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                if (!active) (e.currentTarget as HTMLAnchorElement).style.color = '#777';
              }}
            >
              <span style={{ flexShrink: 0, color: active ? GOLD : 'inherit' }}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout — flexShrink:0 keeps this section always visible;
           generous bottom padding clears the Next.js dev badge in development. */}
      <div style={{ borderTop: '1px solid rgba(201,168,76,0.1)', padding: '12px 8px 28px', flexShrink: 0 }}>
        {!collapsed && (
          <div
            style={{
              padding: '8px 12px',
              marginBottom: '4px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <div
              style={{
                color: '#ccc',
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
                color: '#555',
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
                opacity: 0.7,
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
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'none',
            border: 'none',
            color: '#666',
            cursor: loggingOut ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            justifyContent: collapsed ? 'center' : 'flex-start',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)';
            (e.currentTarget as HTMLButtonElement).style.color = '#f87171';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'none';
            (e.currentTarget as HTMLButtonElement).style.color = '#666';
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
          borderRight: '1px solid rgba(201,168,76,0.1)',
          transition: 'width 0.2s ease',
          /*
           * overflowX clips nav-item text during the collapse width transition.
           * overflowY must remain visible/auto so the inner flex column (which
           * has its own overflow-y:auto nav) can render a scrollbar when the
           * list of nav items is taller than the viewport.
           */
          overflowX: 'hidden',
          overflowY: 'visible',
        }}
      >
        {sidebarContent}
      </div>

      {/* Mobile top bar — className controls display; no inline display: so Tailwind's
           lg:hidden (display:none) is not overridden by an inline style at desktop widths. */}
      <div
        className="lg:hidden flex items-center"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          height: '56px',
          background: BG,
          borderBottom: '1px solid rgba(201,168,76,0.1)',
          padding: '0 16px',
          gap: '12px',
        }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Menüyü aç"
          style={{
            background: 'none',
            border: 'none',
            color: GOLD,
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
          }}
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
              background: 'rgba(0,0,0,0.7)',
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
              borderRight: '1px solid rgba(201,168,76,0.15)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                zIndex: 10,
              }}
            >
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Menüyü kapat"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#777',
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
