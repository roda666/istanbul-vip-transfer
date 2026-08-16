import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { translateToTurkish } from '@/lib/chatbot-translate';

export const dynamic = 'force-dynamic';

// ── Constants ──────────────────────────────────────────────────────────────────
/** Configurable model — env var overrides default. */
const CHATBOT_MODEL  = process.env.OPENAI_CHATBOT_MODEL ?? 'gpt-4o-mini';
/** Cookie that proves session ownership; HttpOnly so JS cannot read/forge it. */
const COOKIE_NAME    = 'ivt_chat_sid';
/** 24-hour cookie lifetime. */
const COOKIE_MAX_AGE = 60 * 60 * 24;
/** Maximum characters accepted per message (prevent oversized payloads). */
const MAX_MSG_CHARS  = 500;
/** Maximum messages forwarded to the model (keep context window reasonable). */
const MAX_HISTORY    = 20;
/** Rate-limit window length in ms. */
const RL_WINDOW_MS   = 60_000;
/** Max requests per IP within the window. */
const RL_MAX         = 20;

// ── In-memory rate limiter (per IP) ───────────────────────────────────────────
const rlStore = new Map<string, { n: number; exp: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const e   = rlStore.get(ip);
  if (!e || now > e.exp) {
    rlStore.set(ip, { n: 1, exp: now + RL_WINDOW_MS });
    return true;
  }
  if (e.n >= RL_MAX) return false;
  e.n++;
  return true;
}

// Purge stale entries every 5 minutes to avoid unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [k, e] of rlStore) if (now > e.exp) rlStore.delete(k);
}, 5 * 60_000);

// ── OpenAI client ──────────────────────────────────────────────────────────────
// Prefer the Replit AI Integrations proxy when configured; fall back to the
// direct OPENAI_API_KEY so both configurations work.
function getOpenAI() {
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined;
  return new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

// ── System prompts ─────────────────────────────────────────────────────────────
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

// ── Cookie helper ──────────────────────────────────────────────────────────────
function makeSessionCookie(sid: string): string {
  // HttpOnly prevents JS from reading/forging it.
  // SameSite=Strict stops CSRF-style cross-site cookie delivery.
  // Path scoped to this endpoint so it isn't sent on unrelated requests.
  return `${COOKIE_NAME}=${sid}; Path=/data/chatbot; HttpOnly; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE}`;
}

// ── GET client IP ──────────────────────────────────────────────────────────────
function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '0.0.0.0'
  );
}

// ── POST handler ───────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // ── Rate limiting ────────────────────────────────────────────────────────────
  if (!checkRateLimit(clientIp(request))) {
    return Response.json(
      { error: 'Too many requests. Please wait a moment before sending another message.' },
      { status: 429 },
    );
  }

  try {
    // ── Parse + validate body ──────────────────────────────────────────────────
    const body = await request.json() as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      lang?: string;
    };

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return Response.json({ error: 'messages required' }, { status: 400 });
    }

    // Sanitise: enforce per-message length cap, trim to recent history only.
    const messages = body.messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: String(m.content ?? '').slice(0, MAX_MSG_CHARS) }))
      .slice(-MAX_HISTORY);

    if (messages.length === 0) {
      return Response.json({ error: 'messages required' }, { status: 400 });
    }

    const { db }                             = await import('@/db');
    const { chatbotSessions, chatbotMessages } = await import('@/db/schema');
    const { eq }                               = await import('drizzle-orm');

    // ── Session ownership via HttpOnly cookie ──────────────────────────────────
    // The client never needs to send a sessionId in the body; the cookie is the
    // only trusted ownership proof.  A new cookie is issued whenever the server
    // creates a new session.
    const cookieSid = request.cookies.get(COOKIE_NAME)?.value;
    let sid         = '';
    let isNew       = false;
    let session;

    if (cookieSid) {
      // Verify the session actually exists — reject tampered/expired cookie values.
      session = (
        await db.select().from(chatbotSessions)
          .where(eq(chatbotSessions.id, cookieSid))
          .limit(1)
      )[0];
    }

    if (!session) {
      // No valid cookie → start a fresh session.
      sid  = crypto.randomUUID();
      isNew = true;
      await db.insert(chatbotSessions).values({ id: sid, visitorLang: body.lang ?? 'tr' });
      session = {
        id: sid,
        visitorLang: body.lang ?? 'tr',
        adminActiveUntil: null,
        createdAt:    new Date(),
        lastMessageAt: new Date(),
      };
    } else {
      sid = session.id;
    }

    // ── 2. Save user message + translate to TR ─────────────────────────────────
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      const contentTr = await translateToTurkish(lastUserMsg.content)
        .catch(() => lastUserMsg.content);
      await db.insert(chatbotMessages).values({
        sessionId: sid,
        role:      'user',
        content:   lastUserMsg.content,
        contentTr,
      });
      await db.update(chatbotSessions)
        .set({ lastMessageAt: new Date() })
        .where(eq(chatbotSessions.id, sid));
    }

    // ── 3. Admin handoff check ─────────────────────────────────────────────────
    const adminIsActive =
      session.adminActiveUntil && new Date() < new Date(session.adminActiveUntil);
    if (adminIsActive) {
      return Response.json(
        { mode: 'admin', sessionId: sid },
        { headers: { 'Set-Cookie': makeSessionCookie(sid) } },
      );
    }

    // ── 4. Stream AI response ──────────────────────────────────────────────────
    const aiStream = await getOpenAI().chat.completions.create({
      model:                CHATBOT_MODEL,
      max_completion_tokens: 512,
      messages: [
        { role: 'system', content: getSystemPrompt(session.visitorLang) },
        ...messages,
      ],
      stream: true,
    });

    const encoder     = new TextEncoder();
    let fullResponse  = '';

    const readable = new ReadableStream({
      async start(controller) {
        // Send session ID so client can display it / use for admin queries.
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'session', sessionId: sid })}\n\n`),
        );
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
          if (fullResponse) {
            db.insert(chatbotMessages).values({
              sessionId:  sid,
              role:       'assistant',
              content:    fullResponse,
              contentTr:  fullResponse, // AI already replied in visitor lang
            }).catch(() => {});        // fire-and-forget; non-critical
          }
        }
      },
    });

    const resHeaders = new Headers({
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    });
    // Always refresh the session cookie (renews Max-Age on every valid request).
    resHeaders.set('Set-Cookie', makeSessionCookie(sid));

    return new Response(readable, { headers: resHeaders });

  } catch (err) {
    // Log only the message — never the full error object which may contain keys/URLs.
    console.error('[chatbot] error:', err instanceof Error ? err.message : 'unknown error');
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
