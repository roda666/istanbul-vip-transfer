import { describe, expect, it } from 'vitest';
import { canRunStudioScheduler } from '@/lib/studio/scheduler-policy';

describe('AI Studio scheduler trigger policy', () => {
  it('preserves CRON_SECRET-authorized legacy schedules when the optional flag is absent', () => {
    expect(canRunStudioScheduler(undefined)).toBe(true);
    expect(canRunStudioScheduler('')).toBe(true);
    expect(canRunStudioScheduler('true')).toBe(true);
  });

  it('stops explicitly disabled or malformed scheduler settings', () => {
    expect(canRunStudioScheduler('false')).toBe(false);
    expect(canRunStudioScheduler('yes')).toBe(false);
  });
});