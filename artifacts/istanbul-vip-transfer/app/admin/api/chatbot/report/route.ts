import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { chatbotMessages } from '@/db/schema';
import { requireChatbotManagement } from '@/lib/chatbot-admin-auth';

export const dynamic = 'force-dynamic';

const REPORT_DAYS = 30;
const REPORT_LIMIT = 10;

/**
 * Returns a privacy-conscious, exact-question summary for the last 30 days.
 * Questions are grouped after whitespace/case normalization and prefer the
 * Turkish translation already stored for admin use.
 */
export async function GET() {
  const access = await requireChatbotManagement();
  if (access.error) return access.error;

  const questionText = sql<string>`lower(trim(regexp_replace(
    coalesce(nullif(${chatbotMessages.contentTr}, ''), ${chatbotMessages.content}),
    '[[:space:]]+', ' ', 'g'
  )))`;
  const displayQuestion = sql<string>`min(trim(coalesce(
    nullif(${chatbotMessages.contentTr}, ''),
    ${chatbotMessages.content}
  )))`;
  const questionCount = sql<number>`count(*)`.mapWith(Number);
  const lastAskedAt = sql<Date>`max(${chatbotMessages.createdAt})`;
  const since = new Date(Date.now() - REPORT_DAYS * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      question: displayQuestion,
      count: questionCount,
      lastAskedAt,
    })
    .from(chatbotMessages)
    .where(and(
      eq(chatbotMessages.role, 'user'),
      gte(chatbotMessages.createdAt, since),
      sql`${questionText} <> ''`,
    ))
    .groupBy(questionText)
    .orderBy(desc(questionCount), desc(lastAskedAt))
    .limit(REPORT_LIMIT);

  const [total] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(chatbotMessages)
    .where(and(
      eq(chatbotMessages.role, 'user'),
      gte(chatbotMessages.createdAt, since),
      sql`${questionText} <> ''`,
    ));

  return NextResponse.json({
    periodDays: REPORT_DAYS,
    totalQuestions: total?.count ?? 0,
    questions: rows,
  });
}