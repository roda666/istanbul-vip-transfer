/**
 * HizmetlerServiceGridCms — CMS-backed server component.
 *
 * Reads published service pages AND active categories from the DB.
 * Categories are DB-driven (sorted by sort_order, localised) so admin
 * changes propagate without a code deploy.
 *
 * Props:
 *   locale     — UI locale (tr, en, de, …)
 *   categories — pre-fetched from parent to avoid double-query (optional;
 *                falls back to fetching if omitted)
 */
import 'server-only';
import Link from 'next/link';
import { getPublishedServiceList } from '@/lib/service-page-cms-list';
import { getServiceCategories, type ServiceCategoryItem } from '@/lib/service-category-server';
import { RTL_LOCALES } from '@/lib/i18n/locale-registry';

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

function serviceHref(slug: string, locale: string): string {
  return locale === 'tr' ? `/${slug}` : `/${locale}/${slug}`;
}

interface Props {
  locale:     string;
  /** Pre-fetched category list from parent page. Falls back to DB if omitted. */
  categories?: ServiceCategoryItem[];
}

export default async function HizmetlerServiceGridCms({ locale, categories: catsProp }: Props) {
  const isRtl    = RTL_LOCALES.includes(locale);

  // Fetch in parallel
  const [services, categories] = await Promise.all([
    getPublishedServiceList(locale),
    catsProp ? Promise.resolve(catsProp) : getServiceCategories(locale),
  ]);

  if (services.length === 0) {
    return (
      <p style={{
        color: '#777', fontFamily: 'Inter, sans-serif', fontSize: '15px',
        textAlign: isRtl ? 'right' : 'left', padding: '20px 0',
      }}>
        {EMPTY_MSG[locale] ?? EMPTY_MSG.en}
      </p>
    );
  }

  // Group services by category slug
  const grouped = new Map<string, typeof services>();
  for (const svc of services) {
    const cat = svc.category ?? '__other__';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(svc);
  }

  // Build ordered group list: DB order first, then unknown slugs alphabetically
  const catOrder  = categories.map(c => c.slug);
  const catLabelMap = Object.fromEntries(categories.map(c => [c.slug, c.label]));

  const sortedGroups = [
    ...catOrder.filter(c => grouped.has(c)),
    ...[...grouped.keys()].filter(c => !catOrder.includes(c) && c !== '__other__').sort(),
    ...( grouped.has('__other__') ? ['__other__'] : []),
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
          : (catLabelMap[cat] ?? cat);

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
                      color: '#AAA', fontFamily: 'Inter, sans-serif',
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
