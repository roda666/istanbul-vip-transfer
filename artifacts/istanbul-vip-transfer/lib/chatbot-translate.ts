/**
 * Lightweight translation helpers for the chatbot hybrid system.
 * Uses the Replit AI Integrations OpenAI proxy (gpt-5.6-luna for cost efficiency).
 */
import OpenAI from 'openai';

function getClient() {
  return new OpenAI({
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    apiKey:  process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
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
  const openai = getClient();
  const res = await openai.chat.completions.create({
    model: 'gpt-5.6-luna',
    max_completion_tokens: 400,
    messages: [
      {
        role: 'system',
        content:
          'Translate the following text to Turkish. ' +
          'If the text is already in Turkish, return it exactly as-is. ' +
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
  const openai = getClient();
  const res = await openai.chat.completions.create({
    model: 'gpt-5.6-luna',
    max_completion_tokens: 400,
    messages: [
      {
        role: 'system',
        content:
          `Translate the following text to ${targetName}. ` +
          `If the text is already in ${targetName}, return it exactly as-is. ` +
          `Return only the translation — no explanations.`,
      },
      { role: 'user', content: text },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? text;
}
