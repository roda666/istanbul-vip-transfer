/**
 * POST /api/chatbot/admin/[sessionId]/reply
 * Admin sends a Turkish message → translated to visitor language → saved.
 * Also sets adminActiveUntil = now + 5 minutes.
 */
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { chatbotSessions, chatbotMessages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { translateFromTurkish } from '@/lib/chatbot-translate';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  // Translate Turkish → visitor language
  const translated = await translateFromTurkish(content.trim(), chatSession.visitorLang);

  // Set admin active window: 5 minutes from now
  const adminActiveUntil = new Date(Date.now() + 5 * 60 * 1000);

  await Promise.all([
    db.insert(chatbotMessages).values({
      sessionId,
      role: 'admin',
      content: translated,        // what visitor sees (in their language)
      contentTr: content.trim(),  // what admin typed (Turkish)
    }),
    db.update(chatbotSessions)
      .set({ adminActiveUntil, lastMessageAt: new Date() })
      .where(eq(chatbotSessions.id, sessionId)),
  ]);

  return Response.json({ ok: true, translatedContent: translated, adminActiveUntil });
}
