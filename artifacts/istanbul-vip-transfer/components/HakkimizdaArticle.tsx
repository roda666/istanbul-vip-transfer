'use client';

/**
 * HakkimizdaArticle — SEO-optimised "About Us" editorial article.
 * Reads locale-specific content from lib/i18n/about-content.ts.
 * Falls back to English when a locale entry is missing.
 */
import { ABOUT_CONTENT } from '@/lib/i18n/about-content';
import { useLang } from '@/lib/i18n/context';

export default function HakkimizdaArticle() {
  const { lang } = useLang();
  const content = ABOUT_CONTENT[lang] ?? ABOUT_CONTENT['en'];

  return (
    <article
      style={{
        background: '#ffffff',
        padding: '4rem 1.5rem',
        borderTop: '1px solid #f1f5f9',
      }}
    >
      <div
        style={{
          maxWidth: '780px',
          margin: '0 auto',
          fontFamily: 'inherit',
          color: '#1e293b',
          lineHeight: 1.75,
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(1.5rem, 3.5vw, 2.1rem)',
            fontWeight: 800,
            color: '#0f172a',
            marginBottom: '1.25rem',
            lineHeight: 1.3,
          }}
        >
          {content.pageTitle}
        </h1>

        <p
          style={{
            fontSize: '1.05rem',
            color: '#374151',
            marginBottom: '2.5rem',
            borderLeft: '3px solid #e2e8f0',
            paddingLeft: '1rem',
          }}
        >
          {content.intro}
        </p>

        {content.sections.map((section, i) => (
          <section key={i} style={{ marginBottom: '2.25rem' }}>
            <h2
              style={{
                fontSize: 'clamp(1.1rem, 2.5vw, 1.35rem)',
                fontWeight: 700,
                color: '#0f172a',
                marginBottom: '0.75rem',
                paddingBottom: '0.35rem',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              {section.heading}
            </h2>

            {section.isList && Array.isArray(section.body) ? (
              <ul
                style={{
                  paddingLeft: '1.25rem',
                  margin: 0,
                  listStyleType: 'disc',
                  color: '#374151',
                  fontSize: '0.97rem',
                }}
              >
                {section.body.map((item, j) => (
                  <li key={j} style={{ marginBottom: '0.45rem', lineHeight: 1.65 }}>
                    {item}
                  </li>
                ))}
              </ul>
            ) : Array.isArray(section.body) ? (
              section.body.map((para, j) => (
                <p key={j} style={{ color: '#374151', fontSize: '0.97rem', marginBottom: '0.75rem' }}>
                  {para}
                </p>
              ))
            ) : (
              <p style={{ color: '#374151', fontSize: '0.97rem' }}>{section.body}</p>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}
