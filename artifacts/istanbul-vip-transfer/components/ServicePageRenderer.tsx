/**
 * Server Component — renders a service page with optional DB content overlay.
 *
 * Used by the catch-all locale route (`/[lang]/[...slug]/page.tsx`) for SERVICE
 * type pages. Fetches the published translation for `slug+locale` from the DB;
 * if found, renders DB content including v2 sections (introBody, contentSections,
 * serviceArea, faqs) with structured data (Service, BreadcrumbList, FAQPage).
 * Falls back to the static i18n `pageKey` approach when the DB has no published content.
 *
 * Shared components (BookingForm, VehicleFleet, Contact) are always rendered.
 */
import type { ServicePageBody, ServicePageFaq } from '@/lib/service-page-types';
import PageHero from '@/components/PageHero';
import BookingForm from '@/components/BookingForm';
import VehicleFleet from '@/components/VehicleFleet';
import Contact from '@/components/Contact';
import { getPublishedServicePage } from '@/lib/service-page-cms';
import { SLUG_TO_PAGE_KEY, TWO_CRUMB_SLUGS } from '@/lib/service-page-config';
import { SITE } from '@/lib/site-config';

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

/**
 * Safely serialise an object to JSON for use in a script[type=application/ld+json]
 * tag via dangerouslySetInnerHTML.  Raw JSON.stringify can emit `</script>` and
 * Unicode line/paragraph separators that escape the script block and allow stored
 * XSS.  Replacing the relevant characters with their Unicode escapes is the
 * standard OWASP-recommended mitigation.
 */
function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// ── JSON-LD helpers ───────────────────────────────────────────────────────────

interface SchemaContext { name: string; slug: string; lang: string; body: ServicePageBody | null; canonicalUrl: string }

function buildServiceJsonLd({ name, canonicalUrl, body }: SchemaContext) {
  const url = canonicalUrl;
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description: body?.hero.subtitle ?? '',
    provider: {
      '@type': 'LocalBusiness',
      name:    'Istanbul VIP Transfer',
      url:     SITE.siteUrl,
    },
    areaServed: body?.serviceArea?.title ?? 'Istanbul',
    url,
  };
}

function buildBreadcrumbJsonLd({ name, slug, lang, canonicalUrl }: { name: string; slug: string; lang: string; canonicalUrl: string }) {
  const siteBase = SITE.siteUrl;
  const base     = `${siteBase}/${lang}`;
  const home     = lang === 'tr' ? siteBase : base;
  const services = lang === 'tr' ? `${siteBase}/hizmetler` : `${base}/hizmetler`;
  const items = [
    { '@type': 'ListItem', position: 1, name: lang === 'tr' ? 'Ana Sayfa' : 'Home', item: home },
    { '@type': 'ListItem', position: 2, name },
  ];
  if (!TWO_CRUMB_SLUGS.has(slug)) {
    items.splice(1, 0, {
      '@type': 'ListItem', position: 2,
      name: lang === 'tr' ? 'Hizmetler' : 'Services',
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

function IntroSection({ text, dir }: { text: string; dir?: string }) {
  return (
    <section style={{ padding: '48px 24px', maxWidth: '900px', margin: '0 auto' }}>
      <p style={{ ...prose, margin: 0 }} dir={dir}>{text}</p>
    </section>
  );
}

function ContentSectionsBlock({ body, dir }: { body: ServicePageBody; dir?: string }) {
  const sections = body.contentSections;
  if (!sections || sections.length === 0) return null;

  return (
    <section style={{ padding: '0 24px 48px', maxWidth: '900px', margin: '0 auto' }}>
      {sections.map(s => (
        <div key={s.id} style={{ marginBottom: '36px' }}>
          {s.headingLevel === 'h2' ? (
            <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: '24px', fontWeight: 700,
              color: '#1E293B', marginBottom: '14px' }} dir={dir}>
              {s.heading}
            </h2>
          ) : (
            <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: '20px', fontWeight: 700,
              color: '#1E293B', marginBottom: '12px' }} dir={dir}>
              {s.heading}
            </h3>
          )}
          <p style={{ ...prose, margin: 0 }} dir={dir}>{s.body}</p>
        </div>
      ))}
    </section>
  );
}

function ServiceAreaBlock({ body, dir }: { body: ServicePageBody; dir?: string }) {
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
            {sa.title}
          </h2>
        )}
        {sa.description && (
          <p style={{ ...prose, marginBottom: '20px' }} dir={dir}>{sa.description}</p>
        )}
        {sa.areas.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {sa.areas.map((area, idx) => (
              <span key={idx} style={{
                padding: '5px 14px', background: '#FFFFFF', border: '1px solid #D1D5DB',
                borderRadius: '20px', fontSize: '13px', fontFamily: 'Inter, sans-serif',
                color: '#374151',
              }}>
                {area}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FaqBlock({ body, dir }: { body: ServicePageBody; dir?: string }) {
  const faqs = body.faqs;
  if (!faqs || faqs.length === 0) return null;

  return (
    <section style={{ padding: '48px 24px', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{
        fontFamily: 'Inter, sans-serif', fontSize: '22px', fontWeight: 700,
        color: '#1E293B', marginBottom: '24px',
      }} dir={dir}>
        {dir === 'rtl' ? 'الأسئلة الشائعة' : 'Sık Sorulan Sorular'}
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
              {faq.question}
              <span style={{ marginLeft: '8px', flexShrink: 0, color: '#C9A84C' }}>+</span>
            </summary>
            <p style={{ ...prose, marginTop: '12px', marginBottom: 0 }} dir={dir}>
              {faq.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

// ── Main renderer ─────────────────────────────────────────────────────────────

export default async function ServicePageRenderer({ slug, lang, canonicalPath }: Props) {
  const dbPage = await getPublishedServicePage(slug, lang);
  const pageKey = SLUG_TO_PAGE_KEY[slug];
  const canonicalUrl = `${SITE.siteUrl}${canonicalPath ?? `/${lang}/${slug}`}`;

  // Determine text direction for RTL locales
  const isRtl = lang === 'ar';
  const dir   = isRtl ? 'rtl' : undefined;

  if (dbPage?.body) {
    const { hero, faqs } = dbPage.body;
    const isTwoCrumb     = TWO_CRUMB_SLUGS.has(slug);

    const breadcrumbs = isTwoCrumb
      ? [{ label: lang === 'tr' ? 'Ana Sayfa' : 'Home', href: `/${lang}` }, { label: hero.crumb }]
      : [
          { label: lang === 'tr' ? 'Ana Sayfa' : 'Home', href: `/${lang}` },
          { label: lang === 'tr' ? 'Hizmetler' : 'Services', href: `/${lang}/hizmetler` },
          { label: hero.crumb },
        ];

    // Build JSON-LD scripts
    const serviceSchema    = buildServiceJsonLd({ name: dbPage.title, slug, lang, body: dbPage.body, canonicalUrl });
    const breadcrumbSchema = buildBreadcrumbJsonLd({ name: dbPage.title, slug, lang, canonicalUrl });
    const faqSchema        = faqs && faqs.length > 0 ? buildFaqJsonLd(faqs) : null;

    return (
      <div dir={dir}>
        {/* Structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(serviceSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbSchema) }}
        />
        {faqSchema && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJsonLd(faqSchema) }}
          />
        )}

        {/* PageHero with DB content */}
        <PageHero
          breadcrumbs={breadcrumbs}
          title={hero.title}
          subtitle={hero.subtitle}
          heroImage={dbPage.heroImage}
          heroImageAlt={dbPage.heroImageAlt}
        />

        {/* Introductory content */}
        {dbPage.body.introBody && (
          <IntroSection text={dbPage.body.introBody} dir={dir} />
        )}

        <BookingForm />

        {/* Rich content sections */}
        <ContentSectionsBlock body={dbPage.body} dir={dir} />

        <VehicleFleet />

        {/* Service area */}
        <ServiceAreaBlock body={dbPage.body} dir={dir} />

        {/* FAQ */}
        <FaqBlock body={dbPage.body} dir={dir} />

        <Contact />
      </div>
    );
  }

  // Static fallback — uses i18n dict via pageKey
  if (pageKey) {
    return (
      <>
        <PageHero pageKey={pageKey} />
        <BookingForm />
        <VehicleFleet />
        <Contact />
      </>
    );
  }

  return null;
}
