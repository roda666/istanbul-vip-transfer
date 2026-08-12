import { db } from '../db';
import { chatbotMessages, chatbotSessions } from '../db/schema';
import { desc, eq } from 'drizzle-orm';

async function main() {
  const sessions = await db.select().from(chatbotSessions).orderBy(desc(chatbotSessions.createdAt)).limit(10);
  console.log('SESSIONS:', JSON.stringify(sessions, null, 2));
  
  // Check latest session messages
  if (sessions[0]) {
    const msgs = await db.select().from(chatbotMessages)
      .where(eq(chatbotMessages.sessionId, sessions[0].id))
      .orderBy(chatbotMessages.createdAt);
    console.log('LATEST SESSION MESSAGES:', JSON.stringify(msgs, null, 2));
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
