import Link from 'next/link';
import Image from 'next/image';
import type { PublicTransferRoute } from '@/lib/transfer-route-pages';
import { localizedServicePath, localizedStaticPath, localizedTransferRoutePath } from '@/lib/localized-service-path';
import { serializeJsonLd } from '@/lib/json-ld';
import { SITE } from '@/lib/site-config';
import CollapsibleBookingForm from '@/components/CollapsibleBookingForm';

const copy = {
  tr: { route: 'Transfer Güzergâhı', distance: 'Yaklaşık mesafe', normal: 'Normal trafik', peak: 'Yoğun saat', crossing: 'Yaka geçişi', yes: 'Var', no: 'Yok', transport: 'Ulaşım seçenekleri', option: 'Seçenek', detail: 'Nasıl çalışır?', downside: 'Bilmeniz gerekenler', fleet: 'Araç seçenekleri', capacity: 'Yolcu kapasitesi', suitable: 'Kimler için uygun?', routeNotes: 'Güzergâh ve trafik notları', faq: 'Sık sorulan sorular', related: 'İlgili rotalar', reserve: 'Teklif al / rezervasyon iste', transfer: 'Özel transfer', allFleet: 'Tüm filoyu inceleyin', min: 'dk', hours: 'sa' },
  en: { route: 'Transfer route', distance: 'Approximate distance', normal: 'Normal traffic', peak: 'Peak hours', crossing: 'Cross-continent passage', yes: 'Yes', no: 'No', transport: 'Transport options', option: 'Option', detail: 'How it works', downside: 'Points to consider', fleet: 'Vehicle options', capacity: 'Passenger capacity', suitable: 'Best for', routeNotes: 'Route and traffic notes', faq: 'Frequently asked questions', related: 'Related routes', reserve: 'Get a quote / request a booking', transfer: 'Private transfer', allFleet: 'View the full fleet', min: 'min', hours: 'hr' },
} as const;

const vehicles = [
  ['Mercedes Vito', '6', 'Bireysel yolcular ve küçük gruplar'],
  ['Volkswagen Transporter', '7', 'Vito sınıfında, daha geniş küçük gruplar'],
  ['Mercedes Sprinter', '10–19', 'Orta ve büyük gruplar'],
  ['Yarım otobüs', '25’e kadar', 'Büyük grup transferleri'],
  ['Otobüs', '45’e kadar', 'Kalabalık etkinlik ve grup transferleri'],
] as const;

function formatDuration(minutes: number | null, min: string, hours: string) {
  if (!minutes) return '—';
  if (minutes < 60) return `${minutes} ${min}`;
  const hourPart = Math.floor(minutes / 60);
  const minutePart = minutes % 60;
  return minutePart ? `${hourPart} ${hours} ${minutePart} ${min}` : `${hourPart} ${hours}`;
}

function durationRange(minimum: number | null, maximum: number | null, t: { min: string; hours: string }) {
  if (!minimum || !maximum) return '—';
  return minimum === maximum
    ? formatDuration(minimum, t.min, t.hours)
    : `${formatDuration(minimum, t.min, t.hours)} – ${formatDuration(maximum, t.min, t.hours)}`;
}

export default function TransferRouteDetail({ route, locale }: { route: PublicTransferRoute; locale: string }) {
  const t = copy[locale as keyof typeof copy] ?? copy.en;
  const canonicalPath = localizedTransferRoutePath(route.slug, locale);
  const canonicalUrl = `${SITE.siteUrl}${canonicalPath}`;
  const recommendedService = localizedServicePath(route.relatedServiceSlug || 'vip-transfer', locale);
  const vehiclePath = localizedStaticPath('araclar', locale);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const intro = route.content.introParagraph || route.content.description;

  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: route.content.title,
    description: intro,
    url: canonicalUrl,
    provider: { '@type': 'Organization', name: 'Istanbul VIP Transfer', url: SITE.siteUrl },
    areaServed: [{ '@type': 'Place', name: route.origin }, { '@type': 'Place', name: route.destination }],
    availableChannel: { '@type': 'ServiceChannel', serviceUrl: `${canonicalUrl}#rezervasyon` },
  };
  const faqSchema = route.content.faqItems.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: route.content.faqItems.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  } : null;
  const pageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: route.content.title,
    url: canonicalUrl,
    primaryImageOfPage: route.imagePath ? `${SITE.siteUrl}${route.imagePath}` : undefined,
  };

  return (
    <main dir={dir} style={{ background: '#F7F8FC', color: '#172B3A' }}>
      <style>{`.route-scroll{overflow-x:auto}.route-table{min-width:640px;width:100%;border-collapse:collapse}.route-table th,.route-table td{padding:14px 16px;border-bottom:1px solid #E2E8F0;text-align:start;vertical-align:top}.route-table th{background:#F8FAFC;color:#52697A;font-size:12px;text-transform:uppercase;letter-spacing:.06em}.route-table td{font-size:14px;line-height:1.55}.route-card{background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:clamp(20px,4vw,38px)}@media(max-width:640px){.route-table{min-width:580px}.route-card{border-radius:12px}}`}</style>
      <section style={{ background: 'linear-gradient(135deg, #0C1B2A 0%, #17354B 100%)', color: '#FFF', padding: 'clamp(52px, 8vw, 88px) 24px' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'grid', gridTemplateColumns: route.imagePath ? 'minmax(0,1.15fr) minmax(280px,.85fr)' : '1fr', gap: '34px', alignItems: 'center' }}>
          <div>
            <p style={{ color: '#E8B84B', margin: '0 0 14px', fontSize: '12px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' }}>{t.route}</p>
            <h1 style={{ maxWidth: '760px', margin: 0, fontSize: 'clamp(32px, 5vw, 54px)', fontFamily: 'Georgia, serif', lineHeight: 1.12 }}>{route.content.title}</h1>
            <p style={{ maxWidth: '760px', color: 'rgba(255,255,255,.86)', margin: '20px 0 0', lineHeight: 1.75, fontSize: '17px' }}>{intro}</p>
            <a href="#rezervasyon" style={{ display: 'inline-block', marginTop: '28px', borderRadius: '8px', padding: '13px 20px', background: '#C99A32', color: '#0C1B2A', textDecoration: 'none', fontWeight: 700 }}>{t.reserve}</a>
          </div>
          {route.imagePath && <Image src={route.imagePath} alt={route.content.title} width={720} height={460} priority sizes="(max-width: 900px) 100vw, 38vw" style={{ width: '100%', height: 'auto', borderRadius: '16px', objectFit: 'cover', border: '1px solid rgba(232,184,75,.48)' }} />}
        </div>
      </section>

      <section style={{ maxWidth: '1120px', margin: '0 auto', padding: '32px 24px 0' }}>
        <div className="route-scroll route-card" style={{ padding: 0 }}>
          <table className="route-table">
            <tbody>
              {/* Operational tolls stay in protected pricing tools. Public route pages
                  show only whether this journey changes continents. */}
              <tr><th>{t.distance}</th><td><strong>{route.distanceKm} km</strong></td><th>{t.crossing}</th><td>{route.hasCrossContinentPassage ? t.yes : t.no}</td></tr>
              <tr><th>{t.normal}</th><td>{durationRange(route.normalDurationMinMinutes, route.normalDurationMaxMinutes, t)}</td><th>{t.peak}</th><td>{durationRange(route.peakDurationMinMinutes, route.peakDurationMaxMinutes, t)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ maxWidth: '1120px', margin: '0 auto', padding: '54px 24px 0' }}>
        <div className="route-card">
          <h2 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 'clamp(26px, 4vw, 36px)' }}>{t.transport}</h2>
          {route.content.transportOptions.length ? <div className="route-scroll" style={{ marginTop: '18px' }}><table className="route-table"><thead><tr><th>{t.option}</th><th>{t.detail}</th><th>{t.downside}</th></tr></thead><tbody>{route.content.transportOptions.map((option) => <tr key={option.name}><td><strong>{option.name}</strong></td><td>{option.summary}</td><td>{option.downside}</td></tr>)}</tbody></table></div> : <p style={{ color: '#52697A', lineHeight: 1.7 }}>{route.content.description}</p>}
        </div>
      </section>

      <section style={{ maxWidth: '1120px', margin: '0 auto', padding: '28px 24px 0' }}>
        <div className="route-card">
          <h2 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 'clamp(26px, 4vw, 36px)' }}>{t.fleet}</h2>
          <div className="route-scroll" style={{ marginTop: '18px' }}>
            <table className="route-table"><thead><tr><th>{t.option}</th><th>{t.capacity}</th><th>{t.suitable}</th></tr></thead><tbody>{vehicles.map(([name, capacity, suitable]) => <tr key={name}><td><strong>{name}</strong></td><td>{capacity}</td><td>{suitable}</td></tr>)}</tbody></table>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '22px' }}>
            <Link href={recommendedService} style={{ border: '1px solid #C99A32', borderRadius: '8px', padding: '11px 15px', color: '#8A671B', fontWeight: 700, textDecoration: 'none' }}>{t.reserve}</Link>
            <Link href={vehiclePath} style={{ border: '1px solid #CBD5E1', borderRadius: '8px', padding: '11px 15px', color: '#27465A', fontWeight: 700, textDecoration: 'none' }}>{t.allFleet}</Link>
          </div>
        </div>
      </section>

      {route.content.routeNotes.length > 0 && <section style={{ maxWidth: '1120px', margin: '0 auto', padding: '28px 24px 0' }}><div className="route-card"><h2 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 'clamp(26px, 4vw, 36px)' }}>{t.routeNotes}</h2><ul style={{ margin: '18px 0 0', paddingInlineStart: '22px', color: '#52697A', lineHeight: 1.8 }}>{route.content.routeNotes.map((note) => <li key={note}>{note}</li>)}</ul></div></section>}

      {route.content.faqItems.length > 0 && <section style={{ maxWidth: '1120px', margin: '0 auto', padding: '28px 24px 0' }}><div className="route-card"><h2 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 'clamp(26px, 4vw, 36px)' }}>{t.faq}</h2><div style={{ marginTop: '18px', display: 'grid', gap: '14px' }}>{route.content.faqItems.map((faq) => <article key={faq.question} style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}><h3 style={{ margin: 0, fontSize: '17px' }}>{faq.question}</h3><p style={{ margin: '8px 0 0', color: '#52697A', lineHeight: 1.7 }}>{faq.answer}</p></article>)}</div></div></section>}

      {route.relatedRoutes.length > 0 && <section style={{ maxWidth: '1120px', margin: '0 auto', padding: '28px 24px 54px' }}><div className="route-card"><h2 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 'clamp(26px, 4vw, 36px)' }}>{t.related}</h2><div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '18px' }}>{route.relatedRoutes.map((related) => <Link key={related.slug} href={localizedTransferRoutePath(related.slug, locale)} style={{ border: '1px solid #CBD5E1', borderRadius: '8px', padding: '11px 14px', color: '#27465A', fontWeight: 700, textDecoration: 'none' }}>{related.name}</Link>)}</div></div></section>}

      <section id="rezervasyon" style={{ background: '#FFF', borderTop: '1px solid #E2E8F0', padding: '12px 0 54px' }}><div style={{ maxWidth: '1120px', margin: '0 auto', padding: '0 24px' }}><CollapsibleBookingForm /></div></section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(pageSchema) }} />
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqSchema) }} />}
    </main>
  );
}