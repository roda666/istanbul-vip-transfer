'use client';

/**
 * LangProvider — wraps public page sections with the active language context.
 * Detects the current language from the URL pathname automatically.
 * Turkish (tr) is the default when no lang prefix is present.
 */
import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { LangContext } from '@/lib/i18n/context';
import { getDictionary, SUPPORTED_LANGS } from '@/lib/i18n';

interface Props {
  children: React.ReactNode;
  /** Optionally force a specific lang (used in [lang]/layout to avoid double-detection). */
  forceLang?: string;
}

export default function LangProvider({ children, forceLang }: Props) {
  const pathname = usePathname();

  const lang = useMemo(() => {
    if (forceLang) return forceLang;
    if (!pathname) return 'tr';
    const segment = pathname.split('/')[1];
    return SUPPORTED_LANGS.includes(segment as (typeof SUPPORTED_LANGS)[number]) ? segment : 'tr';
  }, [pathname, forceLang]);

  const dict = useMemo(() => getDictionary(lang), [lang]);

  return (
    <LangContext.Provider value={{ lang, dict }}>
      {children}
    </LangContext.Provider>
  );
}
