'use client';

/**
 * Client-side context that holds server-fetched homepage CMS data.
 * The RSC (app/page.tsx, app/[lang]/page.tsx) reads from DB and passes
 * the data here as serialized props — no client fetching required.
 */

import { createContext, useContext } from 'react';
import type { HomepageSections } from './homepage-types';

const HomepageCmsContext = createContext<HomepageSections | null>(null);

export function HomepageCmsProvider({
  data,
  children,
}: {
  data: HomepageSections | null;
  children: React.ReactNode;
}) {
  return (
    <HomepageCmsContext.Provider value={data}>
      {children}
    </HomepageCmsContext.Provider>
  );
}

/**
 * Returns the CMS data for the current locale's homepage.
 * Returns null if no CMS data is available (i18n fallback in effect).
 */
export function useHomepageCms(): HomepageSections | null {
  return useContext(HomepageCmsContext);
}
