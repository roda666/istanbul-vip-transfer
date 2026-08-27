import { ArrowRight, Route, BookOpen, CalendarCheck } from 'lucide-react';
import Link from 'next/link';
import { resolveServiceRelatedLinks, type ServiceRelatedLink } from '@/lib/service-related-links';

interface Props {
  links: ServiceRelatedLink[] | null | undefined;
  lang: string;
}

const GROUP_META = {
  'related-service': { label: 'İlgili Hizmetlerimiz', icon: ArrowRight },
  'related-route':   { label: 'Güzergah Detayı',       icon: Route },
  'related-blog':    { label: 'Faydalı Rehberler',     icon: BookOpen },
} as const;

/**
 * Renders curated related-content links (other services, a matching route
 * page, and relevant blog guides) plus a quote-form CTA at the bottom of a
 * service page. Every href is resolved from a stable reference stored in
 * the CMS — see lib/service-related-links.ts.
 *
 * Turkish-only for now: link labels are authored once in Turkish and are
 * not yet part of the translation pipeline (see internalLinks doc-comment
 * on PublishedServicePage). Callers must only render this for lang === 'tr'.
 */
export default function ServiceRelatedLinksSection({ links, lang }: Props) {
  const resolved = resolveServiceRelatedLinks(links, lang);
  if (resolved.length === 0) return null;

  const cta = resolved.find(l => l.group === 'quote-cta');
  const groups = (['related-service', 'related-route', 'related-blog'] as const)
    .map(group => ({ group, items: resolved.filter(l => l.group === group) }))
    .filter(g => g.items.length > 0);

  if (groups.length === 0 && !cta) return null;

  return (
    <section style={{ padding: '48px 24px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '28px',
        }}>
          {groups.map(({ group, items }) => {
            const meta = GROUP_META[group];
            const Icon = meta.icon;
            return (
              <div key={group}>
                <p style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A6516',
                  margin: '0 0 14px',
                }}>
                  <Icon size={14} aria-hidden="true" />
                  {meta.label}
                </p>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        style={{
                          fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#374151',
                          lineHeight: 1.5, textDecoration: 'none', display: 'block',
                        }}
                        className="hover:underline hover:text-[#8A6516]"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {cta && (
          <div style={{ marginTop: '32px', paddingTop: '28px', borderTop: '1px solid #E2E8F0', textAlign: 'center' }}>
            <a
              href={cta.href}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '12px 24px', borderRadius: '8px', background: '#102A43', color: '#FFFFFF',
                fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600, textDecoration: 'none',
              }}
            >
              <CalendarCheck size={16} aria-hidden="true" />
              {cta.label}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
