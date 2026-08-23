import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { isLocaleCodeSyntax } from '@/lib/i18n/locale-registry';
import type { ServicePageBody } from '@/lib/service-page-types';

const schema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z.string().trim().min(3).max(120).regex(/^[a-z0-9-]+$/),
  category: z.string().trim().min(1).max(60),
});

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!['SUPER_ADMIN', 'ADMIN', 'EDITOR'].includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Doğrulama hatası.' }, { status: 422 });
  }
  const { title, slug, category } = parsed.data;
  if (isLocaleCodeSyntax(slug)) {
    return NextResponse.json({ error: 'Dil kodları hizmet slug’ı olarak kullanılamaz.' }, { status: 422 });
  }

  const { db } = await import('@/db');
  const { content, serviceCategories, auditLogs } = await import('@/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const [activeCategory] = await db
    .select({ slug: serviceCategories.slug })
    .from(serviceCategories)
    .where(and(eq(serviceCategories.slug, category), eq(serviceCategories.isActive, true)))
    .limit(1);
  if (!activeCategory) {
    return NextResponse.json({ error: 'Geçerli, aktif bir hizmet kategorisi seçin.' }, { status: 422 });
  }

  const body: ServicePageBody = {
    version: 2,
    hero: {
      badge: '',
      title,
      subtitle: '',
      crumb: title,
      ctaPrimary: 'Rezervasyon Yap',
      ctaSecondary: 'WhatsApp ile Yazın',
    },
    features: [],
    seo: {
      ogTitle: title,
      ogDescription: '',
    },
    contentSections: [],
    faqs: [],
  };

  try {
    const [created] = await db.insert(content).values({
      contentType: 'SERVICE',
      title,
      slug,
      body: JSON.stringify(body),
      status: 'DRAFT',
      canonicalUrl: `/${slug}`,
      category,
      isActive: true,
      indexable: true,
      showOnHomepage: true,
      showInNav: true,
      displayOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never).returning({ id: content.id });

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'CREATE',
      entityType: 'service_page',
      entityId: created.id,
      metadata: { title, slug, category },
    }).catch(() => {});

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('unique') || message.includes('duplicate')) {
      return NextResponse.json({ error: 'Bu slug zaten kullanılıyor.' }, { status: 409 });
    }
    console.error('POST /admin/api/service-pages/create error:', error);
    return NextResponse.json({ error: 'Hizmet oluşturulamadı.' }, { status: 500 });
  }
}