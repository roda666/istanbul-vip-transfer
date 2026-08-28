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
        src:     '/app-icon-512.png',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'maskable',
      },
      {
        src:     '/favicon-192.png',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/favicon-180.png',
        sizes:   '180x180',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/favicon-32.png',
        sizes:   '32x32',
        type:    'image/png',
        purpose: 'any',
      },
    ],
  };
}
