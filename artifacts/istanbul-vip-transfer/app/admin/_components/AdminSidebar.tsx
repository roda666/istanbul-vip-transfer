'use client';

import { useState, useEffect } from 'react';
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
  Languages,
  ClipboardList,
  Mail,
  MailOpen,
  MessageSquare,
  PenSquare,
} from 'lucide-react';

// ── Design tokens ─────────────────────────────────────────────────────────────
const SIDEBAR_BG   = '#132A44';
const SIDEBAR_BG2  = '#1B3858';
const GOLD         = '#C99A32';
const NAV_TEXT     = 'rgba(255,255,255,0.75)';
const NAV_ACTIVE_BG = 'rgba(201,154,50,0.18)';
const NAV_HOVER_BG  = 'rgba(255,255,255,0.07)';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin/dashboard',        label: 'Dashboard',             icon: <LayoutDashboard size={18} /> },
  { href: '/admin/talepler',         label: 'Talepler',              icon: <ClipboardList size={18} /> },
  { href: '/admin/sohbet',           label: 'Canlı Sohbet',          icon: <MessageSquare size={18} /> },
  { href: '/admin/bulten-aboneleri', label: 'Bülten Aboneleri',      icon: <Mail size={18} /> },
  { href: '/admin/sayfalar/ana-sayfa', label: 'Ana Sayfa Düzenleyici', icon: <LayoutDashboard size={18} /> },
  { href: '/admin/sayfalar',         label: 'Sayfalar',              icon: <FileText size={18} /> },
  { href: '/admin/hizmetler',        label: 'Hizmetler',             icon: <Wrench size={18} /> },
  { href: '/admin/araclar',          label: 'Araçlar',               icon: <Car size={18} /> },
  { href: '/admin/rezervasyon-ayarlari', label: 'Rezervasyon Ayarları', icon: <CalendarClock size={18} /> },
  { href: '/admin/blog',             label: 'Blog',                  icon: <BookOpen size={18} /> },
  { href: '/admin/dil-ve-ceviri',    label: 'Dil ve Çeviri',         icon: <Languages size={18} /> },
  { href: '/admin/sss',              label: 'SSS',                   icon: <HelpCircle size={18} /> },
  { href: '/admin/menu',             label: 'Menü Yönetimi',         icon: <MenuIcon size={18} /> },
  { href: '/admin/e-posta-ayarlari', label: 'E-posta Ayarları',      icon: <MailOpen size={18} /> },
  { href: '/admin/ayarlar',          label: 'Site Ayarları',         icon: <Settings size={18} /> },
  { href: '/admin/ayarlar/icerik-entegrasyonlari', label: 'İçerik Entegrasyonları', icon: <Settings size={18} /> },
  // ── AI Studio (new) ──────────────────────────────────────────────────────
  { href: '/admin/ai-studio',        label: 'İçerik Stüdyosu',      icon: <PenSquare size={18} />, badge: 'AI' },
  { href: '/admin/ai-oneriler',      label: 'AI İçerik Merkezi',    icon: <Sparkles size={18} /> },
  { href: '/admin/gecmis',           label: 'İşlem Geçmişi',        icon: <History size={18} /> },
  { href: '/admin/hesabim',          label: 'Hesabım',              icon: <UserCircle size={18} /> },
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
  const [newCount, setNewCount]     = useState(0);

  useEffect(() => {
    let active = true;
    async function fetchCount() {
      try {
        const res = await fetch('/admin/api/requests/count');
        if (!res.ok) return;
        const data = await res.json() as { count: number };
        if (active) setNewCount(data.count ?? 0);
      } catch { /* ignore */ }
    }
    fetchCount();
    const id = setInterval(fetchCount, 60_000);
    return () => { active = false; clearInterval(id); };
  }, []);

  // Lock body scroll while mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/admin/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/admin/login');
    }
  }

  function isActive(href: string) {
    if (href === '/admin/dashboard') return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  }

  const sidebarContent = (
    <div style={{
      background: SIDEBAR_BG,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* Logo row */}
      <div style={{
        padding: collapsed ? '20px 12px' : '20px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        flexShrink: 0,
      }}>
        {!collapsed && (
          <div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 700, color: GOLD, margin: 0, letterSpacing: '0.02em' }}>
              VIP Transfer
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: 'rgba(255,255,255,0.45)', margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Admin Panel
            </p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '6px', display: 'flex' }}
          aria-label={collapsed ? 'Genişlet' : 'Daralt'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {NAV_ITEMS.map(item => {
          const active = isActive(item.href);
          const hasBadge = !!item.badge;
          const count = item.href === '/admin/talepler' ? newCount : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              style={{ textDecoration: 'none', display: 'block', marginBottom: '2px' }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: collapsed ? '9px' : '9px 12px',
                borderRadius: '8px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: active ? NAV_ACTIVE_BG : 'transparent',
                transition: 'background 0.15s',
                position: 'relative',
              }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = NAV_HOVER_BG; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ color: active ? GOLD : NAV_TEXT, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && (
                  <>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: active ? '#fff' : NAV_TEXT, fontWeight: active ? 600 : 400, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label}
                    </span>
                    {hasBadge && (
                      <span style={{ fontSize: '9px', fontFamily: 'Inter, sans-serif', fontWeight: 700, background: GOLD, color: '#fff', padding: '1px 5px', borderRadius: '4px', letterSpacing: '0.05em' }}>
                        {item.badge}
                      </span>
                    )}
                    {count > 0 && (
                      <span style={{ fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 700, background: '#EF4444', color: '#fff', borderRadius: '10px', padding: '1px 6px', minWidth: '18px', textAlign: 'center' }}>
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </>
                )}
                {active && (
                  <div style={{ position: 'absolute', left: 0, top: '6px', bottom: '6px', width: '3px', background: GOLD, borderRadius: '0 2px 2px 0' }} />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: collapsed ? '12px 8px' : '12px 14px', flexShrink: 0 }}>
        {!collapsed && (
          <div style={{ marginBottom: '8px' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.45)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: collapsed ? '8px' : '8px 10px',
            width: '100%', borderRadius: '7px', border: 'none',
            background: 'rgba(255,255,255,0.06)', cursor: 'pointer',
            color: 'rgba(255,255,255,0.6)', justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          <LogOut size={16} />
          {!collapsed && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>{loggingOut ? 'Çıkılıyor…' : 'Çıkış Yap'}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div
        style={{
          width:    collapsed ? '60px' : '220px',
          minWidth: collapsed ? '60px' : '220px',
          height: '100vh',
          position: 'sticky',
          top: 0,
          flexShrink: 0,
          transition: 'width 0.2s',
          display: 'none',
        }}
        className="admin-sidebar-desktop"
      >
        {sidebarContent}
      </div>

      {/* Mobile hamburger — 44×44 touch target */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Menüyü aç"
        className="admin-sidebar-hamburger"
        style={{
          display: 'none',
          position: 'fixed',
          top: '6px',
          left: '6px',
          zIndex: 70,
          background: SIDEBAR_BG,
          border: 'none',
          borderRadius: '8px',
          color: '#fff',
          cursor: 'pointer',
          minWidth: '44px',
          minHeight: '44px',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AlignLeft size={20} />
      </button>

      {/* Mobile drawer ─ three fixed regions: header / scrollable nav / footer */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 55,
              background: 'rgba(19,42,68,0.6)', backdropFilter: 'blur(4px)',
            }}
            aria-hidden="true"
          />

          {/* Drawer shell — never overflows, flex column fills 100dvh */}
          <div style={{
            position: 'fixed',
            inset: '0 auto 0 0',
            width: 'min(86vw, 340px)',
            height: '100dvh',
            zIndex: 60,
            background: SIDEBAR_BG,
            borderRight: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '4px 0 24px rgba(0,0,0,0.45)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>

            {/* ① HEADER — fixed height, brand + close button, never clipped */}
            <div style={{
              flexShrink: 0,
              minHeight: '96px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              paddingTop: 'max(16px, env(safe-area-inset-top))',
              paddingBottom: '12px',
              paddingLeft: '18px',
              paddingRight: '10px',
              borderBottom: '1px solid rgba(255,255,255,0.10)',
              boxSizing: 'border-box',
            }}>
              {/* Brand — two-line, no truncation */}
              <div>
                <p style={{
                  fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 700,
                  color: GOLD, margin: 0, letterSpacing: '0.02em', lineHeight: 1.3,
                }}>
                  VIP Transfer
                </p>
                <p style={{
                  fontFamily: 'Inter, sans-serif', fontSize: '10px',
                  color: 'rgba(255,255,255,0.5)', margin: '3px 0 0',
                  letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1,
                }}>
                  Admin Panel
                </p>
              </div>

              {/* Close button — 44×44, no overlap */}
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Menüyü kapat"
                style={{
                  flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: '44px', minHeight: '44px',
                  background: 'rgba(255,255,255,0.10)',
                  border: 'none', borderRadius: '8px',
                  color: 'rgba(255,255,255,0.80)', cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* ② NAV — flex:1 + min-height:0 forces it to fill remaining space and scroll */}
            <nav style={{
              flex: 1,
              minHeight: 0,           /* ← critical: prevents nav from growing past container */
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '10px 8px',
              WebkitOverflowScrolling: 'touch',
            }}>
              {NAV_ITEMS.map(item => {
                const active = isActive(item.href);
                const count = item.href === '/admin/talepler' ? newCount : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    style={{ textDecoration: 'none', display: 'block', marginBottom: '2px' }}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '11px 12px', borderRadius: '8px',
                      minHeight: '44px',
                      background: active ? NAV_ACTIVE_BG : 'transparent',
                      transition: 'background 0.15s', position: 'relative',
                    }}>
                      <span style={{ color: active ? GOLD : NAV_TEXT, flexShrink: 0 }}>
                        {item.icon}
                      </span>
                      <span style={{
                        fontFamily: 'Inter, sans-serif', fontSize: '13px',
                        color: active ? '#fff' : NAV_TEXT,
                        fontWeight: active ? 600 : 400,
                        flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {item.label}
                      </span>
                      {item.badge && (
                        <span style={{
                          fontSize: '9px', fontFamily: 'Inter, sans-serif', fontWeight: 700,
                          background: GOLD, color: '#fff', padding: '1px 5px',
                          borderRadius: '4px', letterSpacing: '0.05em',
                        }}>
                          {item.badge}
                        </span>
                      )}
                      {count > 0 && (
                        <span style={{
                          fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 700,
                          background: '#EF4444', color: '#fff', borderRadius: '10px',
                          padding: '1px 6px', minWidth: '18px', textAlign: 'center',
                        }}>
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                      {active && (
                        <div style={{
                          position: 'absolute', left: 0, top: '6px', bottom: '6px',
                          width: '3px', background: GOLD, borderRadius: '0 2px 2px 0',
                        }} />
                      )}
                    </div>
                  </Link>
                );
              })}
            </nav>

            {/* ③ FOOTER — always visible, safe bottom inset */}
            <div style={{
              flexShrink: 0,
              borderTop: '1px solid rgba(255,255,255,0.10)',
              paddingTop: '12px',
              paddingLeft: '14px',
              paddingRight: '14px',
              paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
            }}>
              <div style={{ marginBottom: '8px' }}>
                <p style={{
                  fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600,
                  color: '#fff', margin: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {userName}
                </p>
                <p style={{
                  fontFamily: 'Inter, sans-serif', fontSize: '11px',
                  color: 'rgba(255,255,255,0.45)', margin: '2px 0 0',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {userEmail}
                </p>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '0 12px',
                  width: '100%', minHeight: '44px',
                  borderRadius: '7px', border: 'none',
                  background: 'rgba(255,255,255,0.07)', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.65)',
                }}
              >
                <LogOut size={16} />
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
                  {loggingOut ? 'Çıkılıyor…' : 'Çıkış Yap'}
                </span>
              </button>
            </div>

          </div>
        </>
      )}

      <style>{`
        @media (min-width: 769px) { .admin-sidebar-desktop { display: block !important; } }
        @media (max-width: 768px) { .admin-sidebar-hamburger { display: flex !important; } }
      `}</style>
    </>
  );
}
