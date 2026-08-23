import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const settingsSchema = z.object({
  vatRateBasisPoints: z.number().int().min(0).max(10_000),
  vatDisplayMode: z.enum(['EXCLUDED', 'INCLUDED']),
  eurRoundingKurus: z.number().int().min(1).max(100_000),
  usdRoundingCents: z.number().int().min(1).max(100_000),
  tryRoundingKurus: z.number().int().min(1).max(1_000_000),
  eurTryMode: z.enum(['LIVE', 'MANUAL']),
  eurUsdMode: z.enum(['LIVE', 'MANUAL']),
  manualEurTryMicros: z.number().int().min(1).nullable().optional(),
  manualEurUsdMicros: z.number().int().min(1).nullable().optional(),
  refreshMinutes: z.number().int().min(5).max(1_440),
  deviationBasisPoints: z.number().int().min(0).max(10_000),
}).superRefine((value, ctx) => {
  if (value.eurTryMode === 'MANUAL' && !value.manualEurTryMicros) ctx.addIssue({ code: 'custom', path: ['manualEurTryMicros'], message: 'Manuel EUR/TRY kuru gereklidir.' });
  if (value.eurUsdMode === 'MANUAL' && !value.manualEurUsdMicros) ctx.addIssue({ code: 'custom', path: ['manualEurUsdMicros'], message: 'Manuel EUR/USD kuru gereklidir.' });
});

export async function GET() {
  try {
    await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const [{ db }, schema, { desc, eq }] = await Promise.all([import('@/db'), import('@/db/schema'), import('drizzle-orm')]);
  const [policy, fx, latest] = await Promise.all([
    db.select().from(schema.priceCalculatorSettings).where(eq(schema.priceCalculatorSettings.id, 1)).limit(1),
    db.select().from(schema.exchangeRateSettings).where(eq(schema.exchangeRateSettings.id, 1)).limit(1),
    db.select().from(schema.exchangeRateHistory).where(eq(schema.exchangeRateHistory.source, 'TCMB')).orderBy(desc(schema.exchangeRateHistory.fetchedAt)).limit(1),
  ]);
  return NextResponse.json({ policy: policy[0] ?? null, exchangeRates: fx[0] ?? null, latestTcmb: latest[0] ?? null, publicPricingLocked: true });
}

export async function PUT(request: NextRequest) {
  let session;
  try {
    session = await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const data = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!data.success) return NextResponse.json({ error: data.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });
  const [{ db }, schema] = await Promise.all([import('@/db'), import('@/db/schema')]);
  const now = new Date();
  const [policy] = await db.insert(schema.priceCalculatorSettings).values({
    id: 1, enabled: false, vatRateBasisPoints: data.data.vatRateBasisPoints, vatDisplayMode: data.data.vatDisplayMode,
    eurRoundingKurus: data.data.eurRoundingKurus, usdRoundingCents: data.data.usdRoundingCents, tryRoundingKurus: data.data.tryRoundingKurus,
    updatedAt: now, updatedBy: session.adminId,
  }).onConflictDoUpdate({ target: schema.priceCalculatorSettings.id, set: {
    enabled: false, vatRateBasisPoints: data.data.vatRateBasisPoints, vatDisplayMode: data.data.vatDisplayMode,
    eurRoundingKurus: data.data.eurRoundingKurus, usdRoundingCents: data.data.usdRoundingCents, tryRoundingKurus: data.data.tryRoundingKurus,
    settingsVersion: 1, updatedAt: now, updatedBy: session.adminId,
  } }).returning();
  const [exchangeRates] = await db.insert(schema.exchangeRateSettings).values({
    id: 1, eurTryMode: data.data.eurTryMode, eurUsdMode: data.data.eurUsdMode, manualEurTryMicros: data.data.manualEurTryMicros ?? null,
    manualEurUsdMicros: data.data.manualEurUsdMicros ?? null, refreshMinutes: data.data.refreshMinutes, deviationBasisPoints: data.data.deviationBasisPoints, updatedAt: now, updatedBy: session.adminId,
  }).onConflictDoUpdate({ target: schema.exchangeRateSettings.id, set: {
    eurTryMode: data.data.eurTryMode, eurUsdMode: data.data.eurUsdMode, manualEurTryMicros: data.data.manualEurTryMicros ?? null,
    manualEurUsdMicros: data.data.manualEurUsdMicros ?? null, refreshMinutes: data.data.refreshMinutes, deviationBasisPoints: data.data.deviationBasisPoints, updatedAt: now, updatedBy: session.adminId,
  } }).returning();
  return NextResponse.json({ policy, exchangeRates, publicPricingLocked: true });
}