import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../../app/admin/api/homepage/[locale]/route.ts', import.meta.url), 'utf8');
const runner = readFileSync(new URL('../../lib/translation-job-runner.ts', import.meta.url), 'utf8');

describe('homepage durable translation orchestration', () => {
  it('queues the Turkish source instead of awaiting eight provider calls', () => {
    expect(route).toContain('enqueueCustomerContentTranslations');
    expect(route).toContain("entityType: 'homepage'");
    expect(route).toContain('orchestration.taskCount');
    expect(route).toContain('return NextResponse.json');
  });

  it('has a homepage runner adapter with shared-field application and public cache invalidation', () => {
    expect(runner).toContain("entityType === 'homepage'");
    expect(runner).toContain('syncSharedFields');
    expect(runner).toContain('applyTranslatedFields');
    expect(runner).toContain('revalidatePath(`/${targetLang}`)');
    expect(runner).toContain("status: publishValidated ? 'PUBLISHED' : 'DRAFT'");
  });
});