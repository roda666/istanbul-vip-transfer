import type { ServicePageBody } from '@/lib/service-page-types';

/**
 * Customer-facing copy must never describe bridges, tunnels, motorways, or
 * their crossing fees. Those operational details are handled only by the
 * protected pricing tools.
 *
 * The matcher intentionally leaves the generic "cross-continent passage"
 * concept intact, so the public route summary can still say whether a journey
 * changes sides of Istanbul without naming a bridge or a toll.
 */
const TOLL_FEE_TERMS = /(?:geçiş\s*ücret|köprü|tünel|otoyol|\btolls?\b|\bbridge(?:s)?\b|\btunnel(?:s)?\b|\bhighway(?:s)?\b|\bmotorway(?:s)?\b|\bpéage(?:s)?\b|\bpont(?:s)?\b|\bautoroute(?:s)?\b|\bmaut\b|\bbrücke(?:n)?\b|\bautobahn(?:en)?\b|\bpedaggio(?:i)?\b|\bponte(?:i)?\b|\bautostrada(?:e)?\b|\bpeaje(?:s)?\b|\bpuente(?:s)?\b|\btúnel(?:es)?\b|\bautopista(?:s)?\b|\btol(?:len)?\b|\bbrug(?:gen)?\b|\bsnelweg(?:en)?\b|(?:мост|туннел|автомагистрал|платн)\p{L}*|(?:جسر|نفق|طريق\s+سريع|رسوم\s+(?:العبور|الطريق|طرق)))/iu;

/**
 * Removes complete customer-visible sentences or list entries that discuss
 * toll-related route details. It is intentionally pure and used only by public readers; admin
 * editors keep the original source copy available for internal review.
 */
export function removeCustomerVisibleTollCopy(value: string | null | undefined): string {
  if (!value) return value ?? '';

  return value
    .split(/\n/)
    .map((line) => line
      .split(/(?<=[.!?؟])\s+/u)
      .filter((sentence) => !TOLL_FEE_TERMS.test(sentence))
      .join(' '))
    .filter((line) => line.trim().length > 0)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const clean = (value: string) => removeCustomerVisibleTollCopy(value);
const cleanOptional = (value: string | undefined) => value === undefined ? undefined : clean(value);

/** Sanitizes every textual field emitted by the public service-page renderer. */
export function sanitizeCustomerVisibleServiceBody(body: ServicePageBody | null): ServicePageBody | null {
  if (!body) return null;

  return {
    ...body,
    hero: {
      ...body.hero,
      badge: clean(body.hero.badge),
      title: clean(body.hero.title),
      subtitle: clean(body.hero.subtitle),
      crumb: clean(body.hero.crumb),
      ctaPrimary: clean(body.hero.ctaPrimary),
      ctaSecondary: clean(body.hero.ctaSecondary),
    },
    features: body.features.map(clean).filter(Boolean),
    seo: {
      ...body.seo,
      ogTitle: clean(body.seo.ogTitle),
      ogDescription: clean(body.seo.ogDescription),
    },
    introBody: cleanOptional(body.introBody),
    contentSections: body.contentSections
      ?.map((section) => ({ ...section, heading: clean(section.heading), body: clean(section.body) }))
      .filter((section) => section.heading || section.body),
    inlineImages: body.inlineImages
      ?.map((image) => ({ ...image, alt: clean(image.alt) })),
    serviceArea: body.serviceArea
      ? {
          ...body.serviceArea,
          title: clean(body.serviceArea.title),
          description: clean(body.serviceArea.description),
          areas: body.serviceArea.areas.map(clean).filter(Boolean),
        }
      : undefined,
    faqs: body.faqs
      ?.map((faq) => ({ ...faq, question: clean(faq.question), answer: clean(faq.answer) }))
      .filter((faq) => faq.question && faq.answer),
  };
}