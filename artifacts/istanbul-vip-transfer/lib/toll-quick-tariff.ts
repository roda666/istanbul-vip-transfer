import { z } from 'zod';
import { TOLL_VEHICLE_CLASSES } from '@/lib/toll-vehicle-classes';
import { gatePairTariffIdentity, normalizeGateName } from '@/lib/toll-gate-pairs';

const MAX_AMOUNT_KURUS = 100_000_000;

/**
 * Parses the formats admins commonly receive from Turkish and English
 * tariff tables. A lone three-digit comma/dot is deliberately rejected: it
 * is impossible to tell whether "1,234" means 1.234 TRY or 1,234 TRY.
 */
export function parseQuickTariffAmount(value: unknown): number {
  const raw = typeof value === 'number'
    ? (Number.isFinite(value) ? String(value) : '')
    : typeof value === 'string' ? value.trim() : '';
  if (!raw) throw new Error('Ücret pozitif bir TRY tutarı olmalıdır.');

  const withoutCurrency = raw
    .replace(/^(?:₺|TL|TRY)\s*/iu, '')
    .replace(/\s*(?:₺|TL|TRY)$/iu, '');
  if (!withoutCurrency || !/^[\d\s.,\u00a0\u202f]+$/u.test(withoutCurrency)) {
    throw new Error('Ücret geçerli bir TRY tutarı olmalıdır.');
  }

  const hasWhitespace = /[\s\u00a0\u202f]/u.test(withoutCurrency);
  if (hasWhitespace) {
    // Spaces are accepted only as conventional three-digit group separators.
    const grouped = /^\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[,.]\d{1,2})?$/u;
    if (!grouped.test(withoutCurrency)) {
      throw new Error('Ücretteki binlik ayraçları geçersiz.');
    }
  }
  const normalized = withoutCurrency.replace(/[ \u00a0\u202f]/gu, '');
  const commas = [...normalized.matchAll(/,/gu)].map((match) => match.index ?? 0);
  const dots = [...normalized.matchAll(/\./gu)].map((match) => match.index ?? 0);
  const separatorCount = commas.length + dots.length;
  let integerPart = normalized;
  let fractionPart = '';

  if (separatorCount === 0) {
    if (!/^\d+$/u.test(integerPart)) throw new Error('Ücret geçerli bir TRY tutarı olmalıdır.');
  } else if (commas.length > 0 && dots.length > 0) {
    // The final punctuation is the decimal marker; all earlier punctuation
    // must be a three-digit grouping separator.
    const decimalIndex = Math.max(...commas, ...dots);
    const decimalSeparator = normalized[decimalIndex];
    integerPart = normalized.slice(0, decimalIndex);
    fractionPart = normalized.slice(decimalIndex + 1);
    const groupingSeparator = decimalSeparator === ',' ? '.' : ',';
    if (!/^\d{1,3}(?:[,.]\d{3})*$/u.test(integerPart)
      || integerPart.includes(decimalSeparator)
      || integerPart.split(groupingSeparator).some((part, index) => index > 0 && part.length !== 3)
      || !/^\d{1,2}$/u.test(fractionPart)) {
      throw new Error('Ücretteki sayı ayraçları geçersiz.');
    }
    integerPart = integerPart.replace(/[,.]/gu, '');
  } else {
    const separator = commas.length ? ',' : '.';
    const occurrences = separator === ',' ? commas.length : dots.length;
    const parts = normalized.split(separator);
    const finalPart = parts[parts.length - 1] ?? '';
    if (occurrences > 1) {
      if (!parts.every((part, index) => index === 0 ? /^\d{1,3}$/u.test(part) : /^\d{3}$/u.test(part))) {
        throw new Error('Ücretteki binlik ayraçları geçersiz.');
      }
      integerPart = parts.join('');
    } else if (/^\d{1,2}$/u.test(finalPart)) {
      integerPart = parts[0];
      fractionPart = finalPart;
      if (!/^\d+$/u.test(integerPart)) throw new Error('Ücret geçerli bir TRY tutarı olmalıdır.');
    } else if (/^\d{3}$/u.test(finalPart)) {
      throw new Error('Ücret belirsiz: üç haneli ayraç TRY ondalığı mı yoksa binlik ayraç mı olduğunu belirtmiyor.');
    } else {
      throw new Error('Ücrette en fazla iki kuruş hanesi kullanılabilir.');
    }
  }

  if (!/^\d+$/u.test(integerPart) || (fractionPart && !/^\d{1,2}$/u.test(fractionPart))) {
    throw new Error('Ücret geçerli bir TRY tutarı olmalıdır.');
  }
  const kurus = Number(integerPart) * 100 + Number((fractionPart || '').padEnd(2, '0'));
  if (!Number.isSafeInteger(kurus) || kurus < 1 || kurus > MAX_AMOUNT_KURUS) {
    throw new Error('Ücret pozitif ve izin verilen sınırlar içinde olmalıdır.');
  }
  return kurus;
}

export const quickTariffInputSchema = z.object({
  tollPointId: z.string().uuid({ message: 'Geçiş noktası seçilmelidir.' }),
  entryGateName: z.string().max(160).transform(normalizeGateName).refine(Boolean, 'Giriş gişesi zorunludur.'),
  exitGateName: z.string().max(160).transform(normalizeGateName).refine(Boolean, 'Çıkış gişesi zorunludur.'),
  amount: z.union([z.string().max(100), z.number().finite()]).superRefine((value, context) => {
    try {
      parseQuickTariffAmount(value);
    } catch (error) {
      context.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'Ücret geçerli bir TRY tutarı olmalıdır.' });
    }
  }),
  vehicleClass: z.enum(TOLL_VEHICLE_CLASSES, { message: 'Araç sınıfı zorunludur.' }),
});

export function quickTariffIdentity(input: {
  tollPointId: string;
  entryGateName: string;
  exitGateName: string;
  vehicleClass: string;
}): string {
  return gatePairTariffIdentity(input.tollPointId, input.entryGateName, input.exitGateName, input.vehicleClass);
}