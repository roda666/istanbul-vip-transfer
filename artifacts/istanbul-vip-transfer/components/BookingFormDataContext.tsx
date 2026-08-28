'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  EMPTY_BOOKING_FORM_BOOTSTRAP,
  EMPTY_BOOKING_FORM_OPTIONS,
  type BookingFormBootstrap,
  type BookingFormInitialData,
  type BookingFormOptions,
} from '@/lib/booking-form-types';

interface BookingFormDataContextValue {
  data: BookingFormInitialData;
  lang: string;
}

interface OptionsCacheEntry {
  data?: BookingFormOptions;
  promise?: Promise<BookingFormOptions>;
}

interface LocalizedOptionsState {
  lang: string;
  data: BookingFormOptions;
  status: 'loading' | 'ready' | 'error';
}

const optionsCache = new Map<string, OptionsCacheEntry>();
const BookingFormDataContext = createContext<BookingFormDataContextValue>({
  data: EMPTY_BOOKING_FORM_BOOTSTRAP,
  lang: 'tr',
});

async function requestBookingFormOptions(
  lang: string,
  attempt = 0,
): Promise<BookingFormOptions> {
  const response = await fetch(`/data/booking-form-options?lang=${encodeURIComponent(lang)}`, {
    cache: 'force-cache',
  });
  if (response.ok) return response.json() as Promise<BookingFormOptions>;

  if (response.status >= 500 && attempt < 2) {
    const retryAfterSeconds = Number(response.headers.get('retry-after'));
    const delayMs = Number.isFinite(retryAfterSeconds)
      ? Math.min(Math.max(retryAfterSeconds * 1_000, 250), 4_000)
      : 750 * (attempt + 1);
    await new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
    return requestBookingFormOptions(lang, attempt + 1);
  }

  throw new Error(`Booking options HTTP ${response.status}`);
}

function loadBookingFormOptions(lang: string): Promise<BookingFormOptions> {
  const cached = optionsCache.get(lang);
  if (cached?.data) return Promise.resolve(cached.data);
  if (cached?.promise) return cached.promise;

  const startedAt = performance.now();
  const promise = requestBookingFormOptions(lang)
    .then((options) => {
      optionsCache.set(lang, { data: options });
      document.documentElement.dataset.bookingOptionsReadyMs =
        String(Math.round(performance.now() - startedAt));
      window.dispatchEvent(new CustomEvent('ivt:booking-options-ready'));
      return options;
    })
    .catch((error: unknown) => {
      optionsCache.delete(lang);
      throw error;
    });

  optionsCache.set(lang, { promise });
  return promise;
}

export function BookingFormDataProvider({
  data,
  lang,
  children,
}: {
  data: BookingFormInitialData;
  lang: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    void loadBookingFormOptions(lang).catch((error: unknown) => {
      console.error('Booking form options could not be prefetched.', error);
    });
  }, [lang]);

  const value = useMemo<BookingFormDataContextValue>(
    () => ({ data, lang }),
    [data, lang],
  );

  return (
    <BookingFormDataContext.Provider value={value}>
      {children}
    </BookingFormDataContext.Provider>
  );
}

export function useBookingFormData(): BookingFormBootstrap & {
  optionsStatus: 'loading' | 'ready' | 'error';
  retryOptions: () => void;
} {
  const { data, lang } = useContext(BookingFormDataContext);
  const [localizedOptions, setLocalizedOptions] = useState<LocalizedOptionsState>(() => ({
    lang,
    data: optionsCache.get(lang)?.data ?? EMPTY_BOOKING_FORM_OPTIONS,
    status: optionsCache.get(lang)?.data ? 'ready' : 'loading',
  }));
  const options = localizedOptions.lang === lang
    ? localizedOptions.data
    : EMPTY_BOOKING_FORM_OPTIONS;
  const optionsStatus = localizedOptions.lang === lang
    ? localizedOptions.status
    : 'loading';

  useEffect(() => {
    let active = true;
    setLocalizedOptions((current) => current.lang === lang && current.status === 'ready'
      ? current
      : { lang, data: EMPTY_BOOKING_FORM_OPTIONS, status: 'loading' });
    void loadBookingFormOptions(lang)
      .then((nextOptions) => {
        if (active) setLocalizedOptions({ lang, data: nextOptions, status: 'ready' });
      })
      .catch(() => {
        if (active) setLocalizedOptions({ lang, data: EMPTY_BOOKING_FORM_OPTIONS, status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [lang]);

  const retryOptions = useCallback(() => {
    optionsCache.delete(lang);
    setLocalizedOptions({ lang, data: EMPTY_BOOKING_FORM_OPTIONS, status: 'loading' });
    void loadBookingFormOptions(lang)
      .then((nextOptions) => {
        setLocalizedOptions({ lang, data: nextOptions, status: 'ready' });
      })
      .catch(() => {
        setLocalizedOptions({ lang, data: EMPTY_BOOKING_FORM_OPTIONS, status: 'error' });
      });
  }, [lang]);

  return useMemo(
    () => ({ ...data, ...options, optionsStatus, retryOptions }),
    [data, options, optionsStatus, retryOptions],
  );
}