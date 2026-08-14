/**
 * /admin/ai-oneriler/[id] — AI İçerik Önerisi Detay Sayfası (server component)
 * Loads suggestion from DB, then renders client panels.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { aiContentSuggestions, researchSources, topicClusters } from '@/db/schema';
import { eq } from 'drizzle-orm';
import AISuggestionDetail from './_AISuggestionDetail';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const [sug] = await db.select({ suggestedTitle: aiContentSuggestions.suggestedTitle })
    .from(aiContentSuggestions).where(eq(aiContentSuggestions.id, id)).limit(1);
  return {
    title: `${sug?.suggestedTitle ?? 'Öneri'} | AI İçerik Merkezi`,
    robots: { index: false },
  };
}

export default async function AISuggestionDetailPage({ params }: Params) {
  const { id } = await params;

  const [sug] = await db.select().from(aiContentSuggestions).where(eq(aiContentSuggestions.id, id)).limit(1);
  if (!sug) notFound();

  const sources = await db.select().from(researchSources).where(eq(researchSources.suggestionId, id));
  const clusters = await db.select({ id: topicClusters.id, pillarTitle: topicClusters.pillarTitle, pillarSlug: topicClusters.pillarSlug }).from(topicClusters);

  return (
    <AISuggestionDetail
      suggestion={JSON.parse(JSON.stringify(sug))}
      researchSources={JSON.parse(JSON.stringify(sources))}
      availableClusters={clusters}
    />
  );
}
