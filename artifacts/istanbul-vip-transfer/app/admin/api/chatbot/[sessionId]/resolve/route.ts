/**
 * POST /admin/api/chatbot/[sessionId]/resolve
 *   Archives (closes) the session — sets resolvedAt = now.
 *
 * POST /admin/api/chatbot/[sessionId]/resolve?unresolve=true
 *   Restores the session to the active list — clears resolvedAt.
 */
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { chatbotSessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireChatbotManagement } from '@/lib/chatbot-admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const access = await requireChatbotManagement();
  if (access.error) return access.error;

  const { sessionId } = await params;
  const unresolve = request.nextUrl.searchParams.get('unresolve') === 'true';

  const [updated] = await db
    .update(chatbotSessions)
    .set({ resolvedAt: unresolve ? null : new Date() })
    .where(eq(chatbotSessions.id, sessionId))
    .returning({ id: chatbotSessions.id });

  if (!updated) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  return Response.json({ ok: true, resolvedAt: unresolve ? null : new Date() });
}
