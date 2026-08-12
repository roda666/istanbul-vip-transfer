import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { translateToTurkish } from '@/lib/chatbot-translate';

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey:   process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

function getSystemPrompt(lang: string): string {
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

export async function POST(request: NextRequest) {
  try {
    const { sessionId, messages, lang } = await request.json() as {
      sessionId?: string;
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      lang: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: 'messages required' }, { status: 400 });
    }

    const { db } = await import('@/db');
    const { chatbotSessions, chatbotMessages } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    // ── 1. Ensure session exists ─────────────────────────────────────────────
    let sid = sessionId ?? crypto.randomUUID();
    let session = sessionId
      ? (await db.select().from(chatbotSessions).where(eq(chatbotSessions.id, sessionId)).limit(1))[0]
      : null;

    if (!session) {
      sid = crypto.randomUUID();
      await db.insert(chatbotSessions).values({ id: sid, visitorLang: lang ?? 'tr' });
      session = { id: sid, visitorLang: lang ?? 'tr', adminActiveUntil: null, createdAt: new Date(), lastMessageAt: new Date() };
    }

    // ── 2. Save user message + translate to TR (awaited so admin always sees TR) ─
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      const contentTr = await translateToTurkish(lastUserMsg.content)
        .catch(() => lastUserMsg.content);
      await db.insert(chatbotMessages).values({
        sessionId: sid,
        role: 'user',
        content: lastUserMsg.content,
        contentTr,
      });
      await db.update(chatbotSessions)
        .set({ lastMessageAt: new Date() })
        .where(eq(chatbotSessions.id, sid));
    }

    // ── 3. Admin handoff check ───────────────────────────────────────────────
    const adminActiveUntil = session.adminActiveUntil;
    const adminIsActive = adminActiveUntil && new Date() < new Date(adminActiveUntil);
    if (adminIsActive) {
      return Response.json({ mode: 'admin', sessionId: sid });
    }

    // ── 4. Stream AI response ────────────────────────────────────────────────
    const aiStream = await openai.chat.completions.create({
      model: 'gpt-5.6-luna',
      max_completion_tokens: 512,
      messages: [
        { role: 'system', content: getSystemPrompt(session.visitorLang) },
        ...messages,
      ],
      stream: true,
    });

    const encoder = new TextEncoder();
    let fullResponse = '';

    const readable = new ReadableStream({
      async start(controller) {
        // First event: session ID so client can store it
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'session', sessionId: sid })}\n\n`));
        try {
          for await (const chunk of aiStream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        } finally {
          controller.close();
          // Persist AI response
          if (fullResponse) {
            db.insert(chatbotMessages).values({
              sessionId: sid,
              role: 'assistant',
              content: fullResponse,
              contentTr: fullResponse, // AI already replied in visitor lang; TR label intentional
            }).catch(console.error);
          }
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
      },
    });
  } catch (err) {
    console.error('[chatbot] error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
