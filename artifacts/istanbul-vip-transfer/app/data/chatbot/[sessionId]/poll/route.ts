/**
 * GET /data/chatbot/[sessionId]/poll?after=ISO_TIMESTAMP
 *
 * Returns messages created after `after` for the given session.
 * Used by ChatWidget to detect admin replies in real time.
 *
 * 2-minute AI fallback: if the session has humanTakenOver=true and
 * pendingAiAfter has elapsed, this handler atomically resets the session to
 * AI mode and generates a non-streaming AI reply, which is returned inline.
 * The atomic UPDATE guarantees only one concurrent poll wins the race.
 */
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { chatbotMessages, chatbotSessions } from '@/db/schema';
import { eq, gt, and, asc, lte } from 'drizzle-orm';
import { generateAIReply } from '@/lib/chatbot-ai';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const after         = request.nextUrl.searchParams.get('after');

  // Verify session exists and read its current state
  const [session] = await db
    .select()
    .from(chatbotSessions)
    .where(eq(chatbotSessions.id, sessionId))
    .limit(1);

  if (!session) {
    return Response.json({ messages: [], aiModeRestored: false });
  }

  let aiModeRestored = false;

  // ── 2-minute fallback: AI takes back over when timer elapses ────────────────
  if (
    session.humanTakenOver &&
    session.pendingAiAfter &&
    new Date() >= session.pendingAiAfter
  ) {
    // Atomic claim: only the first concurrent poll that wins this UPDATE will
    // generate an AI response — subsequent polls find humanTakenOver=false.
    const claimed = await db
      .update(chatbotSessions)
      .set({ humanTakenOver: false, pendingAiAfter: null })
      .where(
        and(
          eq(chatbotSessions.id, sessionId),
          eq(chatbotSessions.humanTakenOver, true),
          lte(chatbotSessions.pendingAiAfter, new Date()),
        ),
      )
      .returning({ id: chatbotSessions.id });

    if (claimed.length > 0) {
      // This poll won the race — fetch full history and generate AI reply
      const history = await db
        .select({ role: chatbotMessages.role, content: chatbotMessages.content, createdAt: chatbotMessages.createdAt })
        .from(chatbotMessages)
        .where(eq(chatbotMessages.sessionId, sessionId))
        .orderBy(asc(chatbotMessages.createdAt));

      // Only generate if the last message is a user message (no orphan replies)
      const lastMsg = history[history.length - 1];
      if (lastMsg?.role === 'user') {
        const aiHistory = history
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

        const aiContent = await generateAIReply(session.visitorLang, aiHistory);

        if (aiContent) {
          // Translate AI reply to Turkish so admin sees it in Turkish
          let aiContentTr = aiContent;
          try {
            const { translateToTurkish } = await import('@/lib/chatbot-translate');
            const tr = await translateToTurkish(aiContent);
            if (tr) aiContentTr = tr;
          } catch { /* keep original on error */ }
          await db.insert(chatbotMessages).values({
            sessionId,
            role:      'assistant',
            content:   aiContent,
            contentTr: aiContentTr,
          });
          await db.update(chatbotSessions)
            .set({ lastMessageAt: new Date() })
            .where(eq(chatbotSessions.id, sessionId));
          aiModeRestored = true;
        }
      }
    }
  }

  // ── Return messages since `after` (includes any freshly-generated AI reply) ─
  const afterDate = after ? new Date(after) : new Date(0);

  const messages = await db
    .select({
      id:        chatbotMessages.id,
      role:      chatbotMessages.role,
      content:   chatbotMessages.content,
      createdAt: chatbotMessages.createdAt,
    })
    .from(chatbotMessages)
    .where(
      and(
        eq(chatbotMessages.sessionId, sessionId),
        gt(chatbotMessages.createdAt, afterDate),
      ),
    )
    .orderBy(asc(chatbotMessages.createdAt));

  return Response.json({ messages, aiModeRestored });
}
