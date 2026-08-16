/**
 * Shared AI helpers for the chatbot system.
 *
 * Both the streaming POST handler (/data/chatbot) and the polling GET handler
 * (/data/chatbot/[sessionId]/poll) use the same model, client factory, and
 * system prompts — centralised here to prevent drift.
 */
import OpenAI from 'openai';

/** Configurable via env var; defaults to gpt-4o-mini. */
export const CHATBOT_MODEL = process.env.OPENAI_CHATBOT_MODEL ?? 'gpt-4o-mini';

/**
 * Returns a fresh OpenAI client on every call (do NOT cache — tokens expire).
 * Prefers the Replit AI Integrations proxy when configured, falls back to a
 * direct OPENAI_API_KEY.
 */
export function getOpenAIChatbot(): OpenAI {
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined;
  return new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

/** Per-language system prompts for the VIP transfer assistant. */
export function getSystemPrompt(lang: string): string {
  const prompts: Record<string, string> = {
    tr: `Sen İstanbul VIP Transfer'in yardımcı yapay zeka asistanısın. İstanbul'un en prestijli lüks kara ulaşım hizmetini temsil ediyorsun.

Sunulan hizmetler:
- İstanbul Havalimanı (IST) ve Sabiha Gökçen (SAW) havalimanı transferleri
- Şehirlerarası transfer (İstanbul–Bursa, İstanbul–Sapanca vb.)
- VIP transfer ve şoförlü araç kiralama, otel ve sağlık turizmi transferleri
- Kurumsal VIP transfer, özel günübirlik turlar (Sapanca, Bursa, Yalova)

Araçlar: Mercedes Vito (7 kişi) ve Sprinter. Klima, deri koltuk, su dahil. 7/24 hizmet.
Fiyat için rezervasyon formu veya WhatsApp'a yönlendir. Kısa ve profesyonel yanıtlar ver.`,

    en: `You are the AI assistant for Istanbul VIP Transfer, Istanbul's premier luxury ground transportation service.
Services: airport transfers (IST/SAW), city-to-city, VIP transfer, hotel & medical tourism transfers, corporate VIP, private day tours (Sapanca, Bursa, Yalova).
Fleet: Mercedes Vito (7 pax) & Sprinter. A/C, leather seats, water. 24/7 service.
For price quotes direct users to the booking form or WhatsApp. Keep answers short and professional.`,

    de: `Du bist der KI-Assistent von Istanbul VIP Transfer, Istanbuls erstklassigem Luxus-Bodentransportservice.
Leistungen: Flughafentransfers (IST/SAW), Städteverbindungen, VIP-Transfer, Hoteltransfers, medizinischer Tourismus, Firmen-VIP, private Tagestouren.
Flotte: Mercedes Vito & Sprinter. 24/7 Service. Für Preise auf Buchungsformular/WhatsApp verweisen.`,

    ru: `Вы — ИИ-ассистент Istanbul VIP Transfer, ведущего люксового трансферного сервиса Стамбула.
Услуги: трансферы в аэропорты (IST/SAW), межгородские трансферы, VIP, гостиничные, медицинские, корпоративные, частные экскурсии.
Флот: Mercedes Vito и Sprinter. Сервис 24/7. Для цен — на форму бронирования или WhatsApp.`,

    ar: `أنت المساعد الذكي لـ Istanbul VIP Transfer، خدمة النقل الفاخرة الرائدة في إسطنبول.
الخدمات: نقل المطارات (IST/SAW)، النقل بين المدن، نقل VIP، الفنادق، السياحة الطبية، الشركات، الجولات الخاصة.
الأسطول: مرسيدس فيتو وسبرينتر. خدمة 24/7. لاستفسارات الأسعار وجّه إلى نموذج الحجز أو WhatsApp.`,
  };
  return prompts[lang] ?? prompts.en;
}

/**
 * Generate a single non-streaming AI reply for a given conversation history.
 * Returns null on failure (caller should surface a graceful fallback).
 */
export async function generateAIReply(
  visitorLang: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<string | null> {
  try {
    const res = await getOpenAIChatbot().chat.completions.create({
      model: CHATBOT_MODEL,
      max_completion_tokens: 512,
      messages: [
        { role: 'system', content: getSystemPrompt(visitorLang) },
        ...history,
      ],
    });
    return res.choices[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.error('[chatbot-ai] generateAIReply error:', err instanceof Error ? err.message : 'unknown');
    return null;
  }
}
