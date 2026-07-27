import type { Metadata } from 'next';
import Link from 'next/link';
import PageHero from '@/components/PageHero';
import BookingForm from '@/components/BookingForm';
import Contact from '@/components/Contact';
import { SITE } from '@/lib/site-config';
import { NAV } from '@/lib/nav-config';

const BASE = SITE.siteUrl;
const PAGE = `${BASE}/hizmetler`;

export const metadata: Metadata = {
  title: 'Hizmetlerimiz | İstanbul VIP Transfer',
  description:
    'İstanbul VIP Transfer hizmet kategorileri: havalimanı transferi, VIP özel transfer, şehirler arası ulaşım ve günübirlik turlar. Mercedes Vito ve Sprinter araçlar.',
  alternates: { canonical: PAGE },
  openGraph: {
    title: 'Hizmetlerimiz | İstanbul VIP Transfer',
    description:
      'İstanbul VIP Transfer hizmet kategorileri: havalimanı transferi, VIP özel transfer, şehirler arası ulaşım ve günübirlik turlar.',
    url: PAGE,
    siteName: 'VIP Transfer Istanbul',
    locale: 'tr_TR',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: BASE },
    { '@type': 'ListItem', position: 2, name: 'Hizmetler', item: PAGE },
  ],
};

// Pull the Hizmetler groups from the single nav-config source
const hizmetlerEntry = NAV.find((e) => e.groups);
const groups = hizmetlerEntry?.groups ?? [];

export default function HizmetlerPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[{ label: 'Ana Sayfa', href: '/' }, { label: 'Hizmetler' }]}
        title="Hizmetlerimiz"
        subtitle="İstanbul ve çevresinde Mercedes Vito ve Sprinter araçlarla sunduğumuz tüm transfer ve tur hizmetleri."
      />

      <section className="py-16 md:py-20 max-w-7xl mx-auto px-5 md:px-8">
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
      </section>

      <BookingForm />
      <Contact />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}
