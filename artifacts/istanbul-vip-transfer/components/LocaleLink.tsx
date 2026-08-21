'use client';

/**
 * LocaleLink — a drop-in replacement for Next.js <Link> that automatically
 * prefixes internal hrefs with the current locale.
 *
 * External URLs (https://, http://, tel:, mailto:, wa.me) are passed through
 * unchanged. Admin and API paths are also left as-is.
 */
import Link from 'next/link';
import type { ComponentPropsWithoutRef } from 'react';
import { useLang } from '@/lib/i18n/context';
import { localizedPublicPath } from '@/lib/localized-service-path';

/** Patterns that must never be locale-prefixed. */
const EXTERNAL = /^(https?:|tel:|mailto:|#|\/admin|\/api|\/data|\/_next)/;

type LocaleLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, 'href'> & {
  href: string;
};

export default function LocaleLink({ href, ...props }: LocaleLinkProps) {
  const { lang } = useLang();
  const target = EXTERNAL.test(href) ? href : localizedPublicPath(href, lang);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <Link href={target as any} {...props} />;
}
