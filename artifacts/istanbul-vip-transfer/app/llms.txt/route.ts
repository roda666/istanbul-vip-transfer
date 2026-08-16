import { SITE } from '@/lib/site-config';
import { getContactSettings } from '@/lib/site-settings-server';

// Dynamic so contact info reflects DB settings without a redeploy
export const dynamic = 'force-dynamic';

export async function GET() {
  const cs = await getContactSettings();

  const body = `# Istanbul VIP Transfer

> Premium VIP airport transfer and private chauffeur service in Istanbul, Turkey. Luxury Mercedes vehicles (Vito, Sprinter, S-Class), professional drivers, fixed prices, 24/7 availability.

## Services

- VIP airport transfer: Istanbul Airport (IST) and Sabiha Gökçen Airport (SAW) to any location in Istanbul and beyond
- Intercity transfers: private transfers between Istanbul and other Turkish cities
- Private city tours: chauffeured tours in and around Istanbul
- Hourly / daily chauffeur hire

## Languages

Website available in Turkish (default), English (/en), German (/de), Russian (/ru), Arabic (/ar), Spanish (/es), French (/fr), Italian (/it) and Dutch (/nl).

## Key pages

- Homepage: ${SITE.siteUrl}/
- Services: ${SITE.siteUrl}/hizmetler
- Istanbul Airport transfer: ${SITE.siteUrl}/istanbul-havalimani-transfer
- Sabiha Gökçen Airport transfer: ${SITE.siteUrl}/sabiha-gokcen-havalimani-transfer
- Blog: ${SITE.siteUrl}/blog
- Sitemap: ${SITE.siteUrl}/sitemap.xml

## Contact

- Phone / WhatsApp: ${cs.phoneDisplay}
- Email: ${cs.email}
- Bookings via website form or WhatsApp; quotes are free and prices are fixed in advance.
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
