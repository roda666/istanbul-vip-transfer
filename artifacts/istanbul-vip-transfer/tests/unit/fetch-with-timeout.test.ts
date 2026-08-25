import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

describe('fetchWithTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('rejects a stalled submit request instead of leaving its button locked', async () => {
    vi.useFakeTimers();
    const stalledFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The request timed out.', 'AbortError'));
        }, { once: true });
      })
    ));
    vi.stubGlobal('fetch', stalledFetch);

    const request = fetchWithTimeout('/data/contact', { method: 'POST' }, 500);
    const rejection = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(500);

    await rejection;
    expect(stalledFetch).toHaveBeenCalledOnce();
  });
});