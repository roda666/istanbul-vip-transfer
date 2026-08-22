/**
 * Calendar-slot calculations for recurring AI Studio draft generation.
 * Kept database-free so cadence rules can be tested independently of cron I/O.
 */

export const DRAFT_CADENCE_PERIODS = ['daily', 'weekly', 'monthly'] as const;
export type DraftCadencePeriod = (typeof DRAFT_CADENCE_PERIODS)[number];

export const DEFAULT_DRAFT_CADENCE = {
  period: 'weekly' as DraftCadencePeriod,
  quantity: 1,
  timezone: 'Europe/Istanbul',
};

export type DraftCadenceSlot = { key: string; startsAt: Date; nextDueAt: Date };
type LocalParts = { year: number; month: number; day: number; weekday: number };

function partsInTimeZone(date: Date, timeZone: string): LocalParts {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(formatted.find((part) => part.type === type)?.value);
  const weekdayName = formatted.find((part) => part.type === 'weekday')?.value ?? 'Mon';
  const weekdayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { year: value('year'), month: value('month'), day: value('day'), weekday: weekdayMap[weekdayName] ?? 1 };
}

function shiftCalendarDate(parts: Pick<LocalParts, 'year' | 'month' | 'day'>, days: number) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

function zonedMidnightToUtc(parts: Pick<LocalParts, 'year' | 'month' | 'day'>, timeZone: string): Date {
  const guess = Date.UTC(parts.year, parts.month - 1, parts.day);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const offsetAt = (timestamp: number) => {
    const fields = formatter.formatToParts(new Date(timestamp));
    const get = (type: Intl.DateTimeFormatPartTypes) => Number(fields.find((part) => part.type === type)?.value ?? 0);
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - timestamp;
  };
  const first = guess - offsetAt(guess);
  return new Date(guess - offsetAt(first));
}

function dateKey(parts: Pick<LocalParts, 'year' | 'month' | 'day'>) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function isValidTimeZone(timeZone: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone }).format(); return true; } catch { return false; }
}

export function normalizeTimeZone(timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone;
}

export function isDraftCadencePeriod(value: unknown): value is DraftCadencePeriod {
  return typeof value === 'string' && (DRAFT_CADENCE_PERIODS as readonly string[]).includes(value);
}

export function validateDraftCadenceInput(input: unknown):
  | { ok: true; value: { period: DraftCadencePeriod; quantity: number; timezone: string } }
  | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Ayar verisi geçersiz.' };
  const { period, quantity, timezone } = input as Record<string, unknown>;
  if (!isDraftCadencePeriod(period)) return { ok: false, error: 'Periyot günlük, haftalık veya aylık olmalı.' };
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return { ok: false, error: 'Taslak adedi 1 ile 10 arasında tam sayı olmalı.' };
  }
  if (typeof timezone !== 'string' || !isValidTimeZone(timezone)) return { ok: false, error: 'Geçerli bir zaman dilimi seçin.' };
  return { ok: true, value: { period, quantity, timezone } };
}

export function getDraftCadenceSlot(now: Date, period: DraftCadencePeriod, timeZone: string): DraftCadenceSlot {
  const local = partsInTimeZone(now, timeZone);
  let start = { year: local.year, month: local.month, day: local.day };
  let next: { year: number; month: number; day: number };
  if (period === 'daily') {
    next = shiftCalendarDate(start, 1);
  } else if (period === 'weekly') {
    start = shiftCalendarDate(start, 1 - local.weekday);
    next = shiftCalendarDate(start, 7);
  } else {
    start = { year: local.year, month: local.month, day: 1 };
    next = local.month === 12 ? { year: local.year + 1, month: 1, day: 1 } : { year: local.year, month: local.month + 1, day: 1 };
  }
  return {
    key: `${period}:${normalizeTimeZone(timeZone)}:${dateKey(start)}`,
    startsAt: zonedMidnightToUtc(start, timeZone),
    nextDueAt: zonedMidnightToUtc(next, timeZone),
  };
}

export function schedulerGuidance(period: DraftCadencePeriod) {
  if (period === 'daily') return {
    needsMoreFrequentTrigger: true,
    message: 'Günlük hedef için harici zamanlayıcıyı haftalıktan en az günlük çalışacak şekilde güncelleyin.',
  };
  if (period === 'weekly') return {
    needsMoreFrequentTrigger: false,
    message: 'Mevcut haftalık zamanlayıcı bu ayarla uyumludur; ek değişiklik gerekmez.',
  };
  return {
    needsMoreFrequentTrigger: false,
    message: 'Mevcut haftalık zamanlayıcı aylık slotu güvenle kontrol eder; ay başlangıcından sonra çalıştığından emin olun.',
  };
}

export function isCadenceDue(now: Date, nextDueAt: Date | null | undefined): boolean {
  return !nextDueAt || nextDueAt.getTime() <= now.getTime();
}

/**
 * Re-saving a cadence must not reopen a calendar slot that has already been
 * claimed. A changed period or normalized timezone has a different key and
 * remains due.
 */
export function nextDueAtWhenSavingCadence(slot: DraftCadenceSlot, currentSlotAlreadyClaimed: boolean): Date {
  return currentSlotAlreadyClaimed ? slot.nextDueAt : slot.startsAt;
}

export function uniqueTopicOffset(slotKey: string, ordinal: number): number {
  let hash = 0;
  for (const char of slotKey) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash) + ordinal;
}