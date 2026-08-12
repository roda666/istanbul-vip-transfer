/**
 * POST /api/chatbot/admin/[sessionId]/takeover
 * Marks the admin as active for 5 minutes — AI will not auto-respond.
 * POST /api/chatbot/admin/[sessionId]/takeover?release=true
 * Releases admin control — AI resumes.
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
  const release = request.nextUrl.searchParams.get('release') === 'true';

  const adminActiveUntil = release ? null : new Date(Date.now() + 5 * 60 * 1000);

  await db.update(chatbotSessions)
    .set({ adminActiveUntil })
    .where(eq(chatbotSessions.id, sessionId));

  return Response.json({ ok: true, adminActiveUntil });
}
