import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { auditLogs, tollPoints, tollTariffs } from '@/db/schema';
import { requireAdminSession } from '@/lib/auth/session';
import { buildBulkIncreasePreview, parseBulkIncreasePercentage } from '@/lib/toll-bulk-increase';

export const dynamic = 'force-dynamic';

const previewSchema = z.object({
  action: z.literal('PREVIEW'),
  tollPointId: z.string().uuid(),
  percentage: z.string().min(1).max(32),
});
const applySchema = z.object({
  action: z.literal('APPLY'),
  tollPointId: z.string().uuid(),
  percentage: z.string().min(1).max(32),
  previewHash: z.string().length(64),
  idempotencyKey: z.string().uuid(),
});
const inputSchema = z.discriminatedUnion('action', [previewSchema, applySchema]);

class BulkIncreaseError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const currentTariffWhere = (tollPointId: string, now: Date) => and(
  eq(tollTariffs.tollPointId, tollPointId),
  eq(tollTariffs.active, true),
  or(isNull(tollTariffs.validFrom), lte(tollTariffs.validFrom, now)),
  or(isNull(tollTariffs.validUntil), gte(tollTariffs.validUntil, now)),
);

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json({ error: input.error.issues[0]?.message ?? 'Geçersiz toplu zam isteği.' }, { status: 422 });
  }

  try {
    const [point] = await db.select({ id: tollPoints.id, name: tollPoints.name })
      .from(tollPoints)
      .where(eq(tollPoints.id, input.data.tollPointId))
      .limit(1);
    if (!point) return NextResponse.json({ error: 'Geçiş noktası bulunamadı.' }, { status: 404 });

    if (input.data.action === 'PREVIEW') {
      const now = new Date();
      const tariffs = await db.select().from(tollTariffs)
        .where(currentTariffWhere(point.id, now));
      const preview = buildBulkIncreasePreview(tariffs, input.data.percentage);
      return NextResponse.json({
        ...preview,
        tollPointId: point.id,
        tollPointName: point.name,
        idempotencyKey: randomUUID(),
      });
    }

    const applyInput = input.data;
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${applyInput.idempotencyKey}))`);
      const [previousAudit] = await tx.select({ metadata: auditLogs.metadata })
        .from(auditLogs)
        .where(and(
          eq(auditLogs.action, 'TOLL_TARIFF_BULK_PERCENT_INCREASE'),
          sql`${auditLogs.metadata}->>'idempotencyKey' = ${applyInput.idempotencyKey}`,
        ))
        .limit(1);
      if (previousAudit) {
        const metadata = previousAudit.metadata as {
          tollPointId?: string;
          percentage?: string;
          rows?: unknown[];
          skippedEmptyCount?: number;
        };
        const requestedPercentage = parseBulkIncreasePercentage(applyInput.percentage).normalizedPercentage;
        if (metadata.tollPointId !== point.id || metadata.percentage !== requestedPercentage) {
          throw new BulkIncreaseError(409, 'Bu işlem anahtarı farklı bir zam isteği için kullanılmış.');
        }
        return {
          rows: metadata.rows ?? [],
          skippedEmptyCount: metadata.skippedEmptyCount ?? 0,
          alreadyApplied: true,
        };
      }

      const now = new Date();
      await tx.execute(sql`
        select id from toll_tariffs
        where toll_point_id = ${point.id}
          and active = true
          and (valid_from is null or valid_from <= current_timestamp)
          and (valid_until is null or valid_until >= current_timestamp)
        for update
      `);
      const tariffs = await tx.select().from(tollTariffs)
        .where(currentTariffWhere(point.id, now));
      const preview = buildBulkIncreasePreview(tariffs, applyInput.percentage);
      if (preview.previewHash !== applyInput.previewHash) {
        throw new BulkIncreaseError(409, 'Tarifeler önizlemeden sonra değişti. Listeyi yenileyip tekrar önizleyin.');
      }
      if (preview.rows.length === 0) {
        throw new BulkIncreaseError(422, 'Bu geçiş noktasında zam uygulanabilecek güncel fiyat bulunmuyor.');
      }

      for (const row of preview.rows) {
        await tx.update(tollTariffs).set({
          amountKurus: row.newAmountKurus,
          manualAmountKurus: row.newAmountKurus,
          manualUpdatedAt: now,
          updatedAt: now,
          updatedBy: session.adminId,
        }).where(eq(tollTariffs.id, row.tariffId));
      }
      await tx.insert(auditLogs).values({
        adminUserId: session.adminId,
        action: 'TOLL_TARIFF_BULK_PERCENT_INCREASE',
        entityType: 'TollPoint',
        entityId: point.id,
        metadata: {
          idempotencyKey: applyInput.idempotencyKey,
          tollPointId: point.id,
          tollPointName: point.name,
          percentage: preview.normalizedPercentage,
          rows: preview.rows,
          skippedEmptyCount: preview.skippedEmptyCount,
          appliedAt: now.toISOString(),
        },
      });
      return {
        rows: preview.rows,
        skippedEmptyCount: preview.skippedEmptyCount,
        alreadyApplied: false,
      };
    });
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof BulkIncreaseError ? error.status : 500;
    if (!(error instanceof BulkIncreaseError)) {
      console.error('[toll-bulk-increase] operation failed', error);
    }
    return NextResponse.json({
      error: error instanceof BulkIncreaseError ? error.message : 'Toplu zam uygulanamadı. Lütfen tekrar deneyin.',
    }, { status });
  }
}