/**
 * Lightweight translation helpers for the chatbot hybrid system.
 * Uses the Replit AI Integrations OpenAI proxy (gpt-5.4-mini).
 */
import OpenAI from 'openai';
import { resolveEnvironmentOnlyIntegrationConfig, resolveIntegrationSecret } from '@/lib/integration-secrets';
import { isLikelyLanguage, normalizeChatbotLanguage, type ChatbotLanguage } from '@/lib/chatbot-language';

async function getClient() {
  return new OpenAI({
    baseURL: resolveEnvironmentOnlyIntegrationConfig('AI_INTEGRATIONS_OPENAI_BASE_URL'),
    apiKey: await resolveIntegrationSecret('AI_INTEGRATIONS_OPENAI_API_KEY') || await resolveIntegrationSecret('OPENAI_API_KEY'),
  });
}

const LANG_NAMES: Record<string, string> = {
  tr: 'Turkish', en: 'English', de: 'German',  ru: 'Russian',  ar: 'Arabic',
  fr: 'French',  es: 'Spanish', it: 'Italian', nl: 'Dutch',
};

/** Translate any text → Turkish (for admin panel display).
 *  Always calls the LLM regardless of source language — the model returns
 *  the text unchanged when it is already in Turkish.  This ensures that a
 *  visitor on the Turkish-locale page who types in English (or any other
 *  language) still has their message translated for the admin.
 */
export async function translateToTurkish(text: string): Promise<string> {
  if (!text.trim()) return text;
  const openai = await getClient();
  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_CHATBOT_MODEL ?? 'gpt-5.4-mini',
    max_completion_tokens: 400,
    messages: [
      {
        role: 'system',
        content:
          'Translate the following text to Turkish. ' +
          'If the text is already in Turkish, return it exactly as-is. ' +
          'Keep proper names, company names, airport names and codes, route and location names, URLs, phone numbers, dates, and times exactly unchanged. ' +
          'Return only the translation — no explanations.',
      },
      { role: 'user', content: text },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? text;
}

/** Translate Turkish admin reply → visitor language.
 *  Always calls the LLM — even when targetLang is 'tr' — because the
 *  session locale ('tr') does not guarantee the visitor types in Turkish.
 *  A visitor on the Turkish-locale page might write in English; the LLM
 *  returns the text as-is when the target matches the source language.
 */
export async function translateFromTurkish(text: string, targetLang: string): Promise<string> {
  if (!text.trim()) return text;
  const targetName = LANG_NAMES[targetLang] ?? 'English';
  const openai = await getClient();
  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_CHATBOT_MODEL ?? 'gpt-5.4-mini',
    max_completion_tokens: 400,
    messages: [
      {
        role: 'system',
        content:
          `Translate the following text to ${targetName}. ` +
          `If the text is already in ${targetName}, return it exactly as-is. ` +
          'Keep proper names, company names, airport names and codes, route and location names, URLs, phone numbers, dates, and times exactly unchanged. ' +
          `Return only the translation — no explanations.`,
      },
      { role: 'user', content: text },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? text;
}

export function validateCustomerTranslation(
  sourceText: string,
  translatedText: string,
  targetLang: string,
): { valid: boolean; language: ChatbotLanguage } {
  const source = sourceText.trim();
  const translated = translatedText.trim();
  const target = normalizeChatbotLanguage(targetLang, 'tr');
  if (!source || !translated) return { valid: false, language: target };
  if (target === 'tr') {
    return { valid: translated === source, language: target };
  }
  if (translated.toLocaleLowerCase('tr-TR') === source.toLocaleLowerCase('tr-TR')) {
    return { valid: false, language: target };
  }
  return { valid: isLikelyLanguage(translated, target), language: target };
}

/**
 * Customer-facing translation. Unlike the legacy knowledge translation helper,
 * this never returns the Turkish source as a silent fallback for a foreign
 * customer.
 */
export async function translateFromTurkishStrict(
  text: string,
  targetLang: string,
): Promise<{ translated: string; language: ChatbotLanguage }> {
  const source = text.trim();
  const target = normalizeChatbotLanguage(targetLang, 'tr');
  if (!source) throw new Error('translation_source_required');
  if (target === 'tr') return { translated: source, language: target };
  const translated = (await translateFromTurkish(source, target)).trim();
  if (!validateCustomerTranslation(source, translated, target).valid) {
    throw new Error('translation_language_validation_failed');
  }
  return { translated, language: target };
}
