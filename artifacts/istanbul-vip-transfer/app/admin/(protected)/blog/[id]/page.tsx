import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { content, languages } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import AdminPageHeader from '../../../_components/AdminPageHeader';
import ContentForm from '../../../_components/ContentForm';
import AiTranslateButton from '@/components/AiTranslateButton';

export const metadata: Metadata = { title: 'Blog Yazısını Düzenle | Admin', robots: { index: false } };

export default async function EditBlogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let item: typeof content.$inferSelect | undefined;
  let enabledLangs: string[] = [];

  try {
    const rows = await db.select().from(content).where(eq(content.id, id)).limit(1);
    item = rows[0];
  } catch {
    return <div style={{ padding: '28px 24px', color: '#f87171', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>Veritabanı bağlantı hatası.</div>;
  }

  if (!item || item.contentType !== 'BLOG_POST') notFound();

  // Load enabled non-Turkish languages for the AI translate button
  try {
    const langRows = await db
      .select({ code: languages.code })
      .from(languages)
      .where(and(eq(languages.isEnabled, true)));
    enabledLangs = langRows.map((l) => l.code).filter((c) => c !== 'tr');
  } catch {
    // If languages table doesn't exist yet (migration not run), silently skip
  }

  const dto = {
    ...item,
    approvedAt: item.approvedAt?.toISOString() ?? null,
    scheduledAt: item.scheduledAt?.toISOString() ?? null,
    publishedAt: item.publishedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };

  return (
    <div style={{ padding: '28px 24px' }}>
      <Link
        href="/admin/blog"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#666', fontSize: '13px', fontFamily: 'Inter, sans-serif', textDecoration: 'none', marginBottom: '16px' }}
      >
        <ArrowLeft size={14} /> Blog&apos;a Dön
      </Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <AdminPageHeader title="Blog Yazısını Düzenle" description={item.title} />
        {/* AI translate button — shown for saved (has-ID) articles */}
        {enabledLangs.length > 0 && (
          <AiTranslateButton contentId={id} enabledLangs={enabledLangs} />
        )}
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ContentForm mode="edit" contentType="BLOG_POST" initialData={dto as any} backUrl="/admin/blog" />
    </div>
  );
}
