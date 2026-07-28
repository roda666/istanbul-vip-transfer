'use client';

/**
 * LangContext — provides current language code and UI dictionary to client components.
 * Populated by LangProvider (in PublicLayoutWrapper and [lang]/layout).
 */
import { createContext, useContext } from 'react';
import type { Dictionary } from './types';
import { getDictionary } from './index';

export interface LangContextValue {
  lang: string;
  dict: Dictionary;
}

export const LangContext = createContext<LangContextValue>({
  lang: 'tr',
  dict: getDictionary('tr'),
});

export function useLang(): LangContextValue {
  return useContext(LangContext);
}
