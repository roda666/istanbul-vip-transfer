import { SITE } from '@/lib/site-config';

export const dynamic = 'force-static';

const BODY = `# Istanbul VIP Transfer

> Premium VIP airport transfer and private chauffeur service in Istanbul, Turkey. Luxury Mercedes vehicles (Vito, Sprinter, S-Class), professional drivers, fixed prices, 24/7 availability.

## Services

- VIP airport transfer: Istanbul Airport (IST) and Sabiha Gökçen Airport (SAW) to any location in Istanbul and beyond
- Intercity transfers: private transfers between Istanbul and other Turkish cities
- Private city tours: chauffeured tours in and around Istanbul
- Hourly / daily chauffeur hire

## Languages

Website available in Turkish (default), English (/en), German (/de), Russian (/ru) and Arabic (/ar).

## Key pages

- Homepage: ${SITE.siteUrl}/
- Services: ${SITE.siteUrl}/hizmetler
- Istanbul Airport transfer: ${SITE.siteUrl}/istanbul-havalimani-transfer
- Sabiha Gökçen Airport transfer: ${SITE.siteUrl}/sabiha-gokcen-havalimani-transfer
- Blog: ${SITE.siteUrl}/blog
- Sitemap: ${SITE.siteUrl}/sitemap.xml

## Contact

- Phone / WhatsApp: ${SITE.phoneDisplay}
- Email: ${SITE.email}
- Bookings via website form or WhatsApp; quotes are free and prices are fixed in advance.
`;

export function GET() {
  return new Response(BODY, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
