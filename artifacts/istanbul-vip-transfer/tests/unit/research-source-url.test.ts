import { describe, expect, it } from 'vitest';
import { safeResearchSourceHref } from '../../lib/research-source-url';

describe('research source UI URL boundary', () => {
  it('does not turn legacy javascript source URLs into clickable hrefs', () => {
    const legacyRow = { url: 'javascript:alert(document.domain)' };
    // _AISuggestionDetail uses this helper immediately before rendering <a>.
    expect(safeResearchSourceHref(legacyRow.url)).toBeNull();
  });

  it('also rejects data, protocol-relative, malformed and null legacy URLs', () => {
    for (const value of ['data:text/html,unsafe', '//evil.example', 'not a url', null]) {
      expect(safeResearchSourceHref(value)).toBeNull();
    }
  });

  it('permits explicit HTTP(S) links for an anchor', () => {
    expect(safeResearchSourceHref('https://example.com/source')).toBe('https://example.com/source');
  });
});