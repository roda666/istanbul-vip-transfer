import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL(
  '../../app/admin/(protected)/transferler/_TransfersClient.tsx',
  import.meta.url,
), 'utf8');

describe('transfer create response contract', () => {
  it('never parses an HTML error response with response.json directly', () => {
    expect(source).toContain("safeJson<{ item?: Item; error?: string }>(r, 'transfer-create')");
    expect(source).not.toContain("throw new Error((await r.json()).error)");
  });

  it('requires a confirmed created record and shows a success message', () => {
    expect(source).toContain('if (!result.data?.item?.id)');
    expect(source).toContain("setNotice('Transfer başarıyla oluşturuldu.')");
  });
});