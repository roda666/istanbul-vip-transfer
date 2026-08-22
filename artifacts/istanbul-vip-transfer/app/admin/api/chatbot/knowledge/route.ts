import { NextRequest } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { chatbotKnowledge } from '@/db/schema';
import { requireChatbotManagement } from '@/lib/chatbot-admin-auth';
import { parseKnowledgeInput } from '@/lib/chatbot-knowledge-input';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const access = await requireChatbotManagement();
  if (access.error) return access.error;

  const language = request.nextUrl.searchParams.get('language')?.trim().toLowerCase();
  const activeParam = request.nextUrl.searchParams.get('active');
  const active = activeParam === 'true' ? true : activeParam === 'false' ? false : undefined;

  const filters = [
    language && /^[a-z]{2,8}$/.test(language) ? eq(chatbotKnowledge.language, language) : undefined,
    active === undefined ? undefined : eq(chatbotKnowledge.isActive, active),
  ].filter(Boolean);

  const records = await db
    .select()
    .from(chatbotKnowledge)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(asc(chatbotKnowledge.category), asc(chatbotKnowledge.title));

  return Response.json({ records });
}

export async function POST(request: NextRequest) {
  const access = await requireChatbotManagement();
  if (access.error) return access.error;

  const body = await request.json().catch(() => null);
  const parsed = parseKnowledgeInput(body);
  if (!parsed.value || !parsed.value.title || !parsed.value.answer) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const [record] = await db.insert(chatbotKnowledge).values({
    title: parsed.value.title,
    answer: parsed.value.answer,
    question: parsed.value.question ?? null,
    category: parsed.value.category ?? null,
    language: parsed.value.language ?? 'tr',
    isActive: parsed.value.isActive ?? true,
  }).returning();
  return Response.json({ record }, { status: 201 });
}