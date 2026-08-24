'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Wrench,
  Car,
  MapPin,
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
  Users,
  Tag,
  BarChart2,
  Database,
  Banknote,
  Plane,
  PackagePlus,
} from 'lucide-react';

// ── Design tokens ─────────────────────────────────────────────────────────────
const SIDEBAR_BG   = '#132A44';
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

// ── Nav group definitions ─────────────────────────────────────────────────────

interface NavGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
}

/** All nav groups for ADMIN / SUPER_ADMIN roles. Order matters. */
function getNavGroups(role: string, isSuperOrAdmin: boolean): NavGroup[] {
  return [
    {
      key: 'iletisim',
      label: 'Müşteri ve İletişim',
      icon: <MessageSquare size={16} />,
      items: [
        { href: '/admin/sohbet',           label: 'Canlı Sohbet',     icon: <MessageSquare size={18} /> },
        { href: '/admin/chatbot-bilgi-bankasi', label: 'Chatbot Bilgi Bankası', icon: <Database size={18} /> },
        { href: '/admin/bulten-aboneleri', label: 'Bülten Aboneleri', icon: <Mail size={18} /> },
      ],
    },
    {
      key: 'operasyon',
      label: 'Operasyon',
      icon: <ClipboardList size={16} />,
      items: [
        { href: '/admin/talepler',             label: 'Talepler',            icon: <ClipboardList size={18} /> },
        { href: '/admin/istatistikler',       label: 'İstatistikler',        icon: <BarChart2 size={18} /> },
        { href: '/admin/rezervasyon-ayarlari', label: 'Rezervasyon Ayarları', icon: <CalendarClock size={18} /> },
      ],
    },
    {
      key: 'transferler',
      label: 'Araçlar ve Transferler',
      icon: <Car size={16} />,
      items: [
        { href: '/admin/araclar',             label: 'Araçlar',             icon: <Car size={18} /> },
        { href: '/admin/transfer-rotalari',   label: 'Transfer Rotaları',   icon: <MapPin size={18} /> },
        { href: '/admin/fiyat-kurallari',     label: 'Fiyat Kuralları',     icon: <Banknote size={18} /> },
        { href: '/admin/ek-hizmetler',        label: 'Ek Hizmetler',        icon: <PackagePlus size={18} /> },
        { href: '/admin/ucus-karsilama',      label: 'Uçuşla Karşılama',    icon: <Plane size={18} /> },
      ],
    },
    ...(isSuperOrAdmin ? [{
      key: 'personel',
      label: 'Personel',
      icon: <Users size={16} />,
      items: [
        { href: '/admin/personel', label: 'Personel Yönetimi', icon: <Users size={18} /> },
      ],
    }] : []),
    {
      key: 'icerik',
      label: 'İçerik',
      icon: <BookOpen size={16} />,
      items: [
        { href: '/admin/blog',           label: 'Blog',            icon: <BookOpen size={18} /> },
        { href: '/admin/sayfalar',       label: 'Sayfalar',        icon: <FileText size={18} /> },
        { href: '/admin/hizmetler',      label: 'Hizmetler',       icon: <Wrench size={18} /> },
        { href: '/admin/kategoriler',    label: 'Kategoriler',     icon: <Tag size={18} /> },
        { href: '/admin/sss',            label: 'SSS',             icon: <HelpCircle size={18} /> },
        { href: '/admin/dil-ve-ceviri',  label: 'Dil ve Çeviri',  icon: <Languages size={18} /> },
        { href: '/admin/ai-studio',      label: 'İçerik Stüdyosu', icon: <PenSquare size={18} />, badge: 'AI' },
        { href: '/admin/ai-oneriler',    label: 'AI İçerik Merkezi', icon: <Sparkles size={18} /> },
      ],
    },
    {
      key: 'site',
      label: 'Sayfalar ve Site',
      icon: <LayoutDashboard size={16} />,
      items: [
        { href: '/admin/sayfalar/ana-sayfa', label: 'Ana Sayfa Düzenleyici', icon: <LayoutDashboard size={18} /> },
        { href: '/admin/menu',              label: 'Menü Yönetimi',          icon: <MenuIcon size={18} /> },
      ],
    },
    {
      key: 'ayarlar',
      label: 'Ayarlar',
      icon: <Settings size={16} />,
      items: [
        { href: '/admin/e-posta-ayarlari',                  label: 'E-posta Ayarları',       icon: <MailOpen size={18} /> },
        ...(role === 'SUPER_ADMIN' ? [{ href: '/admin/veritabani-yedegi', label: 'Veritabanı Yedeği', icon: <History size={18} /> }] : []),
        { href: '/admin/ayarlar',                           label: 'Site Ayarları',           icon: <Settings size={18} /> },
        { href: '/admin/ayarlar/icerik-entegrasyonlari',    label: 'İçerik Entegrasyonları', icon: <Settings size={18} /> },
        { href: '/admin/gecmis',                            label: 'İşlem Geçmişi',          icon: <History size={18} /> },
        { href: '/admin/hesabim',                           label: 'Hesabım',               icon: <UserCircle size={18} /> },
      ],
    },
  ].sort((left, right) => {
    const order = ['operasyon', 'transferler', 'iletisim', 'personel', 'icerik', 'site', 'ayarlar'];
    return order.indexOf(left.key) - order.indexOf(right.key);
  });
}

const CHAT_STAFF_ITEMS: NavItem[] = [
  { href: '/admin/sohbet', label: 'Canlı Sohbet', icon: <MessageSquare size={18} /> },
  { href: '/admin/hesabim', label: 'Hesabım', icon: <UserCircle size={18} /> },
];

// ── NavGroup collapsible section ──────────────────────────────────────────────
function NavGroup({ group, collapsed, openGroups, toggleGroup, renderNavItem }: {
  group: NavGroup;
  collapsed: boolean;
  openGroups: Set<string>;
  toggleGroup: (key: string) => void;
  renderNavItem: (item: NavItem) => React.ReactNode;
}) {
  const isOpen = openGroups.has(group.key);
  return (
    <section style={{ marginBottom: '8px' }}>
      {!collapsed && (
        <button
          onClick={() => toggleGroup(group.key)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', minHeight: '42px', padding: '9px 11px',
            background: isOpen ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)', cursor: 'pointer',
            borderRadius: '8px', transition: 'background 0.15s, border-color 0.15s',
          }}
          aria-expanded={isOpen}
          aria-controls={`admin-nav-group-${group.key}`}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.02em', color: 'rgba(255,255,255,0.90)' }}>
            <span style={{ color: GOLD, display: 'inline-flex' }}>{group.icon}</span>
            {group.label}
          </span>
          <ChevronRight
            size={16}
            style={{ color: 'rgba(255,255,255,0.75)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}
          />
        </button>
      )}
      <div id={`admin-nav-group-${group.key}`} style={{ paddingTop: collapsed ? 0 : '4px' }}>
        {(isOpen || collapsed) && group.items.map(item => renderNavItem(item))}
      </div>
    </section>
  );
}

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
  const [newCount,    setNewCount]    = useState(0);
  const [chatCount,   setChatCount]   = useState(0);
  const [studioCount, setStudioCount] = useState(0);
  const [groupPreferencesReady, setGroupPreferencesReady] = useState(false);

  const isChatStaff    = userRole === 'CHAT_STAFF';
  const isSuperOrAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

  // All groups begin open. Stored choices are restored after mount, while the
  // active route remains accessible even if it was previously collapsed.
  function getDefaultOpen(): Set<string> {
    return new Set(getNavGroups(userRole, isSuperOrAdmin).map(group => group.key));
  }
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => getDefaultOpen());

  useEffect(() => {
    const groups = getNavGroups(userRole, isSuperOrAdmin);
    const validKeys = new Set(groups.map(group => group.key));
    const activeKeys = groups
      .filter(group => group.items.some(item => pathname === item.href || pathname.startsWith(item.href + '/')))
      .map(group => group.key);
    try {
      const saved = window.localStorage.getItem('istanbul-vip-admin-open-nav-groups');
      const parsed = saved ? JSON.parse(saved) : null;
      const restored = Array.isArray(parsed)
        ? parsed.filter((key): key is string => typeof key === 'string' && validKeys.has(key))
        : [...validKeys];
      setOpenGroups(new Set([...restored, ...activeKeys]));
    } catch {
      setOpenGroups(new Set([...validKeys, ...activeKeys]));
    } finally {
      setGroupPreferencesReady(true);
    }
  }, [pathname, userRole, isSuperOrAdmin]);

  useEffect(() => {
    if (!groupPreferencesReady) return;
    try {
      window.localStorage.setItem('istanbul-vip-admin-open-nav-groups', JSON.stringify([...openGroups]));
    } catch {
      // Navigation remains fully usable when browser storage is unavailable.
    }
  }, [openGroups, groupPreferencesReady]);

  function isGroupActive(key: string) {
    return getNavGroups(userRole, isSuperOrAdmin)
      .find(group => group.key === key)
      ?.items.some(item => pathname === item.href || pathname.startsWith(item.href + '/')) ?? false;
  }

  function toggleGroup(key: string) {
    setOpenGroups(prev => {
      if (prev.has(key) && isGroupActive(key)) return prev;
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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

  // Unread chat badge — polls every 30 s; unauthorized roles simply render no count.
  useEffect(() => {
    let active = true;
    async function fetchChatCount() {
      try {
        const res = await fetch('/admin/api/chatbot/unread-count');
        if (!res.ok) return;
        const data = await res.json() as { count: number };
        if (active) setChatCount(data.count ?? 0);
      } catch { /* ignore */ }
    }
    fetchChatCount();
    const id = setInterval(fetchChatCount, 30_000);
    return () => { active = false; clearInterval(id); };
  }, []);

  // Studio pending draft badge — polls every 60 s
  useEffect(() => {
    let active = true;
    async function fetchStudioCount() {
      try {
        const res = await fetch('/admin/api/studio/pending-count');
        if (!res.ok) return;
        const data = await res.json() as { count: number };
        if (active) setStudioCount(data.count ?? 0);
      } catch { /* ignore */ }
    }
    fetchStudioCount();
    const id = setInterval(fetchStudioCount, 60_000);
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
      await fetch('/admin/api/logout', { method: 'POST' });
    } finally {
      router.push('/admin/login');
    }
  }

  function isActive(href: string) {
    if (href === '/admin/dashboard') return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  }

  function renderNavItem(item: NavItem) {
    const active   = isActive(item.href);
    const hasBadge = !!item.badge;
    const count    = item.href === '/admin/talepler'  ? newCount
                   : item.href === '/admin/sohbet'    ? chatCount
                   : item.href === '/admin/ai-studio' ? studioCount
                   : 0;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? item.label : undefined}
        style={{ textDecoration: 'none', display: 'block', marginBottom: '3px' }}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            minHeight: '44px',
            padding: collapsed ? '11px' : '11px 12px',
            borderRadius: '8px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            background: active ? NAV_ACTIVE_BG : 'transparent',
            transition: 'background 0.15s',
            position: 'relative',
          }}
          onMouseEnter={e => { if (!active) e.currentTarget.style.background = NAV_HOVER_BG; }}
          onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ color: active ? GOLD : NAV_TEXT, flexShrink: 0, position: 'relative' }}>
            {item.icon}
            {collapsed && count > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, borderRadius: '50%', background: '#EF4444', border: '1.5px solid ' + SIDEBAR_BG }} />
            )}
          </span>
          {!collapsed && (
            <>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', lineHeight: 1.3, color: active ? '#fff' : 'rgba(255,255,255,0.86)', fontWeight: active ? 700 : 500, flex: 1, minWidth: 0 }}>
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
      <nav style={{ flex: 1, padding: '8px 8px 12px', overflowY: 'auto' }}>
        {isChatStaff ? (
          /* CHAT_STAFF: flat list — no groups */
          CHAT_STAFF_ITEMS.map(item => renderNavItem(item))
        ) : (
          <>
            {/* Dashboard always first, standalone */}
            {renderNavItem({ href: '/admin/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> })}
            {/* Grouped sections */}
            {getNavGroups(userRole, isSuperOrAdmin).map(group => (
              <NavGroup
                key={group.key}
                group={group}
                collapsed={collapsed}
                openGroups={openGroups}
                toggleGroup={toggleGroup}
                renderNavItem={renderNavItem}
              />
            ))}
          </>
        )}
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
          width:    collapsed ? '64px' : '280px',
          minWidth: collapsed ? '64px' : '280px',
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
              {isChatStaff ? (
                CHAT_STAFF_ITEMS.map(item => renderNavItem(item))
              ) : (
                <>
                  {renderNavItem({ href: '/admin/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> })}
                  {getNavGroups(userRole, isSuperOrAdmin).map(group => (
                    <NavGroup
                      key={group.key}
                      group={group}
                      collapsed={false}
                      openGroups={openGroups}
                      toggleGroup={toggleGroup}
                      renderNavItem={renderNavItem}
                    />
                  ))}
                </>
              )}
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
