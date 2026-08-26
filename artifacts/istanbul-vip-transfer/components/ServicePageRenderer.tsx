/**
 * Server Component — renders a service page with optional DB content overlay.
 *
 * Used by the catch-all locale route (`/[lang]/[...slug]/page.tsx`) for SERVICE
 * type pages. Fetches the published translation for `slug+locale` from the DB;
 * if found, renders DB content including v2 sections (introBody, contentSections,
 * serviceArea, faqs) with structured data (Service, BreadcrumbList, FAQPage).
 * Falls back to the static i18n `pageKey` approach when the DB has no published content.
 *
 * Shared components (booking, vehicle fleet, Contact) are always rendered.
 */
import type { ServicePageBody, ServicePageFaq, ServicePageSchemaExtras } from '@/lib/service-page-types';
import PageHero from '@/components/PageHero';
import CollapsibleBookingForm from '@/components/CollapsibleBookingForm';
import DeferredVehicleFleet from '@/components/DeferredVehicleFleet';
import Contact from '@/components/Contact';
import TranslationNotice from '@/components/TranslationNotice';
import { getPublishedServicePage } from '@/lib/service-page-cms';
import { SLUG_TO_PAGE_KEY, TWO_CRUMB_SLUGS } from '@/lib/service-page-config';
import { SITE } from '@/lib/site-config';
import { getContactSettings, type ContactSettings } from '@/lib/site-settings-server';
import { getDictionary } from '@/lib/i18n';
import { getContentDirection, isolateLtrValues } from '@/lib/i18n/bidi';
import { localizedServicePath, localizedStaticPath } from '@/lib/localized-service-path';
import { serializeJsonLd } from '@/lib/json-ld';
import SafeArticleImage from '@/components/SafeArticleImage';
import { getServiceStartingPriceEur } from '@/lib/service-starting-price';
import ServiceRelatedLinksSection from '@/components/ServiceRelatedLinksSection';

interface Props {
  slug: string;
  lang: string;
  /**
   * Overrides the canonical URL used in JSON-LD structured data.
   * Pass the unprefixed path (e.g. "/istanbul-havalimani-transfer") when
   * rendering at the primary Turkish URLs so JSON-LD matches the canonical.
   * Defaults to "/${lang}/${slug}".
   */
  canonicalPath?: string;
}

// ── JSON-LD helpers ───────────────────────────────────────────────────────────

interface SchemaContext { name: string; slug: string; lang: string; body: ServicePageBody | null; canonicalUrl: string; cs: ContactSettings }

function buildServiceJsonLd({ name, canonicalUrl, body, cs }: SchemaContext) {
  const url      = canonicalUrl;
  const extras   = body?.schemaExtras ?? {} as ServicePageSchemaExtras;
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description: body?.hero.subtitle ?? '',
    provider: {
      '@type':     'LocalBusiness',
       name:        cs.businessName,
      url:         SITE.siteUrl,
      telephone:   cs.phoneE164,
    },
    areaServed: body?.serviceArea?.areas?.length
      ? body.serviceArea.areas
      : (body?.serviceArea?.title ?? 'Istanbul'),
    url,
  };
  if (extras.serviceType)      schema['serviceType']       = extras.serviceType;
  if (extras.openingHours)     schema['openingHours']      = extras.openingHours;
  if (extras.priceRange)       schema['priceRange']        = extras.priceRange;
  if (extras.availableLanguage?.length) schema['availableLanguage'] = extras.availableLanguage;
  return schema;
}

function buildBreadcrumbJsonLd({ name, slug, lang, canonicalUrl }: { name: string; slug: string; lang: string; canonicalUrl: string }) {
  const siteBase = SITE.siteUrl;
  const base     = `${siteBase}/${lang}`;
  const home     = lang === 'tr' ? siteBase : base;
  const services = `${siteBase}${localizedStaticPath('hizmetler', lang)}`;
  const dict = getDictionary(lang);
  const items = [
    { '@type': 'ListItem', position: 1, name: dict.nav.home, item: home },
    { '@type': 'ListItem', position: 2, name },
  ];
  if (!TWO_CRUMB_SLUGS.has(slug)) {
    items.splice(1, 0, {
      '@type': 'ListItem', position: 2,
       name: dict.nav.services,
      item: services,
    });
    items[2] = { '@type': 'ListItem', position: 3, name, item: canonicalUrl };
  } else {
    items[1] = { '@type': 'ListItem', position: 2, name, item: canonicalUrl };
  }
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items };
}

function buildFaqJsonLd(faqs: ServicePageFaq[]) {
  if (!faqs || faqs.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

// ── Section renderer ─────────────────────────────────────────────────────────

const prose: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif',
  fontSize: '16px',
  lineHeight: '1.7',
  color: '#374151',
};

function FeaturesBlock({ features, dir, lang }: { features: string[]; dir?: string; lang: string }) {
  if (!features || features.length === 0) return null;
  return (
    <section style={{ padding: '40px 24px', maxWidth: '900px', margin: '0 auto' }}>
      <ul style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '14px',
        listStyle: 'none',
        margin: 0,
        padding: 0,
      }}>
        {features.map((f, i) => (
          <li key={i} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '14px 16px',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            color: '#374151',
            lineHeight: 1.5,
          }} dir={dir}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #C79A35, #E4B84B)',
              flexShrink: 0,
              marginTop: '1px',
            }}>
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                <path d="M1 4L3.5 6.5L9 1.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            {isolateLtrValues(f, lang)}
          </li>
        ))}
      </ul>
    </section>
  );
}

function StartingPriceBadge({ priceEur, dict, dir }: { priceEur: number; dict: ReturnType<typeof getDictionary>; dir?: string }) {
  const label = dict.servicePricing.startingFrom.replace('{price}', String(priceEur));
  return (
    <div style={{ padding: '0 24px', maxWidth: '900px', margin: '24px auto 0' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: '8px 18px', borderRadius: '999px',
        background: 'linear-gradient(135deg, rgba(199,154,53,0.12), rgba(228,184,75,0.12))',
        border: '1px solid rgba(199,154,53,0.35)',
        fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600, color: '#8A6516',
      }} dir={dir}>
        {label}
      </span>
    </div>
  );
}

function IntroSection({ text, dir, lang }: { text: string; dir?: string; lang: string }) {
  return (
    <section style={{ padding: '48px 24px', maxWidth: '900px', margin: '0 auto' }}>
      <p style={{ ...prose, margin: 0 }} dir={dir}>{isolateLtrValues(text, lang)}</p>
    </section>
  );
}

function ContentSectionsBlock({ body, dir, lang }: { body: ServicePageBody; dir?: string; lang: string }) {
  const sections = body.contentSections;
  if (!sections || sections.length === 0) return null;

  return (
    <section style={{ padding: '0 24px 48px', maxWidth: '900px', margin: '0 auto' }}>
      {sections.map(s => (
        <div key={s.id} style={{ marginBottom: '36px' }}>
          {s.headingLevel === 'h2' ? (
            <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: '24px', fontWeight: 700,
              color: '#1E293B', marginBottom: '14px' }} dir={dir}>
               {isolateLtrValues(s.heading, lang)}
            </h2>
          ) : (
            <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: '20px', fontWeight: 700,
              color: '#1E293B', marginBottom: '12px' }} dir={dir}>
               {isolateLtrValues(s.heading, lang)}
            </h3>
          )}
           <p style={{ ...prose, margin: 0 }} dir={dir}>{isolateLtrValues(s.body, lang)}</p>
        </div>
      ))}
    </section>
  );
}

function InlineImagesBlock({ body }: { body: ServicePageBody }) {
  if (!body.inlineImages?.length) return null;
  return (
    <section style={{ padding: '0 24px 40px', maxWidth: '900px', margin: '0 auto' }}>
      {body.inlineImages.map((image) => (
        <figure key={image.id} style={{ margin: '0 0 28px' }}>
          <SafeArticleImage
            src={image.src}
            alt={image.alt}
            sizes="(max-width: 900px) 100vw, 900px"
            className="block w-full h-auto rounded-xl"
          />
        </figure>
      ))}
    </section>
  );
}

function ServiceAreaBlock({ body, dir, lang }: { body: ServicePageBody; dir?: string; lang: string }) {
  const sa = body.serviceArea;
  if (!sa || (!sa.title && !sa.description && sa.areas.length === 0)) return null;

  return (
    <section style={{
      padding: '40px 24px', background: '#F8FAFC',
      borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0',
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {sa.title && (
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: '22px', fontWeight: 700,
            color: '#1E293B', marginBottom: '12px' }} dir={dir}>
             {isolateLtrValues(sa.title, lang)}
          </h2>
        )}
        {sa.description && (
           <p style={{ ...prose, marginBottom: '20px' }} dir={dir}>{isolateLtrValues(sa.description, lang)}</p>
        )}
        {sa.areas.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {sa.areas.map((area, idx) => (
              <span key={idx} style={{
                padding: '5px 14px', background: '#FFFFFF', border: '1px solid #D1D5DB',
                borderRadius: '20px', fontSize: '13px', fontFamily: 'Inter, sans-serif',
                color: '#374151',
              }}>
                 {isolateLtrValues(area, lang)}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FaqBlock({ body, dir, lang }: { body: ServicePageBody; dir?: string; lang?: string }) {
  const faqs = body.faqs;
  if (!faqs || faqs.length === 0) return null;
  const heading = getDictionary(lang ?? 'en').faq.heading;

  return (
    <section style={{ padding: '48px 24px', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{
        fontFamily: 'Inter, sans-serif', fontSize: '22px', fontWeight: 700,
        color: '#1E293B', marginBottom: '24px',
      }} dir={dir}>
        {heading}
      </h2>
      <div>
        {faqs.map((faq) => (
          <details key={faq.id} style={{
            borderBottom: '1px solid #E2E8F0', paddingBottom: '16px',
            marginBottom: '16px',
          }}>
            <summary style={{
              fontFamily: 'Inter, sans-serif', fontSize: '16px', fontWeight: 600,
              color: '#1E293B', cursor: 'pointer', userSelect: 'none',
              listStyle: 'none', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', paddingTop: '4px',
            }} dir={dir}>
               {isolateLtrValues(faq.question, lang ?? 'tr')}
              <span style={{ marginLeft: '8px', flexShrink: 0, color: '#C9A84C' }}>+</span>
            </summary>
            <p style={{ ...prose, marginTop: '12px', marginBottom: 0 }} dir={dir}>
               {isolateLtrValues(faq.answer, lang ?? 'tr')}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

// ── Main renderer ─────────────────────────────────────────────────────────────

export default async function ServicePageRenderer({ slug, lang, canonicalPath }: Props) {
  const [dbPage, cs, startingPriceEur] = await Promise.all([
    getPublishedServicePage(slug, lang),
    getContactSettings(),
    getServiceStartingPriceEur(slug),
  ]);
  // If the locale has no published CMS row, keep the page's existing
  // localized static fallback but still show the source FAQ rather than
  // silently dropping the section altogether.
  const faqFallbackPage = !dbPage && lang !== 'tr'
    ? await getPublishedServicePage(slug, 'tr')
    : null;
  const pageKey = SLUG_TO_PAGE_KEY[slug];
  const canonicalUrl = `${SITE.siteUrl}${canonicalPath ?? localizedServicePath(slug, lang)}`;

  // Determine text direction for RTL locales
  const dir = getContentDirection(lang);
  const dict = getDictionary(lang);

  if (dbPage?.body) {
    const { hero, faqs } = dbPage.body;
    const isTwoCrumb     = TWO_CRUMB_SLUGS.has(slug);

    const homeHref = lang === 'tr' ? '/' : `/${lang}`;
    const servicesHref = lang === 'tr' ? '/hizmetler' : `/${lang}/hizmetler`;
    const breadcrumbs = isTwoCrumb
      ? [{ label: dict.nav.home, href: homeHref }, { label: hero.crumb }]
      : [
          { label: dict.nav.home, href: homeHref },
          { label: dict.nav.services, href: servicesHref },
          { label: hero.crumb },
        ];

    // Build JSON-LD scripts
    const serviceSchema    = buildServiceJsonLd({ name: dbPage.title, slug, lang, body: dbPage.body, canonicalUrl, cs });
    const breadcrumbSchema = buildBreadcrumbJsonLd({ name: dbPage.title, slug, lang, canonicalUrl });
    const faqSchema        = faqs && faqs.length > 0 ? buildFaqJsonLd(faqs) : null;

    return (
      <div dir={dir}>
        {/* Structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbSchema) }}
        />
        {faqSchema && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqSchema) }}
          />
        )}

        {/* Translation status notice — shown for OUTDATED non-TR pages */}
        {lang !== 'tr' && dbPage.translationStatus === 'OUTDATED' && (
          <TranslationNotice status="outdated" lang={lang} />
        )}

        {/* PageHero with DB content */}
        <PageHero
          breadcrumbs={breadcrumbs}
          title={hero.title}
          subtitle={hero.subtitle}
          badge={hero.badge || null}
          heroImage={dbPage.heroImage}
          heroImageAlt={dbPage.heroImageAlt}
        />

        {startingPriceEur !== null && (
          <StartingPriceBadge priceEur={startingPriceEur} dict={dict} dir={dir} />
        )}

        {/* Introductory content */}
        {dbPage.body.introBody && (
          <IntroSection text={dbPage.body.introBody} dir={dir} lang={lang} />
        )}
        <InlineImagesBlock body={dbPage.body} />

        {/* Features list */}
        {dbPage.body.features && dbPage.body.features.length > 0 && (
          <FeaturesBlock features={dbPage.body.features} dir={dir} lang={lang} />
        )}

        <CollapsibleBookingForm />

        {/* Rich content sections */}
        <ContentSectionsBlock body={dbPage.body} dir={dir} lang={lang} />

        <DeferredVehicleFleet />

        {/* Service area */}
        <ServiceAreaBlock body={dbPage.body} dir={dir} lang={lang} />

        {/* FAQ */}
        <FaqBlock body={dbPage.body} dir={dir} lang={lang} />

        {/* Related services / blog guides / route detail / quote CTA — TR only for now, see doc-comment on internalLinks */}
        {lang === 'tr' && (
          <ServiceRelatedLinksSection links={dbPage.internalLinks} lang={lang} />
        )}

        <Contact />
      </div>
    );
  }

  // Static fallback — uses i18n dict via pageKey
  // If the visitor is not on Turkish and there's no DB translation, show a notice.
  if (pageKey) {
    return (
      <>
        {lang !== 'tr' && (
          <TranslationNotice status="missing" lang={lang} />
        )}
        <PageHero pageKey={pageKey} />
        <CollapsibleBookingForm />
        <DeferredVehicleFleet />
        {faqFallbackPage?.body?.faqs?.length ? (
          <FaqBlock body={faqFallbackPage.body} dir={dir} lang={lang} />
        ) : null}
        <Contact />
      </>
    );
  }

  return null;
}
