import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd());

describe('G11 FAQ translation overwrite contract', () => {
  it('forces an all-locale regeneration after a Turkish edit and scans output before write', () => {
    const endpoint = readFileSync(resolve(root, 'app/admin/api/faqs/[id]/route.ts'), 'utf8');
    const runner = readFileSync(resolve(root, 'lib/translation-job-runner.ts'), 'utf8');
    expect(endpoint).toContain("force: true");
    expect(runner).toContain("findTollFeeViolations(text, targetLang)");
    expect(runner).toContain('assertFaqTranslationSafe(aiResult.data)');
  });

  it('keeps an edit form in the exact FAQ row rather than rendering it at page top', () => {
    const page = readFileSync(resolve(root, 'app/admin/(protected)/sss/page.tsx'), 'utf8');
    expect(page).toContain('data-testid={`faq-row-${faq.id}`}');
    expect(page).toContain('data-testid={`faq-editor-${faq.id}`}');
    expect(page).toContain('editId === faq.id');
    expect(page).toContain('showForm && !editId');
  });
});