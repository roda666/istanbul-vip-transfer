import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const actionSchema = z.object({
  action: z.enum(['preview', 'apply']),
  confirmationText: z.string().optional(),
});

function deviationBasisPoints(previous: number, candidate: number) {
  return Math.round((Math.abs(candidate - previous) * 10_000) / previous);
}

/** TCMB is the only live source. Applying a changed rate requires explicit confirmation. */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await (await import('@/lib/auth/session')).requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = actionSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });
  try {
    const [{ db }, schema, { desc, eq }] = await Promise.all([
      import('@/db'),
      import('@/db/schema'),
      import('drizzle-orm'),
    ]);
    const { fetchTcmbRates } = await import('@/lib/tcmb-rates');
    const candidate = await fetchTcmbRates();
    const [previous] = await db.select().from(schema.exchangeRateHistory).where(eq(schema.exchangeRateHistory.source, 'TCMB')).orderBy(desc(schema.exchangeRateHistory.fetchedAt)).limit(1);
    const [settings] = await db.select().from(schema.exchangeRateSettings).where(eq(schema.exchangeRateSettings.id, 1)).limit(1);
    const deviation = previous ? {
      eurTry: deviationBasisPoints(previous.eurTryMicros, candidate.eurTryMicros),
      eurUsd: deviationBasisPoints(previous.eurUsdMicros, candidate.eurUsdMicros),
    } : null;
    if (payload.data.action === 'preview') return NextResponse.json({ candidate, previous, deviation, requiresConfirmation: true });
    if (payload.data.confirmationText !== 'KURU UYGULA') {
      return NextResponse.json({ error: 'Kuru uygulamak için “KURU UYGULA” onayı gereklidir.', candidate, deviation }, { status: 422 });
    }
    const [saved] = await db.insert(schema.exchangeRateHistory).values({
      ...candidate,
      fetchedAt: new Date(candidate.fetchedAt),
      publishedAt: new Date(),
      createdBy: session.adminId,
    }).returning();
    if (!settings) {
      await db.insert(schema.exchangeRateSettings).values({ id: 1, updatedBy: session.adminId });
    }
    return NextResponse.json({ item: saved, deviation });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TCMB kuru alınamadı.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}