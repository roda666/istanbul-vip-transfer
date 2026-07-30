/**
 * Server-only AI translation engine for homepage sections.
 *
 * Translates a flat map of { "section.field": "Turkish text" } to the target language.
 * Uses the same OpenAI provider as the general translate.ts, with a homepage-specific prompt.
 *
 * SAFETY RULES (enforced via prompt):
 *  - AI output is always treated as DRAFT — callers must NEVER auto-publish.
 *  - Brand names, technical identifiers, URLs, phone numbers are preserved verbatim.
 */
import 'server-only';

export type HomepageTranslateResult =
  | { ok: true; translated: Record<string, string>; model: string }
  | { ok: false; reason: 'not_configured' | 'rate_limited' | 'api_error' | 'parse_error'; message?: string };

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  de: 'German',
  ru: 'Russian',
  ar: 'Arabic (Modern Standard Arabic, RTL)',
};

/** Fields that must NEVER be translated, regardless of content. */
const PRESERVED_VERBATIM = [
  'VIP Transfer Istanbul', 'Istanbul VIP Transfer', 'IST', 'SAW',
  'Mercedes Vito', 'Mercedes Sprinter', 'VW Transporter',
  '+90 532 660 08 47', 'WhatsApp', 'wa.me/905326600847',
  'info@istanbulviptransfer.com', '7/24',
];

export async function translateHomepageFields(
  fields: Record<string, string>,
  targetLang: string,
): Promise<HomepageTranslateResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: 'not_configured', message: 'OPENAI_API_KEY is not set' };
  }

  const model = process.env.OPENAI_TRANSLATION_MODEL ?? 'gpt-4o-mini';
  const langName = LANG_NAMES[targetLang] ?? targetLang;

  const systemPrompt = `You are an expert translation engine specializing in luxury VIP transportation content.
Translate the provided JSON field map from Turkish to ${langName}.

CRITICAL RULES — NEVER VIOLATE:
1. Keep ALL keys exactly as provided — translate ONLY the values.
2. Preserve verbatim (do not translate): ${PRESERVED_VERBATIM.map(s => `"${s}"`).join(', ')}
3. Do NOT translate URLs, slugs, phone numbers, email addresses, or numeric values.
4. For Arabic (ar): use Modern Standard Arabic suitable for luxury services. Phone numbers, emails, URLs, IST, SAW, and vehicle model names must remain LTR (wrap in ‎\u200E...\u200E if needed to preserve direction).
5. Maintain the premium, professional tone of a high-end VIP transfer service.
6. SEO fields (keys ending in metaTitle, metaDescription, ogTitle, ogDescription) must be optimized for the target language's search market — compelling, accurate, 50-65 chars for titles, 120-155 chars for descriptions.
7. CTA text must be action-oriented and natural in the target language.
8. Return ONLY valid JSON — no markdown fences, no explanation, no extra keys.
9. Output must contain EXACTLY the same keys as the input, with translated string values.`;

  const fieldCount = Object.keys(fields).length;
  const userPrompt = `Translate these ${fieldCount} homepage section fields from Turkish to ${langName}.

Input JSON:
${JSON.stringify(fields, null, 2)}

Return the translated JSON with identical keys.`;

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
      temperature: 0.25,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      return { ok: false, reason: 'api_error', message: 'No content in OpenAI response' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, reason: 'parse_error', message: 'Failed to parse JSON from AI response' };
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false, reason: 'parse_error', message: 'AI response is not an object' };
    }

    // Validate: all input keys must be present in output
    const result: Record<string, string> = {};
    for (const key of Object.keys(fields)) {
      const val = (parsed as Record<string, unknown>)[key];
      if (typeof val === 'string') {
        result[key] = val;
      } else {
        // Missing key — fall back to source value rather than crashing
        result[key] = fields[key];
      }
    }

    return { ok: true, translated: result, model };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('429') || message.toLowerCase().includes('rate limit')) {
      return { ok: false, reason: 'rate_limited', message };
    }
    return { ok: false, reason: 'api_error', message };
  }
}
