import type { Metadata } from 'next';
import { getHomepageAdminRecord } from '@/lib/homepage-cms';
import HomepageEditor from './_HomepageEditor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ana Sayfa Düzenleyici | Admin',
  robots: { index: false, follow: false },
};

export default async function HomepageAdminPage() {
  // Pre-load Turkish source record for fast initial render
  const trRecord = await getHomepageAdminRecord('tr');

  // Catalog-driven editor locales: TR (source) + all ENABLED, provider-supported
  // languages. Enabling a language in Dil Yönetimi adds its tab here.
  let locales: Array<{ code: string; label: string; dir: 'ltr' | 'rtl'; isSource: boolean }> = [
    { code: 'tr', label: 'Türkçe', dir: 'ltr', isSource: true },
    { code: 'en', label: 'English', dir: 'ltr', isSource: false },
    { code: 'de', label: 'Deutsch', dir: 'ltr', isSource: false },
    { code: 'ru', label: 'Русский', dir: 'ltr', isSource: false },
    { code: 'ar', label: 'العربية', dir: 'rtl', isSource: false },
  ];
  try {
    const { db } = await import('@/db');
    const { languages } = await import('@/db/schema');
    const { and, eq, asc } = await import('drizzle-orm');
    const rows = await db
      .select({ code: languages.code, nativeName: languages.nativeName, direction: languages.direction })
      .from(languages)
      .where(and(eq(languages.isEnabled, true), eq(languages.providerSupported, true)))
      .orderBy(asc(languages.displayOrder));
    if (rows.length > 0) {
      locales = rows.map((r) => ({
        code: r.code,
        label: r.nativeName,
        dir: r.direction as 'ltr' | 'rtl',
        isSource: r.code === 'tr',
      }));
      if (!locales.some((l) => l.code === 'tr')) {
        locales.unshift({ code: 'tr', label: 'Türkçe', dir: 'ltr', isSource: true });
      }
    }
  } catch { /* keep static fallback */ }

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 28px) clamp(12px, 4vw, 24px)' }}>
      <HomepageEditor initialTrRecord={trRecord} locales={locales} />
    </div>
  );
}
