/**
 * GET /admin/api/chatbot/unread-count
 *
 * Lightweight endpoint for the sidebar badge.
 * Returns the number of ACTIVE (non-archived) sessions from the last 7 days
 * where the LAST message was from the visitor (role = 'user') — i.e., the
 * visitor is waiting for a response and no admin/AI reply has been sent yet.
 *
 * Protected by the same CHAT_MANAGE permission as the session list.
 */
import { db } from '@/db';
import { chatbotSessions } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { requireChatbotManagement } from '@/lib/chatbot-admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const access = await requireChatbotManagement();
    if (access.error) return access.error;

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [{ count }] = await db
      .select({
        count: sql<number>`COUNT(*)`.mapWith(Number),
      })
      .from(chatbotSessions)
      .where(
        sql`${chatbotSessions.lastMessageAt} >= ${since}
          AND ${chatbotSessions.resolvedAt} IS NULL
          AND (
            SELECT role FROM chatbot_messages
            WHERE session_id = chatbot_sessions.id
            ORDER BY created_at DESC LIMIT 1
          ) = 'user'`,
      );

    return Response.json({ count: count ?? 0 });
  } catch {
    return Response.json({ count: 0 });
  }
}
