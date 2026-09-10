import { NextRequest } from 'next/server';
import { translateToTurkish } from '@/lib/chatbot-translate';
import { getOpenAIChatbot, buildChatbotAiContext, CHATBOT_MODEL } from '@/lib/chatbot-ai';
import { sanitizeChatbotReply } from '@/lib/chatbot-message-safety';
import { persistAssistantReplyForAdmin } from '@/lib/chatbot-response-storage';
import { detectBookingIntent, formatBookingWhatsAppMessage } from '@/lib/chatbot-booking-intent';
import { buildWhatsAppChatUrl } from '@/lib/whatsapp';
import { getContactSettings } from '@/lib/site-settings-server';

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

  let finalizeClaim: (() => Promise<void>) | null = null;
  try {
    const body = await request.json() as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      lang?: string;
      /** Stable browser-generated identifier, reused when the request is retried. */
      messageId?: string;
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
    if (!body.messageId || !/^[0-9a-zA-Z-]{1,100}$/.test(body.messageId)) {
      return Response.json({ error: 'messageId required' }, { status: 400 });
    }
    const messageId = body.messageId;
    const terminalFailure = (sid: string) => new Response(
      `data: ${JSON.stringify({ type: 'session', sessionId: sid })}\n\n` +
      `data: ${JSON.stringify({ error: true, retryable: true })}\n\n`,
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Set-Cookie': makeSessionCookie(sid),
        },
      },
    );

    const { db }                               = await import('@/db');
    const { chatbotSessions, chatbotMessages } = await import('@/db/schema');
    const { eq, and, or, lt }                  = await import('drizzle-orm');

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

    // ── Atomically claim this client message ───────────────────────────────────
    // The insert winner is the only request allowed to invoke AI. In particular,
    // do not translate before this point: translation is also an AI-provider call.
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    let ownsAiWork = false;
    const claimToken = crypto.randomUUID();
    const leaseUntil = new Date(Date.now() + 2 * 60 * 1000);
    if (lastUserMsg) {
      const inserted = await db.insert(chatbotMessages).values({
        sessionId:       sid,
        clientMessageId: messageId,
        role:            'user',
        content:         lastUserMsg.content,
        contentTr:       lastUserMsg.content,
        processingStatus: 'processing',
        processingToken: claimToken,
        processingLeaseUntil: leaseUntil,
      })
        .onConflictDoNothing({
          target: [chatbotMessages.sessionId, chatbotMessages.clientMessageId],
        })
        .returning({ id: chatbotMessages.id });
      ownsAiWork = inserted.length > 0;
      // A failed claim, or a worker abandoned beyond its lease, can be taken
      // over exactly once. Fresh processing claims are deliberately untouched.
      if (!ownsAiWork) {
        const takeover = await db.update(chatbotMessages)
          .set({
            processingStatus: 'processing',
            processingToken: claimToken,
            processingLeaseUntil: leaseUntil,
          })
          .where(and(
            eq(chatbotMessages.sessionId, sid),
            eq(chatbotMessages.clientMessageId, messageId),
            or(
              eq(chatbotMessages.processingStatus, 'retryable'),
              and(
                eq(chatbotMessages.processingStatus, 'processing'),
                lt(chatbotMessages.processingLeaseUntil, new Date()),
              ),
            ),
          ))
          .returning({ id: chatbotMessages.id });
        ownsAiWork = takeover.length > 0;
      }
    }

    // Renew immediately after ownership is acquired, before any translator,
    // context, or provider call.
    let stopClaimHeartbeat: (() => void) | null = null;
    const resolveOwnedClaim = async (
      status: 'completed' | 'retryable',
      responseMode?: 'assistant' | 'admin',
    ) => {
      if (!ownsAiWork) return;
      stopClaimHeartbeat?.();
      stopClaimHeartbeat = null;
      await db.update(chatbotMessages)
        .set({
          processingStatus: status,
          processingToken: null,
          processingLeaseUntil: null,
          ...(responseMode ? { responseMode } : {}),
        })
        .where(and(
          eq(chatbotMessages.sessionId, sid),
          eq(chatbotMessages.clientMessageId, messageId),
          eq(chatbotMessages.processingToken, claimToken),
          ...(status === 'retryable' ? [eq(chatbotMessages.processingStatus, 'processing')] : []),
        ));
    };
    if (ownsAiWork) {
      const renewClaim = () => {
        void db.update(chatbotMessages)
          .set({ processingLeaseUntil: new Date(Date.now() + 2 * 60 * 1000) })
          .where(and(
            eq(chatbotMessages.sessionId, sid),
            eq(chatbotMessages.clientMessageId, messageId),
            eq(chatbotMessages.processingToken, claimToken),
            eq(chatbotMessages.processingStatus, 'processing'),
          ));
      };
      renewClaim();
      const timer = setInterval(renewClaim, 30_000);
      stopClaimHeartbeat = () => clearInterval(timer);
      // This is deliberately token-conditional and only touches a live claim.
      // A completed claim (including one completed by an admin branch) can never
      // be downgraded by a late exception or stream cancellation.
      finalizeClaim = async () => {
        stopClaimHeartbeat?.();
        stopClaimHeartbeat = null;
        await db.update(chatbotMessages)
          .set({ processingStatus: 'retryable', processingToken: null, processingLeaseUntil: null })
          .where(and(
            eq(chatbotMessages.sessionId, sid),
            eq(chatbotMessages.clientMessageId, messageId),
            eq(chatbotMessages.processingToken, claimToken),
            eq(chatbotMessages.processingStatus, 'processing'),
          ));
      };
    }

    await db.update(chatbotSessions)
      .set({ lastMessageAt: new Date() })
      .where(eq(chatbotSessions.id, sid));

    const claimedMessage = lastUserMsg
      ? (await db.select({
          processingStatus: chatbotMessages.processingStatus,
          responseMode: chatbotMessages.responseMode,
        }).from(chatbotMessages).where(and(
          eq(chatbotMessages.sessionId, sid),
          eq(chatbotMessages.clientMessageId, messageId),
        )).limit(1))[0]
      : undefined;

    // Completed outcomes are durable and replayed as SSE, including the safe
    // booking action. This path never contacts a model or translator.
    const storedAssistant = await db.select().from(chatbotMessages)
      .where(and(
        eq(chatbotMessages.sessionId, sid),
        eq(chatbotMessages.assistantForClientMessageId, messageId),
      ))
      .limit(1);
    if (!ownsAiWork && storedAssistant[0]) {
      const outcome = storedAssistant[0];
      const encoder = new TextEncoder();
      const replay = `data: ${JSON.stringify({ type: 'session', sessionId: sid })}\n\n` +
        `data: ${JSON.stringify({ content: outcome.content })}\n\n` +
        (outcome.action ? `data: ${JSON.stringify({ action: outcome.action })}\n\n` : '') +
        'data: {"done":true}\n\n';
      return new Response(new ReadableStream({
        start(controller) { controller.enqueue(encoder.encode(replay)); controller.close(); },
      }), {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Set-Cookie': makeSessionCookie(sid),
        },
      });
    }

    // Admin outcomes have no assistant row. Replay the durable mode rather than
    // returning 202 to a retry of the same request.
    if (!ownsAiWork && claimedMessage?.processingStatus === 'completed' &&
        claimedMessage.responseMode === 'admin') {
      return Response.json(
        { mode: 'admin', sessionId: sid },
        { headers: { 'Set-Cookie': makeSessionCookie(sid) } },
      );
    }

    // ── Admin handoff: temporary window (adminActiveUntil) ────────────────────
    const adminWindowActive =
      session.adminActiveUntil && new Date() < new Date(session.adminActiveUntil);
    if (adminWindowActive) {
      await resolveOwnedClaim('completed', 'admin');
      return Response.json(
        { mode: 'admin', sessionId: sid },
        { headers: { 'Set-Cookie': makeSessionCookie(sid) } },
      );
    }

    // Another request inserted the user row first and is still generating its
    // outcome. Never race it or call OpenAI a second time.
    if (!ownsAiWork) {
      return Response.json(
        { status: 'processing', sessionId: sid, retryable: true },
        { status: 202, headers: { 'Set-Cookie': makeSessionCookie(sid) } },
      );
    }

    // Only the insert winner performs the admin translation.
    if (lastUserMsg) {
      let contentTr: string;
      try {
        contentTr = await translateToTurkish(lastUserMsg.content);
      } catch (error) {
        await resolveOwnedClaim('retryable');
        console.error('[chatbot] translation failed:', error instanceof Error ? error.message : 'unknown');
        return terminalFailure(sid);
      }
      await db.update(chatbotMessages)
        .set({ contentTr })
        .where(and(
          eq(chatbotMessages.sessionId, sid),
          eq(chatbotMessages.clientMessageId, messageId),
          eq(chatbotMessages.processingToken, claimToken),
        ));
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
        await resolveOwnedClaim('completed', 'admin');
        return Response.json(
          { mode: 'admin', sessionId: sid },
          { headers: { 'Set-Cookie': makeSessionCookie(sid) } },
        );
      }
    }

    // ── Stream AI response ─────────────────────────────────────────────────────
    let aiMessages: Awaited<ReturnType<typeof buildChatbotAiContext>>['messages'];
    let reservationFormUrl: string | null;
    try {
      ({ messages: aiMessages, reservationFormUrl } =
        await buildChatbotAiContext(session.visitorLang, messages, request));
    } catch (error) {
      await resolveOwnedClaim('retryable');
      console.error('[chatbot] context failed:', error instanceof Error ? error.message : 'unknown');
      return terminalFailure(sid);
    }
    let aiStream: AsyncIterable<{ choices: Array<{ delta?: { content?: string | null } }> }>;
    try {
      aiStream = await (await getOpenAIChatbot()).chat.completions.create({
        model: CHATBOT_MODEL,
        max_completion_tokens: 512,
        messages: aiMessages,
        stream: true,
      });
    } catch (error) {
      await resolveOwnedClaim('retryable');
      console.error('[chatbot] provider failed:', error instanceof Error ? error.message : 'unknown');
      return terminalFailure(sid);
    }

    const encoder    = new TextEncoder();
    let fullResponse = '';
    let safeResponse = '';
    let safeAction: { type: 'whatsapp_booking'; url: string } | null = null;

    const readable = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'session', sessionId: sid })}\n\n`),
        );
        try {
          for await (const chunk of aiStream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) fullResponse += content;
          }
           if (!fullResponse) throw new Error('chatbot_empty_provider_response');
          if (fullResponse) {
            safeResponse = sanitizeChatbotReply(
              fullResponse,
              reservationFormUrl,
              session.visitorLang,
            );
            if (safeResponse !== fullResponse) {
              console.warn('[chatbot] Repaired an unresolved response placeholder.');
            }
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: safeResponse })}\n\n`),
            );
            const intent = detectBookingIntent(messages);
            if (intent.ready) {
              const contact = await getContactSettings();
              safeAction = {
                type: 'whatsapp_booking',
                url: buildWhatsAppChatUrl(contact.whatsappNumber, formatBookingWhatsAppMessage(intent.details, session.visitorLang)),
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ action: safeAction })}\n\n`));
            }
          }
           if (safeResponse) {
            // Claim completion before inserting the assistant, in one transaction.
            // A worker that lost ownership therefore can never create an orphan reply.
            await db.transaction(async (tx) => {
              const claimed = await tx.update(chatbotMessages)
               .set({
                 processingStatus: 'completed',
                 processingToken: null,
                 processingLeaseUntil: null,
                 responseMode: 'assistant',
               })
                .where(and(eq(chatbotMessages.sessionId, sid), eq(chatbotMessages.clientMessageId, messageId), eq(chatbotMessages.processingToken, claimToken)))
                .returning({ id: chatbotMessages.id });
              if (!claimed.length) throw new Error('chatbot_claim_lost');
              if (safeResponse) {
                await persistAssistantReplyForAdmin(
                  sid,
                  safeResponse,
                  (message) => tx.insert(chatbotMessages).values(message),
                  undefined,
                  { assistantForClientMessageId: messageId, action: safeAction },
                );
              }
            });
            stopClaimHeartbeat?.();
            stopClaimHeartbeat = null;
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          } catch (error) {
            await resolveOwnedClaim('retryable');
           console.error('[chatbot] stream failed:', error instanceof Error ? error.message : 'unknown');
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: true, retryable: true })}\n\n`));
         } finally {
            await finalizeClaim?.();
            controller.close();
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
    await finalizeClaim?.().catch(() => undefined);
    console.error('[chatbot] error:', err instanceof Error ? err.message : 'unknown');
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
