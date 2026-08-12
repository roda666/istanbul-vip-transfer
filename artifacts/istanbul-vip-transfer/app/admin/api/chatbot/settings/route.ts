/**
 * GET  /admin/api/chatbot/settings  — read current settings
 * PATCH /admin/api/chatbot/settings — update aiTimeoutSeconds
 */
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { chatbotSettings } from '@/db/schema';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const [row] = await db.select().from(chatbotSettings).limit(1);
  return Response.json({ settings: row ?? { id: 1, aiTimeoutSeconds: 60 } });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { aiTimeoutSeconds } = await request.json() as { aiTimeoutSeconds: number };
  const secs = Math.max(30, Math.min(3600, Math.floor(Number(aiTimeoutSeconds))));

  await db
    .insert(chatbotSettings)
    .values({ id: 1, aiTimeoutSeconds: secs, updatedAt: new Date() })
    .onConflictDoUpdate({ target: chatbotSettings.id, set: { aiTimeoutSeconds: secs, updatedAt: new Date() } });

  return Response.json({ ok: true, aiTimeoutSeconds: secs });
}
