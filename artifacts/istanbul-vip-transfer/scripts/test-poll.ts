import { db } from '../db';
import { chatbotMessages } from '../db/schema';
import { eq, gt, and } from 'drizzle-orm';

async function main() {
  const sessionId = '00a16ac0-c8b7-4fb6-9436-4d99e7e901fd';
  const afterStr = '2026-08-11T22:12:29.498Z';
  const afterDate = new Date(afterStr);
  
  console.log('afterDate:', afterDate.toISOString());
  
  const messages = await db
    .select()
    .from(chatbotMessages)
    .where(
      and(
        eq(chatbotMessages.sessionId, sessionId),
        gt(chatbotMessages.createdAt, afterDate),
      ),
    )
    .orderBy(chatbotMessages.createdAt);
  
  console.log('Found', messages.length, 'messages after', afterStr);
  console.log(JSON.stringify(messages, null, 2));
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
