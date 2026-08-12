/**
 * GET /api/chatbot/[sessionId]/poll?after=ISO_TIMESTAMP
 * Returns messages in this session created after the given timestamp.
 * Used by the ChatWidget to detect admin replies.
 */
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { chatbotMessages, chatbotSessions } from '@/db/schema';
import { eq, gt, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const after = request.nextUrl.searchParams.get('after');

  // Verify session exists
  const [session] = await db
    .select({ id: chatbotSessions.id, visitorLang: chatbotSessions.visitorLang })
    .from(chatbotSessions)
    .where(eq(chatbotSessions.id, sessionId))
    .limit(1);

  if (!session) {
    return Response.json({ messages: [] });
  }

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
    .orderBy(chatbotMessages.createdAt);

  return Response.json({ messages });
}
