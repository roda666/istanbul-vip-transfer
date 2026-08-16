/**
 * GET /admin/api/chatbot/unread-count
 *
 * Lightweight endpoint for the sidebar badge.
 * Returns the number of ACTIVE (non-archived) sessions from the last 7 days
 * where the LAST message was from the visitor (role = 'user') — i.e., the
 * visitor is waiting for a response and no admin/AI reply has been sent yet.
 *
 * Returns { count: 0 } on any auth failure so the sidebar badge never errors.
 */
import { db } from '@/db';
import { chatbotSessions } from '@/db/schema';
import { gte, isNull, sql } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return Response.json({ count: 0 });
    }

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
