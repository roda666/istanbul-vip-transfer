import Link from 'next/link';
import type { ReactNode } from 'react';
import SafeArticleImage from '@/components/SafeArticleImage';
import { isSafeLinkHref, parseMarkdownImage, parsePipeTable } from '@/lib/blog-markdown';

/**
 * Renders a markdown-like body string to styled JSX.
 *
 * Supported syntax:
 *   ## Heading 2
 *   ### Heading 3
 *   - list item
 *   [anchor text](url)   – safe internal or HTTP(S) external links
 *   ![alt text](url)     – local/approved optimized image or safe HTTP image
 *   | Header | Header |   – pipe tables with a Markdown divider row
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
      if (!isSafeLinkHref(href)) return label;
      if (href.startsWith('/') || href.startsWith('#')) {
        return (
          <Link
            key={`${baseKey}-${i}`}
            href={href}
            className="underline underline-offset-2 transition-colors hover:text-[#174EA6]"
            style={{ color: '#1D5FD1' }}
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
          className="underline underline-offset-2 transition-colors hover:text-[#174EA6]"
          style={{ color: '#1D5FD1' }}
        >
          {label}
        </a>
      );
    }
    const boldMatch = part.match(/^\*\*(.+?)\*\*$/);
    if (boldMatch) {
      return (
        <strong key={`${baseKey}-${i}`} style={{ color: '#102A43' }}>
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
            style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}
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
          style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#102A43' }}
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
      const image = parseMarkdownImage(line);
      if (image) {
        elements.push(
          <figure key={ek++} className="mb-6">
            <div className="relative aspect-video overflow-hidden rounded-sm bg-[#EDF3F7]">
              <SafeArticleImage
                src={image.src}
                alt={image.alt}
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 768px"
                fill
              />
            </div>
            {image.alt !== 'Article image' && (
              <figcaption className="mt-2 text-xs" style={{ color: '#50677A', fontFamily: 'Inter, sans-serif' }}>
                {image.alt}
              </figcaption>
            )}
          </figure>
        );
        continue;
      }
      const table = parsePipeTable(lines, li);
      if (table) {
        const tableEk = ek++;
        elements.push(
          <div key={tableEk} className="mb-6 overflow-x-auto rounded-sm border border-[#D8E1E8]" role="region" aria-label="Article table" tabIndex={0}>
            <table className="min-w-full border-collapse text-left text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
              <thead className="bg-[#EDF3F7]" style={{ color: '#102A43' }}>
                <tr>{table.headers.map((header, index) => <th key={index} scope="col" className="whitespace-nowrap border-b border-[#D8E1E8] px-4 py-3 font-semibold">{parseInline(header, tableEk * 100 + index)}</th>)}</tr>
              </thead>
              <tbody style={{ color: '#263F55' }}>
                {table.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-[#E8EEF2] last:border-0">
                    {row.map((cell, cellIndex) => <td key={cellIndex} className="whitespace-nowrap px-4 py-3">{parseInline(cell, tableEk * 1000 + rowIndex * 100 + cellIndex)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
        li = table.endIndex - 1;
        continue;
      }
      const lineEk = ek;
      elements.push(
        <p
          key={ek++}
          className="mb-5 text-sm leading-relaxed"
          style={{ color: '#263F55', fontFamily: 'Inter, sans-serif' }}
        >
          {parseInline(line, lineEk)}
        </p>
      );
    }
  }
  flushList();

  return <>{elements}</>;
}
