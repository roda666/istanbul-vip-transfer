import Link from 'next/link';
import type { PublicTransferRoute } from '@/lib/transfer-route-pages';
import { localizedServicePath, localizedStaticPath, localizedTransferRoutePath } from '@/lib/localized-service-path';
import { serializeJsonLd } from '@/lib/json-ld';
import { SITE } from '@/lib/site-config';
import CollapsibleBookingForm from '@/components/CollapsibleBookingForm';

const copy = {
  tr: {
    route: 'Transfer Güzergahı',
    distance: 'Mesafe',
    duration: 'Tahmini süre',
    vehicles: 'Uygun araç seçenekleri',
    vehiclesText: 'Mercedes Vito ve Mercedes Sprinter VIP seçenekleriyle seyahat planınıza uygun, konforlu bir transfer organize ediyoruz.',
    service: 'İlgili transfer hizmeti',
    fleet: 'Araç filomuzu inceleyin',
    reserve: 'Rezervasyon talebi oluşturun',
    min: 'dk',
    hours: 'sa',
  },
  en: { route: 'Transfer route', distance: 'Distance', duration: 'Estimated time', vehicles: 'Suitable vehicle options', vehiclesText: 'We arrange a comfortable transfer matched to your plan with Mercedes Vito and Mercedes Sprinter VIP options.', service: 'Related transfer service', fleet: 'Explore our vehicle fleet', reserve: 'Request a booking', min: 'min', hours: 'hr' },
  de: { route: 'Transferroute', distance: 'Entfernung', duration: 'Voraussichtliche Dauer', vehicles: 'Geeignete Fahrzeugoptionen', vehiclesText: 'Mit Mercedes Vito und Mercedes Sprinter VIP Optionen organisieren wir einen komfortablen Transfer passend zu Ihrem Plan.', service: 'Passender Transferservice', fleet: 'Unsere Fahrzeugflotte ansehen', reserve: 'Buchung anfragen', min: 'Min.', hours: 'Std.' },
  ru: { route: 'Маршрут трансфера', distance: 'Расстояние', duration: 'Ориентировочное время', vehicles: 'Подходящие автомобили', vehiclesText: 'Мы организуем комфортный трансфер по вашему плану на Mercedes Vito или Mercedes Sprinter VIP.', service: 'Подходящая услуга трансфера', fleet: 'Посмотреть автопарк', reserve: 'Оставить заявку', min: 'мин', hours: 'ч' },
  ar: { route: 'مسار النقل', distance: 'المسافة', duration: 'المدة التقريبية', vehicles: 'خيارات المركبات المناسبة', vehiclesText: 'ننظم نقلاً مريحاً يناسب خطتك مع خيارات مرسيدس فيتو ومرسيدس سبرينتر VIP.', service: 'خدمة النقل ذات الصلة', fleet: 'استعرض أسطولنا', reserve: 'اطلب الحجز', min: 'د', hours: 'س' },
  fr: { route: 'Itinéraire du transfert', distance: 'Distance', duration: 'Durée estimée', vehicles: 'Véhicules adaptés', vehiclesText: 'Nous organisons un transfert confortable adapté à votre programme avec des options Mercedes Vito et Mercedes Sprinter VIP.', service: 'Service de transfert associé', fleet: 'Découvrir notre flotte', reserve: 'Demander une réservation', min: 'min', hours: 'h' },
  es: { route: 'Ruta de traslado', distance: 'Distancia', duration: 'Tiempo estimado', vehicles: 'Vehículos adecuados', vehiclesText: 'Organizamos un traslado cómodo adaptado a su plan con opciones Mercedes Vito y Mercedes Sprinter VIP.', service: 'Servicio de traslado relacionado', fleet: 'Ver nuestra flota', reserve: 'Solicitar reserva', min: 'min', hours: 'h' },
  it: { route: 'Percorso del trasferimento', distance: 'Distanza', duration: 'Durata stimata', vehicles: 'Veicoli adatti', vehiclesText: 'Organizziamo un trasferimento confortevole in base al tuo programma con opzioni Mercedes Vito e Mercedes Sprinter VIP.', service: 'Servizio di trasferimento correlato', fleet: 'Scopri la nostra flotta', reserve: 'Richiedi una prenotazione', min: 'min', hours: 'h' },
  nl: { route: 'Transferroute', distance: 'Afstand', duration: 'Geschatte duur', vehicles: 'Geschikte voertuigopties', vehiclesText: 'Wij regelen een comfortabele transfer die past bij uw planning met Mercedes Vito- en Mercedes Sprinter VIP-opties.', service: 'Gerelateerde transferservice', fleet: 'Bekijk ons wagenpark', reserve: 'Boeking aanvragen', min: 'min', hours: 'uur' },
} as const;

function formatDuration(minutes: number, min: string, hours: string) {
  if (minutes < 60) return `${minutes} ${min}`;
  const hourPart = Math.floor(minutes / 60);
  const minutePart = minutes % 60;
  return minutePart ? `${hourPart} ${hours} ${minutePart} ${min}` : `${hourPart} ${hours}`;
}

export default function TransferRouteDetail({
  route,
  locale,
}: {
  route: PublicTransferRoute;
  locale: string;
}) {
  const t = copy[locale as keyof typeof copy] ?? copy.en;
  const canonicalPath = localizedTransferRoutePath(route.slug, locale);
  const canonicalUrl = `${SITE.siteUrl}${canonicalPath}`;
  const recommendedService = localizedServicePath(route.relatedServiceSlug || 'vip-transfer', locale);
  const vehiclePath = localizedStaticPath('araclar', locale);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: route.content.title,
    description: route.content.description,
    url: canonicalUrl,
    provider: { '@type': 'Organization', name: 'Istanbul VIP Transfer', url: SITE.siteUrl },
    areaServed: [
      { '@type': 'Place', name: route.origin },
      { '@type': 'Place', name: route.destination },
    ],
    availableChannel: { '@type': 'ServiceChannel', serviceUrl: `${canonicalUrl}#rezervasyon` },
  };
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Istanbul VIP Transfer', item: locale === 'tr' ? SITE.siteUrl : `${SITE.siteUrl}/${locale}` },
      { '@type': 'ListItem', position: 2, name: t.route, item: canonicalUrl },
      { '@type': 'ListItem', position: 3, name: route.content.title, item: canonicalUrl },
    ],
  };

  return (
    <main dir={dir} style={{ background: '#F7F8FC', color: '#172B3A' }}>
      <section style={{ background: 'linear-gradient(135deg, #0C1B2A 0%, #17354B 100%)', color: '#FFF', padding: 'clamp(58px, 9vw, 104px) 24px' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
          <p style={{ color: '#E8B84B', margin: '0 0 14px', fontSize: '12px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' }}>{t.route}</p>
          <h1 style={{ maxWidth: '850px', margin: 0, fontSize: 'clamp(32px, 5vw, 54px)', fontFamily: 'Georgia, serif', lineHeight: 1.12 }}>{route.content.title}</h1>
          <p style={{ maxWidth: '760px', color: 'rgba(255,255,255,.78)', margin: '20px 0 0', lineHeight: 1.75, fontSize: '17px' }}>{route.content.description}</p>
          <a href="#rezervasyon" style={{ display: 'inline-block', marginTop: '28px', borderRadius: '8px', padding: '13px 20px', background: '#C99A32', color: '#0C1B2A', textDecoration: 'none', fontWeight: 700 }}>{t.reserve}</a>
        </div>
      </section>

      <section style={{ maxWidth: '1120px', margin: '0 auto', padding: '32px 24px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
          <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}><div style={{ color: '#718596', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>{t.distance}</div><strong style={{ display: 'block', marginTop: '8px', fontSize: '24px' }}>{route.distanceKm} km</strong></div>
          <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}><div style={{ color: '#718596', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>{t.duration}</div><strong style={{ display: 'block', marginTop: '8px', fontSize: '24px' }}>{formatDuration(route.durationMinutes, t.min, t.hours)}</strong></div>
          <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}><div style={{ color: '#718596', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>{t.vehicles}</div><strong style={{ display: 'block', marginTop: '8px', fontSize: '18px' }}>Mercedes Vito · Sprinter VIP</strong></div>
        </div>
      </section>

      <section style={{ maxWidth: '1120px', margin: '0 auto', padding: '54px 24px' }}>
        <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: 'clamp(24px, 4vw, 42px)' }}>
          <h2 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 'clamp(25px, 4vw, 36px)' }}>{t.vehicles}</h2>
          <p style={{ color: '#52697A', lineHeight: 1.75, maxWidth: '760px' }}>{t.vehiclesText}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '22px' }}>
            <Link href={recommendedService} style={{ border: '1px solid #C99A32', borderRadius: '8px', padding: '11px 15px', color: '#8A671B', fontWeight: 700, textDecoration: 'none' }}>{t.service}</Link>
            <Link href={vehiclePath} style={{ border: '1px solid #CBD5E1', borderRadius: '8px', padding: '11px 15px', color: '#27465A', fontWeight: 700, textDecoration: 'none' }}>{t.fleet}</Link>
          </div>
        </div>
      </section>

      <section style={{ background: '#FFF', borderTop: '1px solid #E2E8F0', padding: '12px 0 54px' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '0 24px' }}>
          <CollapsibleBookingForm />
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbs) }} />
    </main>
  );
}