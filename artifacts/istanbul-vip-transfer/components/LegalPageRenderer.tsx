import type { LegalPage } from '@/lib/legal-page-cms';
import ArticleBody from '@/components/ArticleBody';
import Link from 'next/link';
import { localizedPublicPath } from '@/lib/localized-service-path';

interface Props {
  page:  LegalPage;
  lang:  string;
}

const UPDATED_LABELS: Record<string, string> = {
  tr: 'Son güncelleme',
  en: 'Last updated',
  de: 'Zuletzt aktualisiert',
  ru: 'Последнее обновление',
  ar: 'آخر تحديث',
  es: 'Última actualización',
  fr: 'Dernière mise à jour',
  it: 'Ultimo aggiornamento',
  nl: 'Laatst bijgewerkt',
};

const BREADCRUMB_HOME: Record<string, string> = {
  tr: 'Ana Sayfa', en: 'Home', de: 'Startseite', ru: 'Главная',
  ar: 'الرئيسية', es: 'Inicio', fr: 'Accueil', it: 'Home', nl: 'Home',
};

export default function LegalPageRenderer({ page, lang }: Props) {
  const updatedLabel = UPDATED_LABELS[lang] ?? 'Last updated';
  const homeLabel    = BREADCRUMB_HOME[lang] ?? 'Home';
  const lp           = (path: string) => localizedPublicPath(path, lang);

  const formattedDate = page.updatedAt
    ? new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : lang, {
        year: 'numeric', month: 'long', day: 'numeric',
      }).format(new Date(page.updatedAt))
    : null;

  return (
    <div style={{ minHeight: '70vh', background: '#F8FAFC' }}>
      {/* Hero */}
      <div
        style={{ background: '#102A43', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div
          className="max-w-4xl mx-auto px-5 md:px-8"
          style={{ paddingTop: '64px', paddingBottom: '56px' }}
        >
          {/* Breadcrumb */}
          <nav
            aria-label="breadcrumb"
            className="mb-5 flex items-center gap-2 text-xs"
            style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'Inter, sans-serif' }}
          >
            <Link
              href={lp('/')}
              style={{ color: 'rgba(255,255,255,0.55)' }}
              className="hover:text-white transition-colors"
            >
              {homeLabel}
            </Link>
            <span style={{ opacity: 0.4 }}>/</span>
            <span style={{ color: 'rgba(255,255,255,0.8)' }}>{page.title}</span>
          </nav>

          {/* Title */}
          <h1
            className="text-2xl md:text-3xl font-bold leading-tight"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#fff' }}
          >
            {page.title}
          </h1>

          {/* Excerpt */}
          {page.excerpt && (
            <p
              className="mt-4 text-sm leading-relaxed max-w-2xl"
              style={{ color: 'rgba(255,255,255,0.65)', fontFamily: 'Inter, sans-serif' }}
            >
              {page.excerpt}
            </p>
          )}

          {/* Updated date */}
          {formattedDate && (
            <p
              className="mt-6 text-xs"
              style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
            >
              {updatedLabel}: {formattedDate}
            </p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="max-w-4xl mx-auto px-5 md:px-8 py-12 md:py-16">
        <div
          style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '2rem 2.5rem',
            boxShadow: '0 1px 8px rgba(16,42,67,0.07)',
          }}
        >
          <ArticleBody body={page.body} />
        </div>
      </div>
    </div>
  );
}
