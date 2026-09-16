import { NextRequest } from 'next/server';
import { db } from '@/db';
import { chatbotSessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireChatbotManagement } from '@/lib/chatbot-admin-auth';
import {
  getChatbotDirection,
  getChatbotLanguageName,
  normalizeChatbotLanguage,
} from '@/lib/chatbot-language';
import { translateFromTurkishStrict } from '@/lib/chatbot-translate';
import { createTranslationToken } from '@/lib/chatbot-translation-token';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const access = await requireChatbotManagement();
  if (access.error) return access.error;
  const { sessionId } = await params;
  const body = await request.json() as { sourceContent?: string };
  const sourceContent = body.sourceContent?.trim() ?? '';
  if (!sourceContent) {
    return Response.json({ error: 'Türkçe kaynak mesaj gerekli.' }, { status: 400 });
  }
  const [session] = await db.select({
    id: chatbotSessions.id,
    visitorLang: chatbotSessions.visitorLang,
  }).from(chatbotSessions).where(eq(chatbotSessions.id, sessionId)).limit(1);
  if (!session) return Response.json({ error: 'Oturum bulunamadı.' }, { status: 404 });

  const target = normalizeChatbotLanguage(session.visitorLang, 'tr');
  try {
    const result = await translateFromTurkishStrict(sourceContent, target);
    const previewToken = createTranslationToken({
      sid: sessionId,
      source: sourceContent,
      target,
      translation: result.translated,
    });
    return Response.json({
      sourceContent,
      targetLanguage: target,
      targetLanguageName: getChatbotLanguageName(target),
      direction: getChatbotDirection(target),
      translatedContent: result.translated,
      previewToken,
      expiresInSeconds: 300,
    });
  } catch {
    return Response.json({
      error: 'Çeviri doğrulanamadı. Türkçe kaynak müşteri için gönderilmedi.',
      code: 'TRANSLATION_VALIDATION_FAILED',
    }, { status: 422 });
  }
}
