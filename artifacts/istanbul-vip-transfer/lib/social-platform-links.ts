/**
 * Social platform link placeholders.
 *
 * Add the URLs you want to expose in the admin integration cards here.
 * These are intentionally kept separate from secrets and OAuth credentials.
 */
export type SocialPlatformLink = {
  key: string;
  name: string;
  description: string;
  connectionUrl: string;
  profileUrl: string;
  docsUrl: string;
};

export const SOCIAL_PLATFORM_LINKS: SocialPlatformLink[] = [
  {
    key: 'facebook',
    name: 'Facebook',
    description: 'Sayfa bağlantısı ve Meta OAuth yönetimi.',
    connectionUrl: '',
    profileUrl: '',
    docsUrl: '',
  },
  {
    key: 'instagram',
    name: 'Instagram',
    description: 'Profesyonel Instagram hesabı ve Meta bağlantısı.',
    connectionUrl: '',
    profileUrl: '',
    docsUrl: '',
  },
  {
    key: 'x',
    name: 'X / Twitter',
    description: 'X hesap bağlantısı ve geliştirici uygulaması.',
    connectionUrl: '',
    profileUrl: '',
    docsUrl: '',
  },
  {
    key: 'linkedin',
    name: 'LinkedIn',
    description: 'Şirket sayfası ve geliştirici uygulaması.',
    connectionUrl: '',
    profileUrl: '',
    docsUrl: '',
  },
  {
    key: 'tiktok',
    name: 'TikTok',
    description: 'TikTok Business hesabı ve geliştirici uygulaması.',
    connectionUrl: '',
    profileUrl: '',
    docsUrl: '',
  },
  {
    key: 'youtube',
    name: 'YouTube',
    description: 'Kanal ve YouTube Data API bağlantısı.',
    connectionUrl: '',
    profileUrl: '',
    docsUrl: '',
  },
  {
    key: 'google-business',
    name: 'Google Business Profile',
    description: 'Google Posts ve yerel işletme profili.',
    connectionUrl: '',
    profileUrl: '',
    docsUrl: '',
  },
  {
    key: 'telegram',
    name: 'Telegram',
    description: 'Bot bağlantısı ve kanal/grup adresi.',
    connectionUrl: '',
    profileUrl: '',
    docsUrl: '',
  },
];