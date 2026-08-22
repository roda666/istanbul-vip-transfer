import { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { chatbotKnowledge } from '@/db/schema';
import { requireChatbotManagement } from '@/lib/chatbot-admin-auth';
import { parseTranslationLanguage } from '@/lib/chatbot-knowledge-input';
import { translateFromTurkish, translateToTurkish } from '@/lib/chatbot-translate';

export const dynamic = 'force-dynamic';

async function translateField(text: string | null, sourceLanguage: string, targetLanguage: string) {
  if (!text) return null;
  const turkish = sourceLanguage === 'tr' ? text : await translateToTurkish(text);
  return targetLanguage === 'tr' ? turkish : translateFromTurkish(turkish, targetLanguage);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireChatbotManagement();
  if (access.error) return access.error;

  const targetLanguage = parseTranslationLanguage(await request.json().catch(() => null));
  if (!targetLanguage) return Response.json({ error: 'Hedef dil geçersiz' }, { status: 400 });

  const { id } = await params;
  const [selected] = await db
    .select()
    .from(chatbotKnowledge)
    .where(eq(chatbotKnowledge.id, id))
    .limit(1);
  if (!selected) return Response.json({ error: 'Kayıt bulunamadı' }, { status: 404 });

  const sourceId = selected.sourceId ?? selected.id;
  const [source] = selected.sourceId
    ? await db.select().from(chatbotKnowledge).where(eq(chatbotKnowledge.id, sourceId)).limit(1)
    : [selected];
  if (!source) return Response.json({ error: 'Kaynak kayıt bulunamadı' }, { status: 404 });
  if (targetLanguage === source.language) return Response.json({ record: source, created: false });

  try {
    const [title, question, answer] = await Promise.all([
      translateField(source.title, source.language, targetLanguage),
      translateField(source.question, source.language, targetLanguage),
      translateField(source.answer, source.language, targetLanguage),
    ]);
    const [existing] = await db
      .select()
      .from(chatbotKnowledge)
      .where(
        and(
          eq(chatbotKnowledge.sourceId, source.id),
          eq(chatbotKnowledge.language, targetLanguage),
        ),
      )
      .limit(1);
    const values = {
      title: title ?? source.title,
      question,
      answer: answer ?? source.answer,
      category: source.category,
      language: targetLanguage,
      isActive: source.isActive,
      sourceId: source.id,
      updatedAt: new Date(),
    };
    const [record] = existing
      ? await db.update(chatbotKnowledge).set(values).where(eq(chatbotKnowledge.id, existing.id)).returning()
      : await db.insert(chatbotKnowledge).values(values).returning();

    return Response.json({ record, created: !existing });
  } catch (error) {
    console.error('[chatbot-knowledge] translation failed:', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: 'Çeviri şu anda oluşturulamadı' }, { status: 502 });
  }
}