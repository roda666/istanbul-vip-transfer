import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { chatbotKnowledge } from '@/db/schema';
import { requireChatbotManagement } from '@/lib/chatbot-admin-auth';
import { parseKnowledgeInput } from '@/lib/chatbot-knowledge-input';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireChatbotManagement();
  if (access.error) return access.error;

  const body = await request.json().catch(() => null);
  const parsed = parseKnowledgeInput(body, true);
  if (!parsed.value) return Response.json({ error: parsed.error }, { status: 400 });

  const { id } = await params;
  const [record] = await db
    .update(chatbotKnowledge)
    .set({ ...parsed.value, updatedAt: new Date() })
    .where(eq(chatbotKnowledge.id, id))
    .returning();
  if (!record) return Response.json({ error: 'Kayıt bulunamadı' }, { status: 404 });

  return Response.json({ record });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireChatbotManagement();
  if (access.error) return access.error;

  const { id } = await params;
  const [record] = await db
    .delete(chatbotKnowledge)
    .where(eq(chatbotKnowledge.id, id))
    .returning({ id: chatbotKnowledge.id });
  if (!record) return Response.json({ error: 'Kayıt bulunamadı' }, { status: 404 });

  return Response.json({ ok: true });
}