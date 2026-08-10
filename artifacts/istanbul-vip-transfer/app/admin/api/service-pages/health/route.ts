/**
 * GET /admin/api/service-pages/health
 *
 * Returns a health report for all SERVICE slugs registered in PAGE_REGISTRY.
 * Flags every slug that is:
 *   - absent from the database entirely       → missing_record
 *   - inactive  (is_active = false)           → inactive
 *   - not published (status != 'PUBLISHED')   → not_published
 *   - missing body JSON                        → body_missing
 *   - body present but fails ServicePageBody  → body_invalid_schema
 *     schema check (e.g. bare `{}` objects)
 *
 * Used by the admin dashboard to surface silent failures before they reach
 * real visitors.
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/session';
import {
  computeServiceHealthIssues,
  getRegisteredServiceSlugs,
  type ServiceDbRow,
  type ServiceHealthReport,
} from '@/lib/service-page-health';
import 'server-only';

export async function GET() {
  try { await requireAdminSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db }      = await import('@/db');
    const { content } = await import('@/db/schema');
    const { eq }      = await import('drizzle-orm');

    // Fetch all SERVICE rows from DB
    const rawRows = await db
      .select()
      .from(content)
      .where(eq(content.contentType, 'SERVICE'));

    const dbRows: ServiceDbRow[] = (rawRows as (typeof rawRows[number] & { isActive: boolean })[]).map(r => ({
      id:       r.id,
      slug:     r.slug,
      title:    r.title,
      status:   r.status,
      isActive: r.isActive,
      body:     r.body ?? null,
    }));

    const registeredSlugs = getRegisteredServiceSlugs();
    const unhealthy       = computeServiceHealthIssues(registeredSlugs, dbRows);

    const report: ServiceHealthReport = {
      checkedAt:      new Date().toISOString(),
      registeredCount: registeredSlugs.length,
      dbCount:         dbRows.length,
      unhealthyCount:  unhealthy.length,
      items:           unhealthy,
    };

    return NextResponse.json(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'DB error';
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
