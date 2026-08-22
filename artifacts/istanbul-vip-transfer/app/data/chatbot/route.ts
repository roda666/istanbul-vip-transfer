import { NextRequest } from 'next/server';
import { translateToTurkish } from '@/lib/chatbot-translate';
import { getOpenAIChatbot, buildChatbotAiMessages, CHATBOT_MODEL } from '@/lib/chatbot-ai';
import { persistAssistantReplyForAdmin } from '@/lib/chatbot-response-storage';

export const dynamic = 'force-dynamic';

// ── Constants ──────────────────────────────────────────────────────────────────
/** HttpOnly cookie that proves session ownership. */
const COOKIE_NAME        = 'ivt_chat_sid';
/** 24-hour cookie lifetime. */
const COOKIE_MAX_AGE     = 60 * 60 * 24;
/** Maximum characters accepted per message. */
const MAX_MSG_CHARS      = 500;
/** Maximum messages forwarded to the model. */
const MAX_HISTORY        = 20;
/** Rate-limit window length in ms. */
const RL_WINDOW_MS       = 60_000;
/** Max requests per IP within the window. */
const RL_MAX             = 20;
/**
 * How long (ms) admin has priority before AI steps back in.
 * Applied per-message so the clock resets on every new visitor message.
 */
const ADMIN_HOLD_MS      = 2 * 60 * 1000; // 2 minutes

// ── In-memory rate limiter ─────────────────────────────────────────────────────
const rlStore = new Map<string, { n: number; exp: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const e   = rlStore.get(ip);
  if (!e || now > e.exp) { rlStore.set(ip, { n: 1, exp: now + RL_WINDOW_MS }); return true; }
  if (e.n >= RL_MAX) return false;
  e.n++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, e] of rlStore) if (now > e.exp) rlStore.delete(k);
}, 5 * 60_000);

// ── Cookie helper ──────────────────────────────────────────────────────────────
function makeSessionCookie(sid: string): string {
  return `${COOKIE_NAME}=${sid}; Path=/data/chatbot; HttpOnly; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE}`;
}

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
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429 },
    );
  }

  try {
    const body = await request.json() as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      lang?: string;
    };

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return Response.json({ error: 'messages required' }, { status: 400 });
    }

    const messages = body.messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: String(m.content ?? '').slice(0, MAX_MSG_CHARS) }))
      .slice(-MAX_HISTORY);

    if (messages.length === 0) {
      return Response.json({ error: 'messages required' }, { status: 400 });
    }

    const { db }                               = await import('@/db');
    const { chatbotSessions, chatbotMessages } = await import('@/db/schema');
    const { eq }                               = await import('drizzle-orm');

    // ── Session ownership via HttpOnly cookie ──────────────────────────────────
    const cookieSid = request.cookies.get(COOKIE_NAME)?.value;
    let sid         = '';
    let session;

    if (cookieSid) {
      session = (
        await db.select().from(chatbotSessions)
          .where(eq(chatbotSessions.id, cookieSid))
          .limit(1)
      )[0];
    }

    if (!session) {
      sid = crypto.randomUUID();
      await db.insert(chatbotSessions).values({ id: sid, visitorLang: body.lang ?? 'tr' });
      session = {
        id: sid,
        visitorLang:      body.lang ?? 'tr',
        adminActiveUntil: null,
        humanTakenOver:   false,
        pendingAiAfter:   null,
        createdAt:        new Date(),
        lastMessageAt:    new Date(),
      };
    } else {
      sid = session.id;
    }

    // ── Save user message + translate to TR ────────────────────────────────────
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

    // ── Admin handoff: temporary window (adminActiveUntil) ────────────────────
    const adminWindowActive =
      session.adminActiveUntil && new Date() < new Date(session.adminActiveUntil);
    if (adminWindowActive) {
      return Response.json(
        { mode: 'admin', sessionId: sid },
        { headers: { 'Set-Cookie': makeSessionCookie(sid) } },
      );
    }

    // ── Human takeover: permanent flag with 2-minute AI hold ──────────────────
    if (session.humanTakenOver) {
      const now = Date.now();
      const pendingAfter = session.pendingAiAfter ? new Date(session.pendingAiAfter).getTime() : null;

      if (pendingAfter !== null && now >= pendingAfter) {
        // 2-minute hold elapsed → reset to AI mode and fall through to streaming
        await db.update(chatbotSessions)
          .set({ humanTakenOver: false, pendingAiAfter: null })
          .where(eq(chatbotSessions.id, sid));
        session = { ...session, humanTakenOver: false, pendingAiAfter: null };
      } else {
        // Still within hold window (or first message after takeover) → set/refresh timer
        const newPendingAfter = new Date(now + ADMIN_HOLD_MS);
        await db.update(chatbotSessions)
          .set({ pendingAiAfter: newPendingAfter })
          .where(eq(chatbotSessions.id, sid));
        return Response.json(
          { mode: 'admin', sessionId: sid },
          { headers: { 'Set-Cookie': makeSessionCookie(sid) } },
        );
      }
    }

    // ── Stream AI response ─────────────────────────────────────────────────────
    const aiMessages = await buildChatbotAiMessages(session.visitorLang, messages);
    const aiStream = await getOpenAIChatbot().chat.completions.create({
      model:                 CHATBOT_MODEL,
      max_completion_tokens: 512,
      messages:              aiMessages,
      stream: true,
    });

    const encoder    = new TextEncoder();
    let fullResponse = '';

    const readable = new ReadableStream({
      async start(controller) {
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
            persistAssistantReplyForAdmin(
              sid,
              fullResponse,
              (message) => db.insert(chatbotMessages).values(message),
            ).catch(() => {});
          }
        }
      },
    });

    const resHeaders = new Headers({
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    });
    resHeaders.set('Set-Cookie', makeSessionCookie(sid));

    return new Response(readable, { headers: resHeaders });

  } catch (err) {
    console.error('[chatbot] error:', err instanceof Error ? err.message : 'unknown');
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
