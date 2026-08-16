/**
 * HizmetlerServiceGridCms — CMS-backed server component.
 *
 * Reads published service pages from the DB for the requested locale.
 * - TR: reads content table directly (always PUBLISHED source).
 * - non-TR: inner-joins content_translations (status = 'PUBLISHED' only).
 *           Services without a published translation are hidden.
 * - Falls back to an empty-state message on DB error (does NOT fall back to
 *   static nav-config data to avoid showing stale/incorrect service names).
 * - Preserves the existing visual design (group cards with link lists).
 * - Handles Arabic RTL automatically.
 */
import 'server-only';
import Link from 'next/link';
import { getPublishedServiceList } from '@/lib/service-page-cms-list';
import { RTL_LOCALES } from '@/lib/i18n/locale-registry';

// ── Category group labels (all 9 locales) ────────────────────────────────────

const CAT_LABELS: Record<string, Record<string, string>> = {
  airport: {
    tr: 'Havalimanı Transferleri',   en: 'Airport Transfers',            de: 'Flughafentransfers',
    ru: 'Трансферы в аэропорт',     ar: 'نقل المطار',                   fr: 'Transferts Aéroport',
    es: 'Traslados al Aeropuerto',   it: 'Transfer Aeroporto',           nl: 'Luchthaventransfers',
  },
  city_vip: {
    tr: 'VIP & Şehir İçi',          en: 'VIP & City Services',          de: 'VIP & Stadtdienste',
    ru: 'VIP и городские услуги',    ar: 'خدمات VIP والمدينة',           fr: 'VIP & Services Urbains',
    es: 'VIP & Servicios Urbanos',   it: 'VIP & Servizi Urbani',         nl: 'VIP & Stadsdiensten',
  },
  intercity: {
    tr: 'Şehirlerarası Transfer',    en: 'Intercity Transfer',           de: 'Intercity-Transfer',
    ru: 'Межгородской трансфер',     ar: 'نقل بين المدن',               fr: 'Transfert Interurbain',
    es: 'Traslado Interurbano',      it: 'Transfer Interurbano',         nl: 'Intercitytransfer',
  },
  tour: {
    tr: 'Günübirlik Turlar',         en: 'Day Tours',                    de: 'Tagestouren',
    ru: 'Однодневные экскурсии',     ar: 'جولات ليوم واحد',             fr: "Excursions d'une Journée",
    es: 'Excursiones de un Día',     it: 'Tour di un Giorno',            nl: 'Dagtochten',
  },
  special: {
    tr: 'Özel Hizmetler',            en: 'Special Services',             de: 'Sonderdienste',
    ru: 'Особые услуги',             ar: 'الخدمات الخاصة',              fr: 'Services Spéciaux',
    es: 'Servicios Especiales',      it: 'Servizi Speciali',             nl: 'Speciale Diensten',
  },
};

/** Canonical category order in the grid. */
const CAT_ORDER = ['airport', 'city_vip', 'intercity', 'tour', 'special'];

/** Empty-state strings in each locale. */
const EMPTY_MSG: Record<string, string> = {
  tr: 'Henüz yayımlanan hizmet sayfası bulunmuyor.',
  en: 'No services are published in English yet.',
  de: 'Noch keine Dienste auf Deutsch veröffentlicht.',
  ru: 'Пока нет опубликованных услуг на русском.',
  ar: 'لا توجد خدمات منشورة باللغة العربية حتى الآن.',
  fr: "Aucun service publié en français pour l'instant.",
  es: 'Aún no hay servicios publicados en español.',
  it: 'Nessun servizio pubblicato in italiano ancora.',
  nl: 'Er zijn nog geen diensten in het Nederlands gepubliceerd.',
};

function getCatLabel(cat: string, locale: string): string {
  return CAT_LABELS[cat]?.[locale] ?? CAT_LABELS[cat]?.['en'] ?? cat;
}

function serviceHref(slug: string, locale: string): string {
  return locale === 'tr' ? `/${slug}` : `/${locale}/${slug}`;
}

interface Props {
  locale: string;
}

export default async function HizmetlerServiceGridCms({ locale }: Props) {
  const isRtl    = RTL_LOCALES.includes(locale);
  const services = await getPublishedServiceList(locale);

  if (services.length === 0) {
    return (
      <p style={{
        color: '#777',
        fontFamily: 'Inter, sans-serif',
        fontSize: '15px',
        textAlign: isRtl ? 'right' : 'left',
        padding: '20px 0',
      }}>
        {EMPTY_MSG[locale] ?? EMPTY_MSG.en}
      </p>
    );
  }

  // Group by category, preserving CAT_ORDER for canonical groups
  const grouped = new Map<string, typeof services>();
  for (const svc of services) {
    const cat = svc.category ?? '__other__';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(svc);
  }

  // Sort groups: canonical order first, then alphabetical for unknowns
  const sortedGroups = [
    ...CAT_ORDER.filter((c) => grouped.has(c)),
    ...[...grouped.keys()].filter((c) => !CAT_ORDER.includes(c)).sort(),
  ];

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 gap-10"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {sortedGroups.map((cat) => {
        const items = grouped.get(cat)!;
        const groupLabel = cat === '__other__'
          ? (locale === 'tr' ? 'Diğer Hizmetler' : 'Other Services')
          : getCatLabel(cat, locale);

        return (
          <div
            id={`hiz-cat-${cat}`}
            key={cat}
            className="rounded-sm p-8"
            style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.12)', scrollMarginTop: '90px' }}
          >
            <h2
              className="text-xs tracking-[0.2em] uppercase mb-5"
              style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
            >
              {groupLabel}
            </h2>
            <ul className="space-y-3">
              {items.map((svc) => (
                <li key={svc.slug}>
                  <Link
                    href={serviceHref(svc.slug, locale)}
                    className="flex items-center gap-3 group transition-colors duration-200 hover:text-[#C9A84C]"
                    style={{
                      color: '#AAA',
                      fontFamily: 'Inter, sans-serif',
                      flexDirection: isRtl ? 'row-reverse' : 'row',
                    }}
                  >
                    <span
                      className="h-px flex-shrink-0 transition-all duration-200 group-hover:w-6"
                      style={{ width: '14px', background: 'rgba(201,168,76,0.5)' }}
                    />
                    <span className="text-sm">{svc.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
