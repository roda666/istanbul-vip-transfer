import { describe, expect, it } from 'vitest';
import {
  getDraftCadenceSlot,
  isCadenceDue,
  nextDueAtWhenSavingCadence,
  schedulerGuidance,
  uniqueTopicOffset,
  validateDraftCadenceInput,
} from '@/lib/studio/draft-cadence';

const ISTANBUL = 'Europe/Istanbul';
const WEDNESDAY_ISTANBUL = new Date('2026-08-19T15:20:00.000Z'); // 18:20 in Istanbul

describe('automatic draft cadence calendar slots', () => {
  it('enforces the daily quantity bounds selected in the admin panel', () => {
    expect(validateDraftCadenceInput({ period: 'daily', quantity: 3, timezone: ISTANBUL }).ok).toBe(true);
    expect(validateDraftCadenceInput({ period: 'daily', quantity: 0, timezone: ISTANBUL }).ok).toBe(false);
    expect(validateDraftCadenceInput({ period: 'daily', quantity: 11, timezone: ISTANBUL }).ok).toBe(false);
  });

  it('uses local midnight for daily cadence and advances to tomorrow', () => {
    const slot = getDraftCadenceSlot(WEDNESDAY_ISTANBUL, 'daily', ISTANBUL);
    expect(slot.key).toBe('daily:Europe/Istanbul:2026-08-19');
    expect(slot.nextDueAt.toISOString()).toBe('2026-08-19T21:00:00.000Z');
  });

  it('uses Monday boundaries for weekly cadence and remains safe for the legacy weekly trigger', () => {
    const slot = getDraftCadenceSlot(WEDNESDAY_ISTANBUL, 'weekly', ISTANBUL);
    expect(slot.key).toBe('weekly:Europe/Istanbul:2026-08-17');
    expect(slot.startsAt.toISOString()).toBe('2026-08-16T21:00:00.000Z');
    expect(slot.nextDueAt.toISOString()).toBe('2026-08-23T21:00:00.000Z');
  });

  it('uses first-of-month boundaries for monthly cadence', () => {
    const slot = getDraftCadenceSlot(WEDNESDAY_ISTANBUL, 'monthly', ISTANBUL);
    expect(slot.key).toBe('monthly:Europe/Istanbul:2026-08-01');
    expect(slot.nextDueAt.toISOString()).toBe('2026-08-31T21:00:00.000Z');
  });

  it('keeps repeat calls in one calendar slot on the same idempotency key', () => {
    const first = getDraftCadenceSlot(WEDNESDAY_ISTANBUL, 'daily', ISTANBUL);
    const duplicate = getDraftCadenceSlot(new Date('2026-08-19T19:59:59.000Z'), 'daily', ISTANBUL);
    expect(duplicate.key).toBe(first.key);
    expect(uniqueTopicOffset(first.key, 0)).toBe(uniqueTopicOffset(duplicate.key, 0));
    expect(isCadenceDue(WEDNESDAY_ISTANBUL, first.nextDueAt)).toBe(false);
  });

  it('does not reopen an already claimed slot when the admin re-saves settings', () => {
    const slot = getDraftCadenceSlot(WEDNESDAY_ISTANBUL, 'weekly', ISTANBUL);
    expect(nextDueAtWhenSavingCadence(slot, false)).toEqual(slot.startsAt);
    expect(nextDueAtWhenSavingCadence(slot, true)).toEqual(slot.nextDueAt);
  });

  it('uses a different durable claim identity when timezone changes on the same local date', () => {
    const istanbulSlot = getDraftCadenceSlot(WEDNESDAY_ISTANBUL, 'daily', ISTANBUL);
    const utcSlot = getDraftCadenceSlot(WEDNESDAY_ISTANBUL, 'daily', 'UTC');
    expect(istanbulSlot.key).not.toBe(utcSlot.key);
    expect(utcSlot.key).toBe('daily:UTC:2026-08-19');
  });

  it('warns before saving when daily pacing needs a daily external trigger', () => {
    expect(schedulerGuidance('daily').needsMoreFrequentTrigger).toBe(true);
    expect(schedulerGuidance('weekly').needsMoreFrequentTrigger).toBe(false);
    expect(schedulerGuidance('monthly').needsMoreFrequentTrigger).toBe(false);
  });
});