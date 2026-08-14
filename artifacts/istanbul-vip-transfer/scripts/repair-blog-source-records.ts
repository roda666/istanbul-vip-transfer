/**
 * Repair script: create missing BLOG_POST source records in the content table.
 *
 * Root cause: blog posts were served from the static lib/blog-data.ts file
 * without a corresponding DB content row. Translation rows cannot be linked
 * (no entity_id), and the blog admin page reports them as orphaned.
 *
 * This script is IDEMPOTENT — safe to rerun. It will:
 *   1. Print a pre-mutation report of which slugs are missing.
 *   2. Insert only the missing records using INSERT … ON CONFLICT DO NOTHING.
 *   3. Print a post-mutation confirmation with IDs.
 *
 * Run:
 *   cd artifacts/istanbul-vip-transfer
 *   npx tsx scripts/repair-blog-source-records.ts
 */

import { db } from '../db';
import { content } from '../db/schema';
import { blogPosts } from '../lib/blog-data';
import { eq, inArray } from 'drizzle-orm';

const BLOG_SLUGS = blogPosts.map((p) => p.slug);

async function main() {
  console.log('🔍 Blog source record repair — pre-flight check\n');

  // ── 1. Audit: which slugs already have DB rows? ────────────────────────
  const existing = await db
    .select({ id: content.id, slug: content.slug, status: content.status })
    .from(content)
    .where(inArray(content.slug, BLOG_SLUGS));

  const existingBySlag = new Map(existing.map((r) => [r.slug, r]));

  const missing = BLOG_SLUGS.filter((s) => !existingBySlag.has(s));

  console.log('Known blog slugs in blog-data.ts:', BLOG_SLUGS.length);
  console.log('Already in content table:', existing.length);

  if (missing.length === 0) {
    console.log('\n✓ All blog source records already exist — nothing to repair.\n');
    for (const r of existing) {
      console.log(`  · ${r.slug}  (id=${r.id}  status=${r.status})`);
    }
    return;
  }

  console.log('\nMissing records to create:', missing.length);
  for (const s of missing) console.log(`  · ${s}`);

  // ── 2. Backup report ───────────────────────────────────────────────────
  console.log('\n📋 Pre-mutation state:');
  for (const r of existing) {
    console.log(`  EXISTS  id=${r.id}  slug=${r.slug}  status=${r.status}`);
  }
  for (const s of missing) {
    console.log(`  MISSING slug=${s}`);
  }

  // ── 3. Insert missing records (single transaction) ─────────────────────
  const postsToInsert = blogPosts.filter((p) => missing.includes(p.slug));

  const inserted = await db.transaction(async (tx) => {
    const results: { id: string; slug: string }[] = [];
    for (const post of postsToInsert) {
      // INSERT … RETURNING so we get the generated UUID back
      const [row] = await tx
        .insert(content)
        .values({
          contentType:     'BLOG_POST',
          title:           post.title,
          slug:            post.slug,
          excerpt:         post.description ?? null,
          body:            post.body ?? null,
          heroImage:       post.image ?? null,
          heroImageAlt:    post.imageAlt ?? null,
          seoTitle:        post.metaTitle ?? post.title,
          seoDescription:  post.description ?? null,
          status:          'PUBLISHED',
          indexable:       true,
          publishedAt:     new Date(post.publishedAt),
        })
        .onConflictDoNothing()
        .returning({ id: content.id, slug: content.slug });

      if (row) {
        results.push(row);
      } else {
        // Conflict — slug was inserted by a concurrent run
        console.log(`  (conflict on ${post.slug} — already inserted)`);
      }
    }
    return results;
  });

  // ── 4. Post-mutation confirmation ──────────────────────────────────────
  console.log('\n✅ Repair complete:\n');
  for (const r of inserted) {
    console.log(`  CREATED  id=${r.id}  slug=${r.slug}  status=PUBLISHED`);
  }
  if (inserted.length === 0 && missing.length > 0) {
    console.log('  (all conflicts resolved — records already existed)');
  }
  console.log('\nBlog orphan warnings should now be cleared in the admin panel.');
  console.log('Run the blog admin page to confirm.\n');
}

main().catch((err) => {
  console.error('\n❌ Repair failed:', err);
  process.exit(1);
});
