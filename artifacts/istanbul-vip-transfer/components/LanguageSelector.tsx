'use client';

/**
 * LanguageSelector — dropdown that switches the user's language.
 * Links to the equivalent page in the selected language.
 * Turkish is at root (/), other languages are at /[lang]/[path].
 */
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Globe, ChevronDown } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { SUPPORTED_LANGS, LANG_NATIVE_NAMES, type SiteLang } from '@/lib/i18n';

const ALL_SITE_LANGS: SiteLang[] = ['tr', ...SUPPORTED_LANGS];

/** Transforms a pathname + target lang into the corresponding URL. */
function getPathForLang(pathname: string, targetLang: string): string {
  // Strip any existing lang prefix
  let base = pathname;
  for (const l of SUPPORTED_LANGS) {
    if (base === `/${l}`) { base = '/'; break; }
    if (base.startsWith(`/${l}/`)) { base = base.slice(l.length + 1); break; }
  }
  if (!base.startsWith('/')) base = '/' + base;

  if (targetLang === 'tr') return base || '/';
  return base === '/' ? `/${targetLang}` : `/${targetLang}${base}`;
}

interface Props {
  /** Visual variant — dark background or light background. */
  variant?: 'light' | 'dark';
  className?: string;
}

export default function LanguageSelector({ variant = 'light', className = '' }: Props) {
  const { lang, dict } = useLang();
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const isDark = variant === 'dark';
  const textColor = isDark ? 'rgba(255,255,255,0.75)' : '#263F55';
  const textHover = isDark ? '#C99A32' : '#C99A32';
  const bgColor = isDark ? '#1B3A56' : '#FFFDF8';
  const borderColor = isDark ? 'rgba(255,255,255,0.15)' : '#D9E2EC';
  const dropdownBg = isDark ? '#102A43' : '#FFFDF8';
  const activeLangColor = '#C99A32';

  return (
    <div ref={wrapRef} className={`relative ${className}`} style={{ userSelect: 'none' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={dict.langSelector.ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C79A35]"
        style={{
          color: textColor,
          border: `1px solid ${borderColor}`,
          background: 'transparent',
          fontFamily: 'Inter, sans-serif',
          letterSpacing: '0.03em',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = textHover; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = textColor; }}
      >
        <Globe size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
        <span>{LANG_NATIVE_NAMES[lang as SiteLang] ?? LANG_NATIVE_NAMES.tr}</span>
        <ChevronDown
          size={11}
          aria-hidden="true"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={dict.langSelector.ariaLabel}
          className="absolute z-50 mt-1 rounded-xl shadow-xl overflow-hidden"
          style={{
            insetInlineEnd: 0,
            minWidth: '150px',
            background: dropdownBg,
            border: `1px solid ${borderColor}`,
            boxShadow: '0 8px 32px rgba(16,42,67,0.15)',
          }}
        >
          {ALL_SITE_LANGS.map((l) => {
            const href = getPathForLang(pathname, l);
            const isActive = l === lang;
            return (
              <Link
                key={l}
                href={href}
                role="option"
                aria-selected={isActive}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors duration-150 focus:outline-none focus-visible:bg-[rgba(199,154,53,0.08)]"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  color: isActive ? activeLangColor : (isDark ? 'rgba(255,255,255,0.8)' : '#263F55'),
                  fontWeight: isActive ? 600 : 400,
                  background: isActive ? 'rgba(199,154,53,0.08)' : 'transparent',
                  display: 'flex',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(199,154,53,0.06)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isActive ? '#C99A32' : 'transparent', border: isActive ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : '#D9E2EC'}` }} />
                {LANG_NATIVE_NAMES[l]}
                {l === 'ar' && (
                  <span className="text-[9px] ml-auto" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#8899AA' }}>RTL</span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
