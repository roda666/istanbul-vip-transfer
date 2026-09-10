import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const artifactRoot = path.resolve(__dirname, '../..');

describe('chatbot retry persistence contract', () => {
  it('uses a stable message id instead of a client-trusted retry flag', () => {
    const route = readFileSync(path.join(artifactRoot, 'app/data/chatbot/route.ts'), 'utf8');
    const widget = readFileSync(path.join(artifactRoot, 'components/ChatWidget.tsx'), 'utf8');

    expect(route).toContain('messageId?: string');
    expect(route).toContain('clientMessageId: messageId');
    expect(route).toContain('onConflictDoNothing');
    expect(route).not.toContain('retry?: boolean');
    expect(widget).toContain('messageId');
    expect(widget).toContain('retryMessageIdRef');
    expect(widget).not.toContain('retry,');
  });

  it('enforces uniqueness within a visitor session in both schema and migration', () => {
    const schema = readFileSync(path.join(artifactRoot, 'db/schema.ts'), 'utf8');
    const migration = readFileSync(
      path.join(artifactRoot, 'drizzle/migrations/0082_chatbot_message_client_id.sql'),
      'utf8',
    );

    expect(schema).toContain('chatbot_messages_session_client_message_unique');
    expect(schema).toContain('table.sessionId,\n    table.clientMessageId');
    expect(migration).toContain('("session_id", "client_message_id")');
  });
});