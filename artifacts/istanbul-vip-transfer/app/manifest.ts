import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'İstanbul VIP Transfer',
    short_name:       'VIP Transfer',
    description:      'İstanbul havalimanı transferi ve şehirler arası VIP ulaşım — Mercedes Vito & Sprinter.',
    start_url:        '/',
    display:          'standalone',
    background_color: '#FDFCF7',
    theme_color:      '#FDFCF7',
    icons: [
      {
        src:     '/app-icon-512.png',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/app-icon-192.png',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/app-icon-maskable-512.png',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
