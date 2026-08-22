import { translateToTurkish } from '@/lib/chatbot-translate';

export type AssistantMessageForStorage = {
  sessionId: string;
  role: 'assistant';
  content: string;
  contentTr: string;
};

/**
 * Creates and persists a visitor-language AI reply with an independent Turkish
 * admin copy. Translation failures intentionally preserve the original reply.
 */
export async function persistAssistantReplyForAdmin(
  sessionId: string,
  content: string,
  persist: (message: AssistantMessageForStorage) => Promise<unknown>,
  translate: (text: string) => Promise<string> = translateToTurkish,
): Promise<AssistantMessageForStorage> {
  let contentTr = content;
  try {
    const translated = await translate(content);
    if (translated) contentTr = translated;
  } catch {
    // The visitor reply remains available even if the admin translation provider fails.
  }

  const message = { sessionId, role: 'assistant' as const, content, contentTr };
  await persist(message);
  return message;
}