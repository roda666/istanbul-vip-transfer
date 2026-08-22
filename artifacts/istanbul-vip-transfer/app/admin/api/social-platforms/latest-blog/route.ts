import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import 'server-only';
import { requireAdminSession } from '@/lib/auth/session';
import { SITE } from '@/lib/site-config';

/**
 * Supplies the X settings card with the newest public blog post. This is only
 * content lookup; manual sharing itself stays entirely in the browser.
 */
export async function GET() {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { db } = await import('@/db');
  const { content } = await import('@/db/schema');

  const [blog] = await db
    .select({
      title: content.title,
      slug: content.slug,
      excerpt: content.excerpt,
      seoDescription: content.seoDescription,
      ogDescription: content.ogDescription,
    })
    .from(content)
    .where(and(
      eq(content.contentType, 'BLOG_POST'),
      eq(content.status, 'PUBLISHED'),
    ))
    .orderBy(desc(content.publishedAt))
    .limit(1);

  if (!blog) {
    return NextResponse.json({ error: 'Yayınlanmış blog yazısı bulunamadı.' }, { status: 404 });
  }

  return NextResponse.json({
    post: {
      title: blog.title,
      summary: blog.seoDescription ?? blog.ogDescription ?? blog.excerpt,
      url: `${SITE.siteUrl}/blog/${blog.slug}`,
    },
  });
}