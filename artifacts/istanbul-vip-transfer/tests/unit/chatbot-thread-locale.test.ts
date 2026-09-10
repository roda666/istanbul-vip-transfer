import { describe, expect, it, vi } from 'vitest';
import { persistAssistantReplyForAdmin } from '../../lib/chatbot-response-storage';

describe('task #87 chatbot thread locale contract', () => {
  it('keeps the visitor-language message and a Turkish admin-readable copy in one thread record', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const saved = await persistAssistantReplyForAdmin(
      'thread-en-1',
      'Your driver will meet you at the airport.',
      persist,
      async () => 'Şoförünüz havalimanında sizi karşılayacak.',
    );
    expect(saved.sessionId).toBe('thread-en-1');
    expect(saved.role).toBe('assistant');
    expect(saved.content).toContain('airport');
    expect(saved.contentTr).toContain('havalimanında');
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'thread-en-1', role: 'assistant',
      content: 'Your driver will meet you at the airport.',
    }));
  });
});