/**
 * Sends one real X test tweet using the latest published Turkish blog post.
 * Run only with explicit approval: pnpm tsx scripts/test-x-publish.ts
 */
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { content } from '../db/schema';
import { publishXTweet } from '../lib/social-publish';

async function main() {
  const [blog] = await db.select({
    title: content.title,
    slug: content.slug,
  }).from(content).where(and(
    eq(content.contentType, 'BLOG_POST'),
    eq(content.status, 'PUBLISHED'),
  )).orderBy(desc(content.publishedAt)).limit(1);

  if (!blog) throw new Error('Test için yayınlanmış blog yazısı bulunamadı.');
  const url = `https://www.istanbulviptransfer.com/blog/${blog.slug}`;
  const titleLimit = 226;
  const text = `Yeni blog yazımız: ${blog.title.slice(0, titleLimit)}\n${url}`;
  const result = await publishXTweet(text);
  console.log(JSON.stringify({ blogUrl: url, tweetUrl: result.url, tweetId: result.id }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'X test tweet’i başarısız.');
  process.exitCode = 1;
});