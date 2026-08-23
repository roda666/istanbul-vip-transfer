import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type JournalEntry = { idx: number; when: number; tag: string };

describe('Drizzle migration journal', () => {
  it('puts each newly appended migration after every existing migration timestamp', () => {
    const journalPath = join(process.cwd(), 'drizzle', 'migrations', 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: JournalEntry[] };
    const current = journal.entries.at(-1);
    const existingEntries = journal.entries.slice(0, -1);

    expect(current).toBeDefined();
    expect(current!.idx).toBeGreaterThan(existingEntries.at(-1)!.idx);
    expect(current!.when).toBeGreaterThan(Math.max(...existingEntries.map((entry) => entry.when)));
  });
});