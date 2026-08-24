/**
 * POST /admin/api/chatbot/[sessionId]/reply
 *
 * Admin sends a Turkish message → translated to visitor language → saved.
 * Also:
 *  - Sets humanTakenOver = true (AI will never auto-respond again in this session)
 *  - Clears pendingAiAfter (cancels any in-progress 2-minute AI countdown)
 *  - Refreshes adminActiveUntil to 5 minutes from now
 */
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { chatbotSessions, chatbotMessages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireChatbotManagement } from '@/lib/chatbot-admin-auth';
import { translateFromTurkish } from '@/lib/chatbot-translate';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const access = await requireChatbotManagement();
  if (access.error) return access.error;

  const { sessionId } = await params;
  const { content } = await request.json() as { content: string };

  if (!content?.trim()) {
    return Response.json({ error: 'content required' }, { status: 400 });
  }

  const [chatSession] = await db
    .select({ id: chatbotSessions.id, visitorLang: chatbotSessions.visitorLang })
    .from(chatbotSessions)
    .where(eq(chatbotSessions.id, sessionId))
    .limit(1);

  if (!chatSession) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  // Translate Turkish admin reply → visitor language
  const translated = await translateFromTurkish(content.trim(), chatSession.visitorLang);

  // 5-minute active window + permanent human takeover + cancel AI countdown
  const adminActiveUntil = new Date(Date.now() + 5 * 60 * 1000);

  await Promise.all([
    db.insert(chatbotMessages).values({
      sessionId,
      role:      'admin',
      content:   translated,         // what the visitor sees (their language)
      contentTr: content.trim(),     // what the admin typed (Turkish)
    }),
    db.update(chatbotSessions)
      .set({
        adminActiveUntil,
        humanTakenOver: true,        // permanent — AI will no longer auto-respond
        pendingAiAfter: null,        // cancel any pending 2-minute AI countdown
        lastMessageAt:  new Date(),
      })
      .where(eq(chatbotSessions.id, sessionId)),
  ]);

  return Response.json({ ok: true, translatedContent: translated, adminActiveUntil });
}
