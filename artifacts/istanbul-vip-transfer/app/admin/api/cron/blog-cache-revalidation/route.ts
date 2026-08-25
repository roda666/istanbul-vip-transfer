import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { content } from '@/db/schema';
import { revalidatePublicBlogPaths } from '@/lib/blog-cms';

export const dynamic = 'force-dynamic';

const SIGNATURE_HEADER = 'x-blog-cache-revalidation-signature';
const SIGNING_CONTEXT = 'blog-cache-revalidation:v1';
const MAX_BODY_BYTES = 2_000;

function signatureFor(body: string, secret: string): Buffer {
  return Buffer.from(
    createHmac('sha256', secret)
      .update(`${SIGNING_CONTEXT}.${body}`)
      .digest('base64url'),
    'base64url',
  );
}

function hasValidSignature(body: string, received: string | null, secret: string): boolean {
  if (!received) return false;
  try {
    const expected = signatureFor(body, secret);
    const actual = Buffer.from(received, 'base64url');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function parseSlugs(body: string): string[] | null {
  try {
    const value = JSON.parse(body) as { slugs?: unknown };
    if (!Array.isArray(value.slugs) || value.slugs.length === 0 || value.slugs.length > 20) return null;
    const slugs = [...new Set(value.slugs)];
    if (!slugs.every(slug => typeof slug === 'string' && /^[a-z0-9-]{1,120}$/.test(slug))) return null;
    return slugs;
  } catch {
    return null;
  }
}

/**
 * Allows trusted server-side batch jobs to invalidate public blog caches after
 * direct database writes. It deliberately uses a signed payload rather than
 * an admin cookie, because jobs do not have an interactive admin session.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const secret = process.env.AUTH_SECRET;
  if (!secret) return NextResponse.json({ error: 'Server configuration error' }, { status: 503 });
  if (body.length === 0 || body.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (!hasValidSignature(body, request.headers.get(SIGNATURE_HEADER), secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const slugs = parseSlugs(body);
  if (!slugs) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const rows = await db
    .select({ id: content.id, slug: content.slug })
    .from(content)
    .where(and(
      inArray(content.slug, slugs),
      eq(content.contentType, 'BLOG_POST'),
    ));

  for (const row of rows) {
    revalidatePublicBlogPaths({ id: row.id, slug: row.slug });
  }

  return NextResponse.json({ revalidated: rows.map(row => row.slug) });
}