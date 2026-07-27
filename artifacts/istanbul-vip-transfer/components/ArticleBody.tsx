import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Renders a markdown-like body string to styled JSX.
 *
 * Supported syntax:
 *   ## Heading 2
 *   ### Heading 3
 *   - list item
 *   [anchor text](url)   – internal (starts with /) or external
 *   **bold text**
 *   Empty line           – ends a list block; paragraphs are individual lines
 */

function parseInline(text: string, baseKey: number): ReactNode {
  const TOKEN = /(\[.+?\]\(.+?\)|\*\*.+?\*\*)/g;
  const parts = text.split(TOKEN);
  return parts.map((part, i) => {
    const linkMatch = part.match(/^\[(.+?)\]\((.+?)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      if (href.startsWith('/') || href.startsWith('#')) {
        return (
          <Link
            key={`${baseKey}-${i}`}
            href={href}
            className="transition-colors hover:text-[#E5C36A]"
            style={{ color: '#C9A84C' }}
          >
            {label}
          </Link>
        );
      }
      return (
        <a
          key={`${baseKey}-${i}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-[#E5C36A]"
          style={{ color: '#C9A84C' }}
        >
          {label}
        </a>
      );
    }
    const boldMatch = part.match(/^\*\*(.+?)\*\*$/);
    if (boldMatch) {
      return (
        <strong key={`${baseKey}-${i}`} style={{ color: '#E5E5E5' }}>
          {boldMatch[1]}
        </strong>
      );
    }
    return part;
  });
}

export default function ArticleBody({ body }: { body: string }) {
  const elements: ReactNode[] = [];
  const lines = body.split('\n');
  let listBuffer: string[] = [];
  let ek = 0; // element key counter

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const captured = [...listBuffer];
    const capturedEk = ek;
    elements.push(
      <ul key={ek++} className="mb-5 space-y-2 pl-0">
        {captured.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-3 text-sm leading-relaxed"
            style={{ color: '#888', fontFamily: 'Inter, sans-serif' }}
          >
            <span
              className="mt-2 flex-shrink-0 rounded-full"
              style={{
                width: '4px',
                height: '4px',
                background: '#C9A84C',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span>{parseInline(item, capturedEk * 100 + i)}</span>
          </li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];

    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h2
          key={ek++}
          className="text-xl md:text-2xl font-bold mt-10 mb-4"
          style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#FFFFFF' }}
        >
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <h3
          key={ek++}
          className="text-base font-semibold mt-6 mb-3"
          style={{ fontFamily: 'Inter, sans-serif', color: '#C9A84C', letterSpacing: '0.02em' }}
        >
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith('- ')) {
      listBuffer.push(line.slice(2));
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      const lineEk = ek;
      elements.push(
        <p
          key={ek++}
          className="mb-5 text-sm leading-relaxed"
          style={{ color: '#888', fontFamily: 'Inter, sans-serif' }}
        >
          {parseInline(line, lineEk)}
        </p>
      );
    }
  }
  flushList();

  return <>{elements}</>;
}
