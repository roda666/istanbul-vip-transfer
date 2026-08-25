import { z } from 'zod';
import { TOLL_VEHICLE_CLASSES } from '@/lib/toll-management';

const nullableAmount = z.number().int().min(1).max(100_000_000).nullable().optional();
const nullableText = z.string().trim().max(500).nullable().optional();
const nullableDate = z.string().trim().max(40).nullable().optional();

export const tollPointInputSchema = z.object({
  name: z.string().trim().min(2, 'Geçiş noktası adı en az 2 karakter olmalıdır.').max(160),
  type: z.enum(['BRIDGE', 'TUNNEL', 'HIGHWAY']),
  active: z.boolean().default(true),
});

export const tollTariffInputSchema = z.object({
  tollPointId: z.string().uuid(),
  vehicleClass: z.enum(TOLL_VEHICLE_CLASSES),
  automaticAmountKurus: nullableAmount,
  manualAmountKurus: nullableAmount,
  sourceName: nullableText,
  sourceUrl: nullableText,
  sourceVerified: z.boolean().default(false),
  validFrom: nullableDate,
  validUntil: nullableDate,
  active: z.boolean().default(true),
}).superRefine((value, context) => {
  if (value.automaticAmountKurus == null && value.manualAmountKurus == null) {
    context.addIssue({ code: 'custom', path: ['manualAmountKurus'], message: 'En az bir otomatik veya manuel TRY tutarı gereklidir.' });
  }
  if (value.automaticAmountKurus != null && !value.sourceVerified) {
    context.addIssue({ code: 'custom', path: ['sourceVerified'], message: 'Otomatik tutar yalnız doğrulanmış resmî kaynak için kaydedilebilir.' });
  }
  if (value.sourceVerified && (!value.sourceName?.trim() || !value.sourceUrl?.trim())) {
    context.addIssue({ code: 'custom', path: ['sourceUrl'], message: 'Doğrulanmış kaynak için ad ve HTTPS bağlantısı gereklidir.' });
  }
});

export const tollAlternativeInputSchema = z.object({
  routeId: z.string().uuid(),
  name: z.string().trim().min(2, 'Alternatif adı en az 2 karakter olmalıdır.').max(160),
  active: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  displayOrder: z.number().int().min(0).max(10_000).default(0),
  pointIds: z.array(z.string().uuid()).max(30).default([]),
}).superRefine((value, context) => {
  if (value.isDefault && !value.active) {
    context.addIssue({ code: 'custom', path: ['active'], message: 'Varsayılan alternatif aktif olmalıdır.' });
  }
  if (new Set(value.pointIds).size !== value.pointIds.length) {
    context.addIssue({ code: 'custom', path: ['pointIds'], message: 'Bir geçiş noktası alternatif içinde yalnız bir kez kullanılabilir.' });
  }
});