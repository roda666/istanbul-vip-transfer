'use client';

/**
 * app/[lang]/not-found.tsx — Locale-aware 404 page (App Router).
 *
 * Triggered by notFound() calls within the [lang] segment.
 * Uses useParams() to read the current locale and serve the
 * appropriate translation.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';

const MESSAGES: Record<string, {
  label: string;
  heading: string;
  body: string;
  home: string;
  contact: string;
  dir: 'ltr' | 'rtl';
}> = {
  tr: {
    label:   "404 \u2014 Sayfa Bulunamad\u0131",
    heading: "Bu sayfa bulunamad\u0131",
    body:    "Arad\u0131\u011f\u0131n\u0131z sayfa ta\u015f\u0131nm\u0131\u015f, silinmi\u015f ya da hi\u00e7 var olmam\u0131\u015f olabilir.",
    home:    "Ana Sayfaya D\u00f6n",
    contact: "\u0130leti\u015fime Ge\u00e7",
    dir:     "ltr",
  },
  en: {
    label:   "404 \u2014 Page Not Found",
    heading: "This page doesn\u2019t exist",
    body:    "The page you are looking for may have moved, been deleted, or never existed.",
    home:    "Back to Home",
    contact: "Contact Us",
    dir:     "ltr",
  },
  de: {
    label:   "404 \u2014 Seite nicht gefunden",
    heading: "Diese Seite existiert nicht",
    body:    "Die gesuchte Seite wurde m\u00f6glicherweise verschoben, gel\u00f6scht oder hat nie existiert.",
    home:    "Zur Startseite",
    contact: "Kontakt",
    dir:     "ltr",
  },
  ru: {
    label:   "404 \u2014 \u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430",
    heading: "\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 \u043d\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442",
    body:    "\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430, \u043a\u043e\u0442\u043e\u0440\u0443\u044e \u0432\u044b \u0438\u0449\u0435\u0442\u0435, \u043c\u043e\u0433\u043b\u0430 \u0431\u044b\u0442\u044c \u043f\u0435\u0440\u0435\u043c\u0435\u0449\u0435\u043d\u0430, \u0443\u0434\u0430\u043b\u0435\u043d\u0430 \u0438\u043b\u0438 \u043d\u0438\u043a\u043e\u0433\u0434\u0430 \u043d\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u043e\u0432\u0430\u043b\u0430.",
    home:    "\u041d\u0430 \u0433\u043b\u0430\u0432\u043d\u0443\u044e",
    contact: "\u0421\u0432\u044f\u0437\u0430\u0442\u044c\u0441\u044f \u0441 \u043d\u0430\u043c\u0438",
    dir:     "ltr",
  },
  ar: {
    label:   "404 \u2014 \u0627\u0644\u0635\u0641\u062d\u0629 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f\u0629",
    heading: "\u0647\u0630\u0647 \u0627\u0644\u0635\u0641\u062d\u0629 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f\u0629",
    body:    "\u0631\u0628\u0645\u0627 \u062a\u0645 \u0646\u0642\u0644 \u0627\u0644\u0635\u0641\u062d\u0629 \u0623\u0648 \u062d\u0630\u0641\u0647\u0627 \u0623\u0648 \u0623\u0646\u0647\u0627 \u0644\u0645 \u062a\u0643\u0646 \u0645\u0648\u062c\u0648\u062f\u0629 \u0623\u0635\u0644\u0627\u064b.",
    home:    "\u0627\u0644\u0639\u0648\u062f\u0629 \u0625\u0644\u0649 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629",
    contact: "\u062a\u0648\u0627\u0635\u0644 \u0645\u0639\u0646\u0627",
    dir:     "rtl",
  },
  es: {
    label:   "404 \u2014 P\u00e1gina no encontrada",
    heading: "Esta p\u00e1gina no existe",
    body:    "Es posible que la p\u00e1gina que busca se haya movido, eliminado o nunca haya existido.",
    home:    "Volver al inicio",
    contact: "Contacto",
    dir:     "ltr",
  },
  fr: {
    label:   "404 \u2014 Page introuvable",
    heading: "Cette page n\u2019existe pas",
    body:    "La page que vous recherchez a peut-\u00eatre \u00e9t\u00e9 d\u00e9plac\u00e9e, supprim\u00e9e ou n\u2019a jamais exist\u00e9.",
    home:    "Retour \u00e0 l\u2019accueil",
    contact: "Nous contacter",
    dir:     "ltr",
  },
};

const FALLBACK = MESSAGES.tr;

export default function LangNotFound() {
  const params  = useParams();
  const lang    = (typeof params?.lang === 'string' ? params.lang : 'tr') as string;
  const t       = MESSAGES[lang] ?? FALLBACK;
  const homeHref    = lang === 'tr' ? '/' : `/${lang}`;
  const contactHref = lang === 'tr' ? '/iletisim' : `/${lang}/iletisim`;

  return (
    <div
      dir={t.dir}
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #0B1F33 0%, #102A43 60%, #1a3a5c 100%)',
        fontFamily: 'Inter, sans-serif',
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: 520, textAlign: 'center' }}>

        {/* Brand mark */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '2.5rem',
          padding: '0.6rem 1.2rem',
          background: 'rgba(201,154,50,0.15)',
          border: '1px solid rgba(201,154,50,0.3)',
          borderRadius: '999px',
        }}>
          <span style={{ color: '#C99A32', fontSize: '0.9rem' }}>✦</span>
          <span style={{ color: '#C99A32', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.04em' }}>
            Istanbul VIP Transfer
          </span>
        </div>

        {/* 404 */}
        <div style={{
          fontSize: 'clamp(5rem, 18vw, 8rem)',
          fontWeight: 800,
          lineHeight: 1,
          background: 'linear-gradient(135deg, #C99A32 0%, #e8c46a 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '1rem',
          letterSpacing: '-0.02em',
        }}>
          404
        </div>

        {/* Label */}
        <p style={{
          fontSize: '0.72rem',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#C99A32',
          marginBottom: '0.75rem',
        }}>
          {t.label}
        </p>

        {/* Heading */}
        <h1 style={{
          fontSize: 'clamp(1.25rem, 3.5vw, 1.75rem)',
          fontWeight: 700,
          color: '#fff',
          marginBottom: '1rem',
          lineHeight: 1.3,
        }}>
          {t.heading}
        </h1>

        {/* Body */}
        <p style={{
          fontSize: '0.95rem',
          color: 'rgba(255,255,255,0.65)',
          lineHeight: 1.75,
          marginBottom: '2.5rem',
          maxWidth: 400,
          margin: '0 auto 2.5rem',
        }}>
          {t.body}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href={homeHref}
            style={{
              padding: '0.8rem 1.75rem',
              background: '#C99A32',
              color: '#fff',
              borderRadius: '0.5rem',
              fontWeight: 700,
              fontSize: '0.9rem',
              textDecoration: 'none',
              display: 'inline-block',
              letterSpacing: '0.02em',
            }}
          >
            {t.home}
          </Link>
          <Link
            href={contactHref}
            style={{
              padding: '0.8rem 1.75rem',
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '0.5rem',
              fontWeight: 500,
              fontSize: '0.9rem',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            {t.contact}
          </Link>
        </div>

      </div>
    </div>
  );
}
