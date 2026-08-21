'use client';

/**
 * LanguageSelector — dropdown that switches the user's language.
 *
 * Switch flow (atomic — no race condition):
 *   window.location.assign('/api/locale/switch?locale=<lang>&next=<path>')
 *
 * The switch endpoint sets the ivt_lang_pref cookie AND issues the redirect
 * in a single response.  Because the cookie arrives with the redirect, the
 * very next request the browser makes (the destination page) already carries
 * the new cookie — middleware cannot redirect back to the old locale.
 *
 * The previous two-step "fetch, then navigate" approach had a race: the
 * fetch could complete, the browser could start the navigation, and Next.js
 * middleware would see the stale cookie on the incoming GET and redirect back.
 */
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Globe, ChevronDown } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { SUPPORTED_LANGS, LANG_NATIVE_NAMES, type SiteLang } from '@/lib/i18n';
import { localePath } from '@/lib/locale-path';

interface PublicLang {
  code: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
}

/** Static fallback — mirrors the launched languages (used until /data/languages loads). */
const FALLBACK_LANGS: PublicLang[] = (['tr', ...SUPPORTED_LANGS] as SiteLang[]).map((code) => ({
  code,
  nativeName: LANG_NATIVE_NAMES[code],
  direction: code === 'ar' ? 'rtl' : 'ltr',
}));

/** Module-level cache so the selector fetches the DB-driven list only once per page load. */
let cachedLangs: PublicLang[] | null = null;

interface Props {
  /** Visual variant — dark background or light background. */
  variant?: 'light' | 'dark';
  className?: string;
}

export default function LanguageSelector({ variant = 'light', className = '' }: Props) {
  const { lang, dict } = useLang();
  const pathname = usePathname() ?? '/';
  const [open, setOpen]       = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [siteLangs, setSiteLangs] = useState<PublicLang[]>(cachedLangs ?? FALLBACK_LANGS);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Load the active + published language set from the DB (single source of truth).
  useEffect(() => {
    if (cachedLangs) return;
    let cancelled = false;
    fetch('/data/languages')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { items?: PublicLang[] } | null) => {
        if (cancelled || !data?.items?.length) return;
        cachedLangs = data.items;
        setSiteLangs(data.items);
      })
      .catch(() => { /* keep fallback */ });
    return () => { cancelled = true; };
  }, []);

  const nativeNameOf = (code: string) =>
    siteLangs.find((l) => l.code === code)?.nativeName ?? LANG_NATIVE_NAMES.en;

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

  function switchLocale(targetLang: string) {
    if (targetLang === lang || pending !== null) return;
    setOpen(false);
    setPending(targetLang);

    // Preserve hash (usePathname never includes the fragment — read it live)
    const hash = typeof window !== 'undefined' ? window.location.hash : '';

    // Strip existing lang prefix, apply new one; append any hash
    const targetPath = localePath(pathname, targetLang) + hash;

    // Single navigation to atomic switch endpoint:
    //   server sets cookie + redirects in ONE response → no race
    const params = new URLSearchParams({ locale: targetLang, next: targetPath });
    // /data/ prefix reaches Next.js directly; /api/* is intercepted by the
    // separate api-server artifact in this monorepo and never reaches Next.js.
    window.location.assign(`/data/locale/switch?${params.toString()}`);
  }

  const isDark          = variant === 'dark';
  const textColor       = isDark ? 'rgba(255,255,255,0.75)' : '#263F55';
  const textHover       = '#C99A32';
  const borderColor     = isDark ? 'rgba(255,255,255,0.15)' : '#D9E2EC';
  const dropdownBg      = isDark ? '#102A43' : '#FFFDF8';
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
          color:         pending ? '#aaa' : textColor,
          border:        `1px solid ${borderColor}`,
          background:    'transparent',
          fontFamily:    'Inter, sans-serif',
          letterSpacing: '0.03em',
          cursor:        pending ? 'wait' : 'pointer',
        }}
        onMouseEnter={(e) => { if (!pending) (e.currentTarget as HTMLButtonElement).style.color = textHover; }}
        onMouseLeave={(e) => { if (!pending) (e.currentTarget as HTMLButtonElement).style.color = textColor; }}
      >
        <Globe size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
        <span>
          {pending ? nativeNameOf(pending) : nativeNameOf(lang)}
        </span>
        <ChevronDown
          size={11}
          aria-hidden="true"
          style={{
            flexShrink: 0,
            transform:  open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s',
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
          {siteLangs.map((entry) => {
            const l = entry.code;
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
                  fontFamily: 'Inter, sans-serif',
                  color:      isActive ? activeLangColor : (isDark ? 'rgba(255,255,255,0.8)' : '#263F55'),
                  fontWeight: isActive ? 600 : 400,
                  background: isActive ? 'rgba(199,154,53,0.08)' : 'transparent',
                  textAlign:  'start',
                  cursor:     pending ? 'wait' : 'pointer',
                  border:     'none',
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
                {entry.nativeName}
                {entry.direction === 'rtl' && (
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
