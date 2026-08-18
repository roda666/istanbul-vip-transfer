import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'İstanbul VIP Transfer',
    short_name:       'VIP Transfer',
    description:      'İstanbul havalimanı transferi ve şehirler arası VIP ulaşım — Mercedes Vito & Sprinter.',
    start_url:        '/',
    display:          'standalone',
    background_color: '#0C1B2A',
    theme_color:      '#102A43',
    icons: [
      {
        src:     '/apple-icon.png',
        sizes:   '180x180',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/icon.svg',
        sizes:   'any',
        type:    'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
