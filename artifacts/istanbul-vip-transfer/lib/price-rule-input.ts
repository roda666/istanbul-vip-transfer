import { z } from 'zod';
import { SUPPORTED_PRICE_CURRENCIES } from '@/lib/price-rules';

export const priceRuleInputSchema = z.object({
  routeId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  amountCents: z.number().int().min(1).max(100_000_000),
  currency: z.enum(SUPPORTED_PRICE_CURRENCIES),
  active: z.boolean().default(true),
  notes: z.string().trim().max(1_000).nullable().optional(),
});