'use client';

/**
 * HizmetlerServiceGrid — locale-aware grid of service cards.
 * Reads the active language from context so links stay locale-prefixed
 * even when this component is rendered under /en/hizmetler via the catch-all.
 */
import Link from 'next/link';
import { useLang } from '@/lib/i18n/context';
import { getNav } from '@/lib/nav-config';

export default function HizmetlerServiceGrid() {
  const { lang, dict } = useLang();
  const nav = getNav(lang, dict);
  const hizmetlerEntry = nav.find((e) => e.groups);
  const groups = hizmetlerEntry?.groups ?? [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
      {groups.map((group) => (
        <div
          key={group.groupLabel}
          className="rounded-sm p-8"
          style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.12)' }}
        >
          <h2
            className="text-xs tracking-[0.2em] uppercase mb-5"
            style={{ color: '#C9A84C', fontFamily: 'Inter, sans-serif' }}
          >
            {group.groupLabel}
          </h2>
          <ul className="space-y-3">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 group transition-colors duration-200 hover:text-[#C9A84C]"
                  style={{ color: '#AAA', fontFamily: 'Inter, sans-serif' }}
                >
                  <span
                    className="h-px flex-shrink-0 transition-all duration-200 group-hover:w-6"
                    style={{ width: '14px', background: 'rgba(201,168,76,0.5)' }}
                  />
                  <span className="text-sm">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
