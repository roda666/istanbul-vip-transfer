import { describe, expect, it, vi } from 'vitest';
import { persistAssistantReplyForAdmin } from '../../lib/chatbot-response-storage';

describe('assistant reply storage for admin chat', () => {
  it('persists a Turkish admin copy without changing the visitor-language response', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const translate = vi.fn().mockResolvedValue('Sürücü varış kapısında sizi karşılayacak.');

    const saved = await persistAssistantReplyForAdmin(
      'session-en',
      'The driver will meet you at the arrival gate.',
      persist,
      translate,
    );

    expect(saved).toEqual({
      sessionId: 'session-en',
      role: 'assistant',
      content: 'The driver will meet you at the arrival gate.',
      contentTr: 'Sürücü varış kapısında sizi karşılayacak.',
    });
    expect(persist).toHaveBeenCalledWith(saved);
  });

  it('keeps the visitor reply available when Turkish translation fails', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);

    const saved = await persistAssistantReplyForAdmin(
      'session-en',
      'The driver will meet you at the arrival gate.',
      persist,
      async () => { throw new Error('translation unavailable'); },
    );

    expect(saved.contentTr).toBe(saved.content);
  });
});