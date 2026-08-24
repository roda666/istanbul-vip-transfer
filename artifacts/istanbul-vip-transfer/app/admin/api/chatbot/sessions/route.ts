/**
 * GET /admin/api/chatbot/sessions
 * Lists chatbot sessions for the admin panel (last 7 days, newest first).
 * Protected: only callable from authenticated admin context.
 *
 * Query params:
 *   ?archived=true   → return only archived (resolvedAt IS NOT NULL) sessions
 *   (default)        → return only active   (resolvedAt IS NULL)     sessions
 */
import { db } from '@/db';
import { chatbotSessions } from '@/db/schema';
import { desc, gte, isNull, isNotNull, and, sql } from 'drizzle-orm';
import { requireChatbotManagement } from '@/lib/chatbot-admin-auth';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const access = await requireChatbotManagement();
  if (access.error) return access.error;

  const archived = request.nextUrl.searchParams.get('archived') === 'true';
  const since    = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const sessions = await db
    .select({
      id:               chatbotSessions.id,
      visitorLang:      chatbotSessions.visitorLang,
      adminActiveUntil: chatbotSessions.adminActiveUntil,
      humanTakenOver:   chatbotSessions.humanTakenOver,
      pendingAiAfter:   chatbotSessions.pendingAiAfter,
      resolvedAt:       chatbotSessions.resolvedAt,
      createdAt:        chatbotSessions.createdAt,
      lastMessageAt:    chatbotSessions.lastMessageAt,
      messageCount: sql<number>`(
        SELECT COUNT(*) FROM chatbot_messages WHERE session_id = chatbot_sessions.id
      )`.mapWith(Number),
      lastMessageTr: sql<string | null>`(
        SELECT COALESCE(NULLIF(content_tr, ''), content) FROM chatbot_messages
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
    .where(
      and(
        gte(chatbotSessions.lastMessageAt, since),
        archived ? isNotNull(chatbotSessions.resolvedAt) : isNull(chatbotSessions.resolvedAt),
      ),
    )
    .orderBy(desc(chatbotSessions.lastMessageAt));

  return Response.json({ sessions });
}
