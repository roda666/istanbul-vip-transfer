/**
 * POST /admin/api/chatbot/[sessionId]/reply
 *
 * Admin sends a Turkish message → translated to visitor language → saved.
 * Also:
 *  - Sets humanTakenOver = true (AI will never auto-respond again in this session)
 *  - Clears pendingAiAfter (cancels any in-progress 2-minute AI countdown)
 *  - Refreshes adminActiveUntil to 5 minutes from now
 */
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { chatbotSessions, chatbotMessages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireChatbotManagement } from '@/lib/chatbot-admin-auth';
import { normalizeChatbotLanguage } from '@/lib/chatbot-language';
import { verifyTranslationToken } from '@/lib/chatbot-translation-token';
import { validateCustomerTranslation } from '@/lib/chatbot-translate';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const access = await requireChatbotManagement();
  if (access.error) return access.error;

  const { sessionId } = await params;
  const body = await request.json() as {
    content?: string;
    sourceContent?: string;
    translatedContent?: string;
    previewToken?: string;
    clientMessageId?: string;
  };
  const sourceContent = (body.sourceContent ?? body.content ?? '').trim();
  const clientMessageId = body.clientMessageId?.trim() || crypto.randomUUID();

  if (!sourceContent) {
    return Response.json({ error: 'content required' }, { status: 400 });
  }

  const [chatSession] = await db
    .select({ id: chatbotSessions.id, visitorLang: chatbotSessions.visitorLang })
    .from(chatbotSessions)
    .where(eq(chatbotSessions.id, sessionId))
    .limit(1);

  if (!chatSession) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  const target = normalizeChatbotLanguage(chatSession.visitorLang, 'tr');
  let translated = sourceContent;
  if (target !== 'tr') {
    const token = verifyTranslationToken(body.previewToken);
    const editedTranslation = body.translatedContent?.trim() ?? '';
    if (!token || token.sid !== sessionId || token.target !== target
      || token.source !== sourceContent || !editedTranslation
      || !validateCustomerTranslation(sourceContent, editedTranslation, target).valid) {
      return Response.json({
        error: 'Çeviri önizlemesi geçersiz veya hedef dil doğrulanamadı. Türkçe mesaj gönderilmedi.',
        code: 'TRANSLATION_CONFIRMATION_REQUIRED',
      }, { status: 422 });
    }
    translated = editedTranslation;
  } else if (body.translatedContent?.trim()) {
    translated = body.translatedContent.trim();
  }

  // 5-minute active window + permanent human takeover + cancel AI countdown
  const adminActiveUntil = new Date(Date.now() + 5 * 60 * 1000);

  const inserted = await db.transaction(async (tx) => {
    const rows = await tx.insert(chatbotMessages).values({
      sessionId,
      clientMessageId,
      role:      'admin',
      content:   translated,
      contentTr: sourceContent,
      processingStatus: 'completed',
      responseMode: 'admin',
    }).onConflictDoNothing({
      target: [chatbotMessages.sessionId, chatbotMessages.clientMessageId],
    }).returning({ id: chatbotMessages.id });
    if (rows.length) {
      await tx.update(chatbotSessions)
        .set({
          adminActiveUntil,
          humanTakenOver: true,
          pendingAiAfter: null,
          lastMessageAt:  new Date(),
        })
        .where(eq(chatbotSessions.id, sessionId));
    }
    return rows[0] ?? null;
  });

  return Response.json({
    ok: true,
    duplicate: !inserted,
    translatedContent: translated,
    adminActiveUntil,
    clientMessageId,
  });
}
