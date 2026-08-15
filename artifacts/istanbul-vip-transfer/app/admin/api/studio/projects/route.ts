/**
 * GET  /admin/api/studio/projects  — list projects (editorial calendar)
 * POST /admin/api/studio/projects  — create new project
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import 'server-only';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  contentType:    z.enum(['blog', 'service']).default('blog'),
  titleWorking:   z.string().min(1).max(300),
  config: z.object({
    serviceType:     z.string().optional(),
    searchIntent:    z.string().optional(),
    cityOrRoute:     z.string().optional(),
    audience:        z.string().optional(),
    keywords:        z.array(z.string()).default([]),
    publishDate:     z.string().optional(),
    tone:            z.string().optional(),
    wordCountTarget: z.number().int().min(300).max(10000).optional(),
    articleType:     z.string().optional(),
    targetService:   z.string().optional(),
    notes:           z.string().optional(),
  }).default({ keywords: [] }),
});

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { db } = await import('@/db');
  const { studioProjects } = await import('@/db/schema');
  const { desc } = await import('drizzle-orm');

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const contentType = url.searchParams.get('contentType');

  const { eq, and } = await import('drizzle-orm');

  const conditions: Parameters<typeof and>[0][] = [];
  if (status && status !== 'all') conditions.push(eq(studioProjects.status, status));
  if (contentType && contentType !== 'all') conditions.push(eq(studioProjects.contentType, contentType));

  const rows = await db
    .select()
    .from(studioProjects)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(studioProjects.updatedAt))
    .limit(100);

  return NextResponse.json({ projects: rows });
}

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireAdminSession(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 }); }

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });
  }

  const { db } = await import('@/db');
  const { studioProjects, studioAudit, adminUsers } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  // Resolve admin UUID
  const [admin] = await db.select({ id: adminUsers.id })
    .from(adminUsers).where(eq(adminUsers.id, session.adminId as never)).limit(1);

  const [project] = await db.insert(studioProjects).values({
    contentType:  parsed.data.contentType,
    titleWorking: parsed.data.titleWorking,
    config:       parsed.data.config as never,
    stage:        'setup',
    status:       'draft',
    createdBy:    admin?.id ?? null,
    createdAt:    new Date(),
    updatedAt:    new Date(),
  }).returning();

  if (!project) return NextResponse.json({ error: 'Proje oluşturulamadı.' }, { status: 500 });

  // Audit
  await db.insert(studioAudit).values({
    projectId: project.id,
    adminId:   admin?.id ?? null,
    action:    'project_created',
    detail:    { contentType: project.contentType, titleWorking: project.titleWorking },
    createdAt: new Date(),
  });

  return NextResponse.json({ project }, { status: 201 });
}
