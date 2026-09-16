import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../..');

describe('chatbot multilingual contracts', () => {
  it('keeps explicit AI prompt and fallback coverage for every supported locale', () => {
    const ai = readFileSync(path.join(root, 'lib/chatbot-ai.ts'), 'utf8');
    const safety = readFileSync(path.join(root, 'lib/chatbot-message-safety.ts'), 'utf8');
    for (const lang of ['tr', 'en', 'de', 'ru', 'ar', 'fr', 'es', 'it', 'nl']) {
      expect(ai).toContain(`${lang}:`);
      expect(safety).toContain(`${lang}:`);
    }
    expect(ai).toContain('validateChatbotReplyLanguage');
    expect(ai).toContain('Répondez uniquement en français.');
    expect(ai).toContain('Responda únicamente en español.');
    expect(ai).toContain('Rispondi esclusivamente in italiano.');
    expect(ai).toContain('Antwoord uitsluitend in het Nederlands.');
  });

  it('requires preview confirmation and idempotency for foreign admin replies', () => {
    const reply = readFileSync(path.join(root, 'app/admin/api/chatbot/[sessionId]/reply/route.ts'), 'utf8');
    const preview = readFileSync(path.join(root, 'app/admin/api/chatbot/[sessionId]/preview/route.ts'), 'utf8');
    expect(reply).toContain('verifyTranslationToken');
    expect(reply).toContain('clientMessageId');
    expect(reply).toContain('onConflictDoNothing');
    expect(reply).toContain('TRANSLATION_CONFIRMATION_REQUIRED');
    expect(preview).toContain('createTranslationToken');
    expect(preview).toContain('TRANSLATION_VALIDATION_FAILED');
  });
});
