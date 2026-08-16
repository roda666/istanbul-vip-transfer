'use client';

/**
 * TranslationNotice — shows a non-intrusive banner when a service page is
 * displayed with outdated or missing translations for the visitor's language.
 *
 * Props:
 *  status  — 'outdated' | 'missing' | null
 *  lang    — the requested locale code (e.g. 'en', 'de', 'fr')
 */

import { useState } from 'react';
import { Info, X } from 'lucide-react';

interface Props {
  status: 'outdated' | 'missing' | null;
  lang:   string;
}

const MESSAGES: Record<string, { outdated: string; missing: string }> = {
  en: {
    outdated: 'This page has been recently updated. A fresh translation is on the way.',
    missing:  'This page is not yet available in English. Currently showing Turkish content.',
  },
  de: {
    outdated: 'Diese Seite wurde kürzlich aktualisiert. Eine neue Übersetzung ist in Arbeit.',
    missing:  'Diese Seite ist noch nicht auf Deutsch verfügbar. Es wird der türkische Inhalt angezeigt.',
  },
  ru: {
    outdated: 'Эта страница была недавно обновлена. Новый перевод готовится.',
    missing:  'Эта страница пока недоступна на русском языке. Отображается турецкий контент.',
  },
  ar: {
    outdated: 'تم تحديث هذه الصفحة مؤخراً. الترجمة الجديدة قيد الإعداد.',
    missing:  'هذه الصفحة غير متوفرة باللغة العربية حتى الآن. يتم عرض المحتوى التركي.',
  },
  fr: {
    outdated: 'Cette page a été récemment mise à jour. Une nouvelle traduction est en cours.',
    missing:  'Cette page n\'est pas encore disponible en français. Le contenu turc est affiché.',
  },
  es: {
    outdated: 'Esta página fue actualizada recientemente. Se está preparando una nueva traducción.',
    missing:  'Esta página aún no está disponible en español. Se muestra el contenido en turco.',
  },
  it: {
    outdated: 'Questa pagina è stata aggiornata di recente. È in arrivo una nuova traduzione.',
    missing:  'Questa pagina non è ancora disponibile in italiano. Viene mostrato il contenuto in turco.',
  },
  nl: {
    outdated: 'Deze pagina is recentelijk bijgewerkt. Een nieuwe vertaling is onderweg.',
    missing:  'Deze pagina is nog niet beschikbaar in het Nederlands. De Turkse inhoud wordt weergegeven.',
  },
};

const FALLBACK = {
  outdated: 'This page was recently updated. A fresh translation is on the way.',
  missing:  'This page is not yet available in your language. Currently showing Turkish content.',
};

export default function TranslationNotice({ status, lang }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (!status || dismissed) return null;

  const msgs   = MESSAGES[lang] ?? FALLBACK;
  const text   = status === 'outdated' ? msgs.outdated : msgs.missing;
  const isRtl  = lang === 'ar';

  return (
    <div
      role="status"
      aria-live="polite"
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        gap:             '12px',
        padding:         '10px 16px',
        background:      '#EFF6FF',
        borderBottom:    '1px solid #BFDBFE',
        color:           '#1E40AF',
        fontSize:        '13px',
        lineHeight:      '1.5',
        fontFamily:      'Inter, system-ui, sans-serif',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Info size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
        {text}
      </span>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss notice"
        style={{
          background:   'transparent',
          border:       'none',
          cursor:       'pointer',
          padding:      '2px',
          color:        '#60A5FA',
          flexShrink:   0,
          display:      'flex',
          alignItems:   'center',
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
