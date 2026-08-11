/**
 * Returns the admin-configured AI handoff timeout in milliseconds.
 * Falls back to 60 seconds if the settings row is missing.
 */
export async function getAiTimeoutMs(): Promise<number> {
  try {
    const { db } = await import('@/db');
    const { chatbotSettings } = await import('@/db/schema');
    const [row] = await db.select({ aiTimeoutSeconds: chatbotSettings.aiTimeoutSeconds })
      .from(chatbotSettings)
      .limit(1);
    return (row?.aiTimeoutSeconds ?? 60) * 1000;
  } catch {
    return 60_000;
  }
}
