/**
 * GET /api/chatbot/admin/[sessionId]/messages
 * Returns all messages in a session for admin display.
 * User messages are shown with contentTr (Turkish translation).
 */
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { chatbotMessages, chatbotSessions } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { requireChatbotManagement } from '@/lib/chatbot-admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const access = await requireChatbotManagement();
  if (access.error) return access.error;

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
