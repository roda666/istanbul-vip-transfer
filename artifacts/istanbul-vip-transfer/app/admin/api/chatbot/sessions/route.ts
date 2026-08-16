/**
 * GET /admin/api/chatbot/sessions
 * Lists recent chatbot sessions for the admin panel (last 7 days, newest first).
 * Protected: only callable from authenticated admin context.
 */
import { db } from '@/db';
import { chatbotSessions } from '@/db/schema';
import { desc, gte, sql } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Get sessions with message count and last message preview.
  // Use unquoted table-qualified column references in subqueries so PostgreSQL
  // resolves them against the outer chatbot_sessions row (TEXT id), not the
  // inner chatbot_messages.id column (UUID) which would cause a type error.
  const sessions = await db
    .select({
      id:               chatbotSessions.id,
      visitorLang:      chatbotSessions.visitorLang,
      adminActiveUntil: chatbotSessions.adminActiveUntil,
      humanTakenOver:   chatbotSessions.humanTakenOver,
      pendingAiAfter:   chatbotSessions.pendingAiAfter,
      createdAt:        chatbotSessions.createdAt,
      lastMessageAt:    chatbotSessions.lastMessageAt,
      messageCount: sql<number>`(
        SELECT COUNT(*) FROM chatbot_messages WHERE session_id = chatbot_sessions.id
      )`.mapWith(Number),
      lastMessageTr: sql<string | null>`(
        SELECT content_tr FROM chatbot_messages
        WHERE session_id = chatbot_sessions.id
        ORDER BY created_at DESC LIMIT 1
      )`,
      lastMessageRole: sql<string | null>`(
        SELECT role FROM chatbot_messages
        WHERE session_id = chatbot_sessions.id
        ORDER BY created_at DESC LIMIT 1
      )`,
    })
    .from(chatbotSessions)
    .where(gte(chatbotSessions.lastMessageAt, since))
    .orderBy(desc(chatbotSessions.lastMessageAt));

  return Response.json({ sessions });
}
