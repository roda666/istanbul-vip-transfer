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
import { getSession } from '@/lib/auth/session';

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
