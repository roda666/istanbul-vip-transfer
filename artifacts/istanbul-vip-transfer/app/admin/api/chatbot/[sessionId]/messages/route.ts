/**
 * GET /api/chatbot/admin/[sessionId]/messages
 * Returns all messages in a session for admin display.
 * User messages are shown with contentTr (Turkish translation).
 */
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { chatbotMessages, chatbotSessions } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = await params;

  const [chatSession] = await db
    .select()
    .from(chatbotSessions)
    .where(eq(chatbotSessions.id, sessionId))
    .limit(1);

  if (!chatSession) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  const messages = await db
    .select()
    .from(chatbotMessages)
    .where(eq(chatbotMessages.sessionId, sessionId))
    .orderBy(asc(chatbotMessages.createdAt));

  return Response.json({ session: chatSession, messages });
}
