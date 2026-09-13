import type { RouteFaqItem, RouteTransportOption } from '@/db/schema';

export const TRANSFER_ROUTE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TransferRouteAiInput = {
  name: string;
  origin: string;
  destination: string;
  originLocationId: string;
  destinationLocationId: string;
  includeImage: boolean;
};

export type TransferRouteAiDraft = {
  description: string;
  introParagraph: string;
  transportOptions: RouteTransportOption[];
  routeNotes: string[];
  faqItems: RouteFaqItem[];
  seoTitle: string;
  seoDescription: string;
  ogTitle: string;
  ogDescription: string;
  relatedServiceSlug: string | null;
};

const AI_DRAFT_KEYS = new Set([
  'description',
  'introParagraph',
  'transportOptions',
  'routeNotes',
  'faqItems',
  'seoTitle',
  'seoDescription',
  'ogTitle',
  'ogDescription',
  'relatedServiceSlug',
]);

function text(value: unknown, max = 4_000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function validateTransferRouteAiInput(body: Record<string, unknown>): {
  ok: true;
  data: TransferRouteAiInput;
} | {
  ok: false;
  error: string;
} {
  const name = text(body.name, 240);
  const origin = text(body.origin, 240);
  const destination = text(body.destination, 240);
  const originLocationId = body.originLocationId;
  const destinationLocationId = body.destinationLocationId;
  if (!name || !origin || !destination) {
    return { ok: false, error: 'Güzergah adı, kalkış ve varış zorunludur.' };
  }
  if (
    typeof originLocationId !== 'string'
    || typeof destinationLocationId !== 'string'
    || !TRANSFER_ROUTE_UUID.test(originLocationId)
    || !TRANSFER_ROUTE_UUID.test(destinationLocationId)
    || originLocationId === destinationLocationId
  ) {
    return { ok: false, error: 'Kalkış ve varış aktif lokasyon kimlikleri geçerli ve farklı UUID olmalıdır.' };
  }
  return {
    ok: true,
    data: {
      name,
      origin,
      destination,
      originLocationId,
      destinationLocationId,
      includeImage: body.includeImage === true,
    },
  };
}

export function formatVerifiedDistance(distanceKm: number): string {
  return Number.isInteger(distanceKm) ? String(distanceKm) : distanceKm.toFixed(1).replace(/\.0$/, '');
}

/**
 * The verified sentence is owned by the server.  Any first sentence supplied
 * by the model is discarded so an editable draft can never replace Google
 * Maps' measured metrics with a guess.
 */
export function mergeVerifiedIntroParagraph(
  modelIntro: unknown,
  distanceKm: number,
  durationMinutes: number,
): string {
  const verified = `Google Maps verisine göre bu rota ${formatVerifiedDistance(distanceKm)} km ve ${durationMinutes} dakika sürer.`;
  const rest = text(modelIntro, 2_000).replace(/^[\s\S]*?[.!?](?:\s+|$)/, '').trim();
  return rest ? `${verified} ${rest}` : verified;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseTransportOptions(value: unknown): RouteTransportOption[] | null {
  if (!Array.isArray(value) || value.length < 3 || value.length > 8) return null;
  const result = value.map((item) => isObject(item) ? {
    name: text(item.name, 120),
    summary: text(item.summary, 700),
    downside: text(item.downside, 700),
  } : null);
  if (result.some((item) => !item || !item.name || !item.summary || !item.downside)) return null;
  return result as RouteTransportOption[];
}

function parseFaqs(value: unknown): RouteFaqItem[] | null {
  if (!Array.isArray(value) || value.length < 6 || value.length > 12) return null;
  const result = value.map((item) => isObject(item) ? {
    question: text(item.question, 300),
    answer: text(item.answer, 1_200),
  } : null);
  if (result.some((item) => !item || !item.question || !item.answer)) return null;
  return result as RouteFaqItem[];
}

export function parseTransferRouteAiDraft(
  value: unknown,
  verified: { distanceKm: number; durationMinutes: number },
  allowedServiceSlugs: ReadonlySet<string>,
): TransferRouteAiDraft | null {
  if (!isObject(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== AI_DRAFT_KEYS.size || keys.some((key) => !AI_DRAFT_KEYS.has(key))) return null;
  const transportOptions = parseTransportOptions(value.transportOptions);
  const faqItems = parseFaqs(value.faqItems);
  const relatedServiceSlug = value.relatedServiceSlug == null ? null : text(value.relatedServiceSlug, 180);
  const routeNotes = Array.isArray(value.routeNotes)
    ? value.routeNotes.map((item) => text(item, 500)).filter(Boolean).slice(0, 12)
    : null;
  if (
    !transportOptions
    || !faqItems
    || !routeNotes
    || !text(value.description)
    || !text(value.introParagraph)
    || !text(value.seoTitle, 180)
    || !text(value.seoDescription, 320)
    || !text(value.ogTitle, 180)
    || !text(value.ogDescription, 320)
    || (relatedServiceSlug !== null && !allowedServiceSlugs.has(relatedServiceSlug))
  ) return null;

  return {
    description: text(value.description),
    introParagraph: mergeVerifiedIntroParagraph(value.introParagraph, verified.distanceKm, verified.durationMinutes),
    transportOptions,
    routeNotes,
    faqItems,
    seoTitle: text(value.seoTitle, 180),
    seoDescription: text(value.seoDescription, 320),
    ogTitle: text(value.ogTitle, 180),
    ogDescription: text(value.ogDescription, 320),
    relatedServiceSlug,
  };
}
