import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const categoryPage = readFileSync(new URL(
  '../../app/admin/(protected)/kategoriler/page.tsx',
  import.meta.url,
), 'utf8');
const categoryRoute = readFileSync(new URL(
  '../../app/admin/api/categories/route.ts',
  import.meta.url,
), 'utf8');

describe('category service count contract', () => {
  it('counts SERVICE content by category slug in the API', () => {
    expect(categoryRoute).toContain("WHERE content_type = 'SERVICE'");
    expect(categoryRoute).toContain('GROUP BY category');
    expect(categoryRoute).toContain('serviceCount: countMap[r.slug] ?? 0');
  });

  it('uses the authoritative GET count instead of replacing it with empty client state', () => {
    expect(categoryPage).toContain("typeof c.serviceCount === 'number'");
    expect(categoryPage).not.toContain(
      "serviceCount: current.find(x => x.id === c.id)?.serviceCount ?? 0,\n       })));",
    );
  });
});