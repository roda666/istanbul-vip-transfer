/**
 * Server-only AI translation engine using OpenAI Structured Outputs.
 * Import only in server-side code (Route Handlers, Server Actions).
 *
 * All translations are saved as DRAFT and must be manually approved before publishing.
 * AI is NEVER allowed to set status to APPROVED or PUBLISHED.
 */
import 'server-only';
import { z } from 'zod';
import { getContactSettings } from '@/lib/site-settings-server';

/**
 * Coerce a value to a plain string.
 * Handles cases where OpenAI json_object mode returns an object/array for a field
 * that should be a string (e.g. body returned as a nested HTML object).
 */
const coerceString = z
  .any()
  .transform((v: unknown) =>
    v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v),
  );

/**
 * Coerce supportingKeywords: model sometimes returns a comma-separated string
 * instead of an array.
 */
const coerceStringArray = z
  .union([
    z.array(z.any()).transform((arr) => arr.map(String)),
    z.string().transform((s) =>
      s
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    ),
  ])
  .catch([]);

/** Schema for structured translation output from OpenAI. */
export const TranslationOutputSchema = z.object({
  title: coerceString.describe('Translated title'),
  slug: coerceString.describe('URL-safe slug in the target language, lowercase, hyphens only, no special chars'),
  excerpt: coerceString.describe('Translated excerpt/summary (2-3 sentences)'),
  body: coerceString.describe('Translated full body content, preserving HTML structure exactly'),
  metaTitle: coerceString.describe('SEO meta title in target language (50-60 chars)'),
  metaDescription: coerceString.describe('SEO meta description in target language (150-160 chars)'),
  focusKeyword: coerceString.describe('Primary SEO focus keyword in target language'),
  supportingKeywords: coerceStringArray.describe('2-5 supporting SEO keywords in target language'),
  imageAlt: coerceString.describe('Translated image alt text'),
  imageTitle: coerceString.describe('Translated image title attribute'),
  imageCaption: coerceString.describe('Translated image caption'),
});

export type TranslationOutput = z.infer<typeof TranslationOutputSchema>;

export interface TranslationInput {
  title: string;
  slug: string;
  excerpt: string | null;
  body: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  focusKeyword?: string | null;
  supportingKeywords?: string[] | null;
  imageAlt: string | null;
  imageTitle?: string | null;
  imageCaption?: string | null;
}

export type TranslateResult =
  | { ok: true; data: TranslationOutput; model: string }
  | { ok: false; reason: 'not_configured' | 'rate_limited' | 'api_error' | 'parse_error'; message?: string };

const PROMPT_VERSION = '1.1';

/**
 * Translates a content entity from Turkish to the target language.
 * Returns `{ ok: false, reason: 'not_configured' }` gracefully when OpenAI
 * is not configured — callers must check `ok` before using the data.
 */
export async function translateContent(
  input: TranslationInput,
  targetLang: string,
): Promise<TranslateResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: 'not_configured', message: 'OPENAI_API_KEY is not set' };
  }

  const model = process.env.OPENAI_TRANSLATION_MODEL ?? 'gpt-5.4-mini';

  // Resolve the target language from the catalog (name + provider support).
  const { getTranslationTargets, promptLangName } = await import('./lang-catalog');
  const targets = await getTranslationTargets([targetLang]);
  const info = targets[targetLang];
  if (info && !info.providerSupported) {
    return {
      ok: false,
      reason: 'api_error',
      message: `Çeviri sağlayıcısı bu dili desteklemiyor: ${targetLang}`,
    };
  }
  const targetLangName = promptLangName(info, targetLang);

  // Read contact details from DB (cached, falls back to static config)
  const cs = await getContactSettings();

  const systemPrompt = `You are an expert translation engine specializing in luxury transportation and tourism content.
Your task is to translate Turkish content about Istanbul VIP Transfer into ${targetLangName}.

CRITICAL RULES — NEVER VIOLATE:
1. Do NOT translate these exact strings (keep them verbatim): "VIP Transfer Istanbul", "Istanbul VIP Transfer", "IST", "SAW", "Mercedes Vito", "Mercedes Sprinter", "${cs.phoneDisplay}", "WhatsApp", "wa.me/${cs.whatsappNumber}", "${cs.email}"
2. Preserve ALL HTML tags exactly — translate only the text nodes inside them
3. Preserve phone numbers, URLs, and email addresses exactly as-is
4. For Arabic (ar): use Modern Standard Arabic appropriate for a luxury service
5. The slug must be URL-safe: lowercase, hyphens instead of spaces, no diacritics or special chars
6. Keep the professional, premium tone matching a luxury transfer service
7. SEO fields should be optimized for the target language market
8. Output ONLY the JSON — no markdown fences, no extra text`;

  const userPrompt = `Translate the following Turkish content to ${targetLangName}.

Title: ${input.title}
Slug: ${input.slug}
Excerpt: ${input.excerpt ?? ''}
Body (HTML): ${input.body ?? ''}
Meta Title: ${input.metaTitle ?? input.title}
Meta Description: ${input.metaDescription ?? input.excerpt ?? ''}
Focus Keyword: ${input.focusKeyword ?? ''}
Supporting Keywords: ${(input.supportingKeywords ?? []).join(', ')}
Image Alt: ${input.imageAlt ?? ''}
Image Title: ${input.imageTitle ?? ''}
Image Caption: ${input.imageCaption ?? ''}`;

  try {
    const { OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey });

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      return { ok: false, reason: 'api_error', message: 'No content in response' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, reason: 'parse_error', message: 'Failed to parse JSON response' };
    }

    const result = TranslationOutputSchema.safeParse(parsed);
    if (!result.success) {
      return {
        ok: false,
        reason: 'parse_error',
        message: `Schema validation failed: ${result.error.message}`,
      };
    }

    return { ok: true, data: result.data, model };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('429') || message.toLowerCase().includes('rate limit')) {
      return { ok: false, reason: 'rate_limited', message };
    }
    return { ok: false, reason: 'api_error', message };
  }
}

export { PROMPT_VERSION };
