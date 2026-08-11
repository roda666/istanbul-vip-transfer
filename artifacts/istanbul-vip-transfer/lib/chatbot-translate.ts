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
  tr: 'Turkish', en: 'English', de: 'German', ru: 'Russian', ar: 'Arabic',
};

/** Translate any text → Turkish (for admin panel display). */
export async function translateToTurkish(text: string, sourceLang = 'en'): Promise<string> {
  if (!text.trim() || sourceLang === 'tr') return text;
  const openai = getClient();
  const res = await openai.chat.completions.create({
    model: 'gpt-5.6-luna',
    max_completion_tokens: 400,
    messages: [
      { role: 'system', content: 'Translate the following text to Turkish. Return only the translation.' },
      { role: 'user', content: text },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? text;
}

/** Translate Turkish admin reply → visitor language. */
export async function translateFromTurkish(text: string, targetLang: string): Promise<string> {
  if (!text.trim() || targetLang === 'tr') return text;
  const targetName = LANG_NAMES[targetLang] ?? 'English';
  const openai = getClient();
  const res = await openai.chat.completions.create({
    model: 'gpt-5.6-luna',
    max_completion_tokens: 400,
    messages: [
      { role: 'system', content: `Translate the following text to ${targetName}. Return only the translation.` },
      { role: 'user', content: text },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? text;
}
