/**
 * HizmetlerServiceGridCms — CMS-backed server component.
 *
 * Renders service pages as image cards (consistent with blog listing).
 * Groups by category; each service shows: thumbnail, title, excerpt, link.
 *
 * Props:
 *   locale     — UI locale (tr, en, de, …)
 *   categories — pre-fetched from parent to avoid double-query (optional)
 */
import 'server-only';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { getPublicServiceCatalog } from '@/lib/public-service-catalog';
import type {
  PublicServiceCatalogItem,
  PublicServiceCategory,
} from '@/lib/public-service-catalog-types';
import { RTL_LOCALES } from '@/lib/i18n/locale-registry';
import { isolateLtrValues } from '@/lib/i18n/bidi';
import { localizedServiceCategoryPath, localizedServicePath } from '@/lib/localized-service-path';

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

const MORE_LABEL: Record<string, string> = {
  tr: 'Detayları Gör',
  en: 'View Details',
  de: 'Details ansehen',
  ru: 'Подробнее',
  ar: 'عرض التفاصيل',
  fr: 'Voir les détails',
  es: 'Ver detalles',
  it: 'Visualizza dettagli',
  nl: 'Details bekijken',
};

const OTHER_LABEL: Record<string, string> = {
  tr: 'Diğer Hizmetler', en: 'Other Services', de: 'Weitere Dienstleistungen',
  ru: 'Другие услуги', ar: 'خدمات أخرى', fr: 'Autres services',
  es: 'Otros servicios', it: 'Altri servizi', nl: 'Andere diensten',
};

function serviceHref(slug: string, locale: string): string {
  return localizedServicePath(slug, locale);
}

interface Props {
  locale:       string;
  categories?:  PublicServiceCategory[];
  services?:    PublicServiceCatalogItem[];
  categorySlug?: string;
}

export default async function HizmetlerServiceGridCms({
  locale,
  categories: catsProp,
  services: servicesProp,
  categorySlug,
}: Props) {
  const isRtl = RTL_LOCALES.includes(locale);
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const moreLabel = MORE_LABEL[locale] ?? MORE_LABEL.en;

  const catalog = await getPublicServiceCatalog(locale);
  const services = servicesProp ?? catalog.services;
  const categories = catsProp ?? catalog.categories;

  const visibleServices = categorySlug
    ? services.filter((service) => service.category === categorySlug)
    : services;

  if (visibleServices.length === 0) {
    return (
      <p style={{
        color: '#596775', fontFamily: 'Inter, sans-serif', fontSize: '15px',
        textAlign: isRtl ? 'right' : 'left', padding: '20px 0',
      }}>
        {EMPTY_MSG[locale] ?? EMPTY_MSG.en}
      </p>
    );
  }

  // Group services by category slug
  const grouped = new Map<string, typeof services>();
  for (const svc of visibleServices) {
    const cat = svc.category ?? '__other__';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(svc);
  }

  const catOrder   = categories.map(c => c.slug);
  const catLabelMap = Object.fromEntries(categories.map(c => [c.slug, c.label]));

  const sortedGroups = [
    ...catOrder.filter(c => grouped.has(c)),
    ...[...grouped.keys()].filter(c => !catOrder.includes(c) && c !== '__other__').sort(),
    ...(grouped.has('__other__') ? ['__other__'] : []),
  ];

  return (
    <div className="ivt-service-grid" dir={isRtl ? 'rtl' : 'ltr'} style={{ display: 'flex', flexDirection: 'column', gap: '52px' }}>
      {sortedGroups.map((cat, catIdx) => {
        const items = grouped.get(cat)!;
        const groupLabel = cat === '__other__'
          ? (OTHER_LABEL[locale] ?? OTHER_LABEL.en)
          : (catLabelMap[cat] ?? cat);

        return (
          <div key={cat} id={`hiz-cat-${cat}`} style={{ scrollMarginTop: '90px' }}>
            {/* Category label; service titles are the page's H2 headings. */}
            <Link
              href={localizedServiceCategoryPath(cat, locale)}
              aria-label={`${groupLabel} category page`}
              style={{
                display: 'inline-block',
                fontFamily: 'Inter, sans-serif',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: '#8A651C',
                marginBottom: '20px',
                paddingBottom: '10px',
                borderBottom: '1px solid rgba(201,168,76,0.18)',
                textDecoration: 'none',
              }}
            >
               {isolateLtrValues(groupLabel, locale)}
            </Link>

            {/* Service cards grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '20px',
              }}
            >
              {items.map((svc, svcIdx) => (
                <Link
                  key={svc.slug}
                  href={serviceHref(svc.slug, locale)}
                  className="ivt-svc-card-anchor"
                  style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column' }}
                >
                  <article
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      height: '100%',
                      background: '#FFFFFF',
                      border: '1px solid #E8EDF2',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      transition: 'box-shadow 0.2s, transform 0.2s',
                    }}
                    className="ivt-svc-card"
                  >
                    {/* Thumbnail */}
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        aspectRatio: '16/9',
                        background: 'linear-gradient(135deg, #1A2E3D 0%, #263E52 100%)',
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      {svc.heroImage ? (
                        <Image
                          src={svc.heroImage}
                           alt={isolateLtrValues(svc.title, locale)}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 340px"
                          priority={catIdx === 0 && svcIdx === 0}
                          fetchPriority={catIdx === 0 && svcIdx === 0 ? 'high' : 'auto'}
                        />
                      ) : null}
                      {/* Gold overlay on hover */}
                      <div
                        className="ivt-svc-card-overlay"
                        style={{
                          position: 'absolute', inset: 0,
                          background: 'rgba(201,168,76,0)',
                          transition: 'background 0.2s',
                        }}
                      />
                    </div>

                    {/* Content */}
                    <div
                      style={{
                        padding: '18px 20px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        flex: 1,
                      }}
                    >
                      <h2
                        style={{
                          fontFamily: '"Playfair Display", Georgia, serif',
                          fontSize: '16px',
                          fontWeight: 700,
                          color: '#172B3A',
                          lineHeight: 1.3,
                          margin: 0,
                        }}
                      >
                         {isolateLtrValues(svc.title, locale)}
                      </h2>

                      {svc.excerpt && (
                        <p
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '13px',
                            color: '#50677A',
                            lineHeight: 1.6,
                            margin: 0,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                           {isolateLtrValues(svc.excerpt, locale)}
                        </p>
                      )}

                      <div
                        style={{
                          marginTop: 'auto',
                          paddingTop: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          flexDirection: isRtl ? 'row-reverse' : 'row',
                        }}
                        className="ivt-svc-card-link"
                      >
                        <span
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '12px',
                            fontWeight: 600,
                             color: '#8A651C',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {moreLabel}
                        </span>
                         <Arrow size={13} color="#8A651C" />
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        );
      })}

      {/* Hover styles injected globally via style tag */}
      <style>{`
        .ivt-service-grid .ivt-svc-card:hover {
          box-shadow: 0 8px 32px rgba(0,0,0,0.10);
          transform: translateY(-2px);
        }
        .ivt-service-grid .ivt-svc-card:hover .ivt-svc-card-overlay {
          background: rgba(201,168,76,0.08) !important;
        }
        .ivt-service-grid .ivt-svc-card-anchor:focus-visible {
          border-radius: 12px;
          outline: 3px solid #102A43;
          outline-offset: 3px;
        }
      `}</style>
    </div>
  );
}
