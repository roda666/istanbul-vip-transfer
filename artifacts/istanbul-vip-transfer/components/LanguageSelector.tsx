'use client';

/**
 * LanguageSelector — dropdown that switches the user's language.
 *
 * Switch flow:
 *  1. POST /api/locale   — sets ivt_lang_pref cookie server-side *before* navigation
 *  2. window.location.assign(targetPath) — full page load so middleware sees the
 *     updated cookie and server components re-render in the new locale
 *
 * This avoids the race where <Link> navigates to / while the cookie still says
 * "de", causing middleware to redirect straight back to /de.
 */
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Globe, ChevronDown } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { SUPPORTED_LANGS, LANG_NATIVE_NAMES, type SiteLang } from '@/lib/i18n';
import { localePath } from '@/lib/locale-path';

const ALL_SITE_LANGS: SiteLang[] = ['tr', ...SUPPORTED_LANGS];

interface Props {
  /** Visual variant — dark background or light background. */
  variant?: 'light' | 'dark';
  className?: string;
}

export default function LanguageSelector({ variant = 'light', className = '' }: Props) {
  const { lang, dict } = useLang();
  const pathname = usePathname() ?? '/';
  const [open, setOpen]         = useState(false);
  const [pending, setPending]   = useState<SiteLang | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onKey   = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e: MouseEvent)    => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown',   onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown',   onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  async function switchLocale(targetLang: SiteLang) {
    if (targetLang === lang || pending !== null) return;
    setOpen(false);
    setPending(targetLang);
    try {
      const res = await fetch('/api/locale', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ locale: targetLang }),
      });
      if (!res.ok) throw new Error(`/api/locale returned ${res.status}`);

      // Full navigation: middleware will see the updated cookie and serve the
      // correct locale without redirecting.
      const targetPath = localePath(pathname, targetLang);
      window.location.assign(targetPath);
    } catch (err) {
      console.error('[LanguageSelector] locale switch failed:', err);
      setPending(null);
    }
  }

  const isDark        = variant === 'dark';
  const textColor     = isDark ? 'rgba(255,255,255,0.75)' : '#263F55';
  const textHover     = '#C99A32';
  const borderColor   = isDark ? 'rgba(255,255,255,0.15)' : '#D9E2EC';
  const dropdownBg    = isDark ? '#102A43' : '#FFFDF8';
  const activeLangColor = '#C99A32';

  return (
    <div ref={wrapRef} className={`relative ${className}`} style={{ userSelect: 'none' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending !== null}
        aria-label={dict.langSelector.ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C79A35]"
        style={{
          color:       pending ? '#aaa' : textColor,
          border:      `1px solid ${borderColor}`,
          background:  'transparent',
          fontFamily:  'Inter, sans-serif',
          letterSpacing: '0.03em',
          cursor:      pending ? 'wait' : 'pointer',
        }}
        onMouseEnter={(e) => { if (!pending) (e.currentTarget as HTMLButtonElement).style.color = textHover; }}
        onMouseLeave={(e) => { if (!pending) (e.currentTarget as HTMLButtonElement).style.color = textColor; }}
      >
        <Globe size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
        <span>
          {pending
            ? (LANG_NATIVE_NAMES[pending] ?? LANG_NATIVE_NAMES.tr)
            : (LANG_NATIVE_NAMES[lang as SiteLang] ?? LANG_NATIVE_NAMES.tr)}
        </span>
        <ChevronDown
          size={11}
          aria-hidden="true"
          style={{
            flexShrink:  0,
            transform:   open ? 'rotate(180deg)' : 'none',
            transition:  'transform 0.15s',
          }}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={dict.langSelector.ariaLabel}
          className="absolute z-50 mt-1 rounded-xl shadow-xl overflow-hidden"
          style={{
            insetInlineEnd: 0,
            minWidth:       '150px',
            background:     dropdownBg,
            border:         `1px solid ${borderColor}`,
            boxShadow:      '0 8px 32px rgba(16,42,67,0.15)',
          }}
        >
          {ALL_SITE_LANGS.map((l) => {
            const isActive = l === lang;
            return (
              <button
                key={l}
                type="button"
                role="option"
                aria-selected={isActive}
                disabled={pending !== null}
                onClick={() => switchLocale(l)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors duration-150 focus:outline-none focus-visible:bg-[rgba(199,154,53,0.08)]"
                style={{
                  fontFamily:  'Inter, sans-serif',
                  color:       isActive ? activeLangColor : (isDark ? 'rgba(255,255,255,0.8)' : '#263F55'),
                  fontWeight:  isActive ? 600 : 400,
                  background:  isActive ? 'rgba(199,154,53,0.08)' : 'transparent',
                  textAlign:   'start',
                  cursor:      pending ? 'wait' : 'pointer',
                  border:      'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive && !pending)
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(199,154,53,0.06)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      isActive ? 'rgba(199,154,53,0.08)' : 'transparent';
                }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background: isActive ? '#C99A32' : 'transparent',
                    border:     isActive ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : '#D9E2EC'}`,
                  }}
                />
                {LANG_NATIVE_NAMES[l]}
                {l === 'ar' && (
                  <span
                    className="text-[9px] ml-auto"
                    style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#8899AA' }}
                  >
                    RTL
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
