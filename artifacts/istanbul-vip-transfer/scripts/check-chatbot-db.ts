import { db } from '../db';
import { chatbotMessages, chatbotSessions } from '../db/schema';
import { desc } from 'drizzle-orm';

async function main() {
  const sessions = await db.select().from(chatbotSessions).orderBy(desc(chatbotSessions.createdAt)).limit(5);
  console.log('SESSIONS:', JSON.stringify(sessions, null, 2));
  const msgs = await db.select().from(chatbotMessages).orderBy(desc(chatbotMessages.createdAt)).limit(15);
  console.log('MESSAGES:', JSON.stringify(msgs, null, 2));
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
