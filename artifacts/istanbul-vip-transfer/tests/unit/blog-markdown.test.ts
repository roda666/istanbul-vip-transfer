import { describe, expect, it } from 'vitest';
import { getSafeImageSource, parseMarkdownImage, parsePipeTable } from '../../lib/blog-markdown';

describe('blog Markdown images', () => {
  it('accepts local and configured storage images for optimization', () => {
    expect(getSafeImageSource('/uploads/car.jpg')).toMatchObject({ kind: 'optimized' });
    expect(getSafeImageSource('https://storage.googleapis.com/bucket/car.jpg')).toMatchObject({ kind: 'optimized' });
  });

  it('uses a safe native image only for unsupported HTTP(S) sources and rejects unsafe schemes', () => {
    expect(getSafeImageSource('https://images.example.com/car.jpg')).toMatchObject({ kind: 'native' });
    expect(getSafeImageSource('javascript:alert(1)')).toBeNull();
    expect(parseMarkdownImage('![Car](data:image/png;base64,abc)')).toBeNull();
  });
});

describe('pipe tables', () => {
  it('parses a header, divider, and rows', () => {
    const table = parsePipeTable(['| Vehicle | Seats |', '| --- | :---: |', '| Vito | 6 |'], 0);
    expect(table).toMatchObject({ headers: ['Vehicle', 'Seats'], rows: [['Vito', '6']], endIndex: 3 });
  });

  it('does not treat ordinary pipe text as a table', () => {
    expect(parsePipeTable(['Vehicle | Seats', 'not a divider'], 0)).toBeNull();
  });
});