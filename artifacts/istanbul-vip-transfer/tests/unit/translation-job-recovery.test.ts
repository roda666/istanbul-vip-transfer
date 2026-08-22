import { describe, expect, it } from 'vitest';

describe('translation job recovery policy', () => {
  it('documents the retryable state boundary used by the job runner', () => {
    const claimable = new Set(['QUEUED', 'RETRYING']);
    expect(claimable.has('QUEUED')).toBe(true);
    expect(claimable.has('RETRYING')).toBe(true);
    expect(claimable.has('RUNNING')).toBe(false);
    expect(claimable.has('COMPLETED')).toBe(false);
  });
});