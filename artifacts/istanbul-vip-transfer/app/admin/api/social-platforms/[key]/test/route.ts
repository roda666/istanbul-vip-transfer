import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs, content } from '@/db/schema';
import { requireSocialPlatformAdmin, socialAuthErrorResponse } from '@/lib/social-auth';
import { publishFacebookPost, publishInstagramPost, publishXTweet } from '@/lib/social-publish';
import { getPublicOrigin } from '@/lib/social-public-url';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://www.istanbulviptransfer.com';
const SUPPORTED_KEYS = ['facebook', 'instagram', 'x'] as const;
type TestableKey = (typeof SUPPORTED_KEYS)[number];

function isTestableKey(key: string): key is TestableKey {
  return SUPPORTED_KEYS.includes(key as TestableKey);
}

function publicImageUrl(value: string, req: Request) {
  return value.startsWith('https://')
    ? value
    : `${getPublicOrigin(req)}${value.startsWith('/') ? value : `/${value}`}`;
}

export async function POST(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  let session;
  try {
    session = await requireSocialPlatformAdmin();
  } catch (error) {
    const response = socialAuthErrorResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }

  const { key } = await params;
  if (!isTestableKey(key)) {
    return NextResponse.json({ error: 'Bu platform için test paylaşımı henüz desteklenmiyor.' }, { status: 400 });
  }

  const [blog] = await db.select({
    id: content.id,
    title: content.title,
    excerpt: content.excerpt,
    slug: content.slug,
    heroImage: content.heroImage,
  }).from(content).where(and(
    eq(content.contentType, 'BLOG_POST'),
    eq(content.status, 'PUBLISHED'),
  )).orderBy(desc(content.publishedAt)).limit(1);

  if (!blog) return NextResponse.json({ error: 'Test için yayınlanmış blog yazısı bulunamadı.' }, { status: 404 });

  const blogUrl = `${SITE_URL}/blog/${blog.slug}`;
  const summary = [blog.title, blog.excerpt?.trim(), blogUrl].filter(Boolean).join('\n\n');

  try {
    const result = key === 'facebook'
      ? await publishFacebookPost({ message: summary.slice(0, 5_000), link: blogUrl })
      : key === 'instagram'
        ? blog.heroImage
          ? await publishInstagramPost({
            caption: summary.slice(0, 2_200),
            imageUrl: publicImageUrl(blog.heroImage, _req),
          })
          : (() => { throw new Error('Instagram test paylaşımı için blog kapak görseli gerekli.'); })()
        : await publishXTweet(`Yeni blog yazımız: ${blog.title.slice(0, 220)}\n${blogUrl}`);

    await db.insert(auditLogs).values({
      adminUserId: session.adminId,
      action: 'SOCIAL_TEST_PUBLISH',
      entityType: 'social_platform',
      entityId: key,
      metadata: { blogId: blog.id, blogUrl },
    });

    return NextResponse.json({ result, blog: { title: blog.title, url: blogUrl } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Test paylaşımı başarısız.' },
      { status: 502 },
    );
  }
}