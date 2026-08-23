import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  chatCreate: vi.fn(),
  modelRetrieve: vi.fn(),
}));

vi.mock('openai', () => ({
  OpenAI: class {
    chat = { completions: { create: mocks.chatCreate } };
    models = { retrieve: mocks.modelRetrieve };
  },
}));

describe('AI Studio OpenAI capability check', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    mocks.chatCreate.mockReset().mockResolvedValue({ choices: [{ message: { content: 'pong' } }] });
    mocks.modelRetrieve.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not infer GPT Image health from a successful chat request', async () => {
    mocks.modelRetrieve.mockRejectedValue(new Error('model_not_found'));
    const { checkOpenAIConnectivity } = await import('@/lib/studio/ai-studio');

    const result = await checkOpenAIConnectivity();

    expect(result.chat).toMatchObject({ ok: true });
    expect(result.image).toMatchObject({ ok: false, model: 'gpt-image-2', error: 'Model erişilemiyor.' });
    expect(mocks.modelRetrieve).toHaveBeenCalledWith('gpt-image-2', expect.any(Object));
  });

  it('turns provider rate limits into a safe retryable chat-health failure', async () => {
    mocks.chatCreate.mockRejectedValue(new Error('429 rate limit exceeded for sk-should-never-appear'));
    mocks.modelRetrieve.mockResolvedValue({ id: 'gpt-image-2' });
    const { checkOpenAIConnectivity } = await import('@/lib/studio/ai-studio');

    const result = await checkOpenAIConnectivity();

    expect(result.chat).toMatchObject({ ok: false, error: 'Kota veya hız sınırı aşıldı.' });
    expect(result.chat.error).not.toContain('sk-');
    expect(result.image).toMatchObject({ ok: true });
  });
});