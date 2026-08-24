/**
 * POST /admin/api/chatbot/[sessionId]/takeover
 *   Marks the admin as active for 2 minutes — AI will not auto-respond.
 *   Does NOT set humanTakenOver (that only happens when admin actually replies).
 *
 * POST /admin/api/chatbot/[sessionId]/takeover?release=true
 *   Releases admin control completely:
 *   - Clears adminActiveUntil and pendingAiAfter
 *   - Resets humanTakenOver to false so AI can respond again
 */
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { chatbotSessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireChatbotManagement } from '@/lib/chatbot-admin-auth';

export const dynamic = 'force-dynamic';

/** Admin hold window: 2 minutes from now (matches the AI fallback timer). */
const TAKEOVER_HOLD_MS = 2 * 60 * 1000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const access = await requireChatbotManagement();
  if (access.error) return access.error;

  const { sessionId } = await params;
  const release = request.nextUrl.searchParams.get('release') === 'true';

  if (release) {
    // Full release: AI resumes, all counters cleared
    await db.update(chatbotSessions)
      .set({
        adminActiveUntil: null,
        humanTakenOver:   false,
        pendingAiAfter:   null,
      })
      .where(eq(chatbotSessions.id, sessionId));
    return Response.json({ ok: true, adminActiveUntil: null, humanTakenOver: false });
  }

  // Soft takeover: admin gets a 2-minute priority window
  const adminActiveUntil = new Date(Date.now() + TAKEOVER_HOLD_MS);
  await db.update(chatbotSessions)
    .set({ adminActiveUntil })
    .where(eq(chatbotSessions.id, sessionId));

  return Response.json({ ok: true, adminActiveUntil });
}
