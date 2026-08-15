import type { Metadata } from 'next';
import { getHomepageAdminRecord } from '@/lib/homepage-cms';
import { LOCALE_REGISTRY } from '@/lib/i18n/locale-registry';
import HomepageEditor from './_HomepageEditor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ana Sayfa Düzenleyici | Admin',
  robots: { index: false, follow: false },
};

/**
 * Static fallback derived from the single source of truth (LOCALE_REGISTRY).
 * Used when the DB is unavailable — always covers all 9 registry languages.
 * Never edit this list directly; update LOCALE_REGISTRY instead.
 */
const REGISTRY_FALLBACK = LOCALE_REGISTRY.map((l) => ({
  code:     l.code,
  label:    `${l.flagEmoji} ${l.nativeName}`,
  dir:      l.dir,
  isSource: l.isSource,
}));

export default async function HomepageAdminPage() {
  // Pre-load Turkish source record for fast initial render
  const trRecord = await getHomepageAdminRecord('tr');

  // Catalog-driven editor locales: TR (source) + all ENABLED, provider-supported
  // languages. Enabling a language in Dil Yönetimi adds its tab here.
  // Falls back to REGISTRY_FALLBACK (all 9 locales) if the DB is unavailable —
  // never falls back to a shorter hardcoded list.
  let locales = REGISTRY_FALLBACK;
  try {
    const { db }         = await import('@/db');
    const { languages }  = await import('@/db/schema');
    const { and, eq, asc } = await import('drizzle-orm');
    const rows = await db
      .select({ code: languages.code, nativeName: languages.nativeName, direction: languages.direction })
      .from(languages)
      .where(and(eq(languages.isEnabled, true), eq(languages.providerSupported, true)))
      .orderBy(asc(languages.displayOrder));
    if (rows.length > 0) {
      const dbLocales = rows.map((r) => ({
        code:     r.code,
        label:    r.nativeName,
        dir:      r.direction as 'ltr' | 'rtl',
        isSource: r.code === 'tr',
      }));
      // Ensure TR source is always present even if DB filtered it out
      if (!dbLocales.some((l) => l.code === 'tr')) {
        dbLocales.unshift({ code: 'tr', label: 'Türkçe', dir: 'ltr', isSource: true });
      }
      locales = dbLocales;
    }
    // If DB returns 0 rows (e.g. migration not yet applied), keep REGISTRY_FALLBACK
  } catch {
    // DB unavailable — REGISTRY_FALLBACK already assigned; all 9 locales visible
  }

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 28px) clamp(12px, 4vw, 24px)' }}>
      <HomepageEditor initialTrRecord={trRecord} locales={locales} />
    </div>
  );
}
