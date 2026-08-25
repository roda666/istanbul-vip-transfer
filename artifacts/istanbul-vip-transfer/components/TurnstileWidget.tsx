'use client';

import { useEffect, useRef, useState } from 'react';

type TurnstileForm = 'reservation' | 'contact';
type WidgetState = 'checking' | 'disabled' | 'loading' | 'ready' | 'fallback';

type TurnstileConfig = {
  enabled?: boolean;
  configured?: boolean;
  siteKey?: string;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let apiLoadPromise: Promise<TurnstileApi> | null = null;
const TURNSTILE_WAIT_TIMEOUT_MS = 8_000;

function loadTurnstileApi(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-ivt-turnstile-api="true"]');
    const script = existing ?? document.createElement('script');

    const handleLoad = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Turnstile API hazır değil.'));
    };
    const handleError = () => reject(new Error('Turnstile API yüklenemedi.'));

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });

    if (!existing) {
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.ivtTurnstileApi = 'true';
      document.head.appendChild(script);
    }
  }).catch((error) => {
    apiLoadPromise = null;
    throw error;
  });

  return apiLoadPromise;
}

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), TURNSTILE_WAIT_TIMEOUT_MS);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); },
    );
  });
}

export default function TurnstileWidget({
  form,
  onTokenChange,
  onEnabledChange,
  onUnavailableChange,
}: {
  form: TurnstileForm;
  onTokenChange: (token: string | null) => void;
  onEnabledChange?: (enabled: boolean) => void;
  onUnavailableChange?: (unavailable: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [config, setConfig] = useState<TurnstileConfig | null>(null);
  const [state, setState] = useState<WidgetState>('checking');

  useEffect(() => {
    let active = true;
    onTokenChange(null);
    onUnavailableChange?.(false);
    fetch(`/data/turnstile-config?form=${form}`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data: TurnstileConfig | null) => {
        if (!active) return;
        if (!data?.enabled || !data.configured || !data.siteKey) {
          // No configured Turnstile means no widget and no submission lock.
          // The contact endpoint still enforces rate limits, honeypots, and
          // the signed minimum-time form guard.
          setConfig(null);
          onEnabledChange?.(false);
          setState('disabled');
          return;
        }
        setConfig(data);
        onEnabledChange?.(true);
        // Mount the widget container before the render effect runs. Keeping
        // this as `checking` would leave containerRef null forever while the
        // parent form already requires a Turnstile token.
        setState('loading');
      })
      .catch(() => {
        if (active) {
          // A public config read failure cannot strand a genuine visitor.
          // The server records this fallback and retains its other safeguards.
          setConfig(null);
          onEnabledChange?.(false);
          onUnavailableChange?.(true);
          setState('fallback');
        }
      });

    return () => { active = false; };
  }, [form, onEnabledChange, onTokenChange, onUnavailableChange]);

  useEffect(() => {
    if (!config?.enabled || !config.configured || !config.siteKey || !containerRef.current) return;

    let active = true;
    let challengeTimer: number | null = null;
    const activateFallback = () => {
      if (!active) return;
      if (challengeTimer) window.clearTimeout(challengeTimer);
      onTokenChange(null);
      onEnabledChange?.(false);
      onUnavailableChange?.(true);
      setState('fallback');
    };
    setState('loading');
    withTimeout(loadTurnstileApi(), 'Turnstile API zaman aşımına uğradı.')
      .then((api) => {
        if (!active || !containerRef.current) return;
        widgetIdRef.current = api.render(containerRef.current, {
          sitekey: config.siteKey,
          theme: 'auto',
          size: 'normal',
          action: `ivt_${form}`,
          callback: (token: string) => {
            if (!active) return;
            if (challengeTimer) window.clearTimeout(challengeTimer);
            onTokenChange(token);
            onEnabledChange?.(true);
            onUnavailableChange?.(false);
            setState('ready');
          },
          'expired-callback': () => {
            if (!active) return;
            onTokenChange(null);
            onEnabledChange?.(true);
            onUnavailableChange?.(false);
            setState('loading');
            challengeTimer = window.setTimeout(activateFallback, TURNSTILE_WAIT_TIMEOUT_MS);
          },
          'timeout-callback': () => {
            activateFallback();
          },
          'error-callback': () => {
            activateFallback();
          },
        });
        challengeTimer = window.setTimeout(activateFallback, TURNSTILE_WAIT_TIMEOUT_MS);
      })
      .catch(activateFallback);

    return () => {
      active = false;
      if (challengeTimer) window.clearTimeout(challengeTimer);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [config, form, onEnabledChange, onTokenChange, onUnavailableChange]);

  // Keep both the widget slot and loading copy out of the DOM until a real,
  // configured widget has begun loading.
  if (state === 'checking' || state === 'disabled') return null;

  return (
    <div>
      <div ref={containerRef} data-testid={`turnstile-${form}`} />
      {state === 'loading' && (
        <p aria-live="polite" style={{ color: '#52697A', fontSize: '12px', marginTop: '8px' }}>
          Güvenlik doğrulaması hazırlanıyor…
        </p>
      )}
      {state === 'fallback' && (
        <p role="status" data-testid="turnstile-fallback" style={{ color: '#52697A', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', lineHeight: 1.45, marginTop: '8px' }}>
          Ek spam doğrulaması şu anda erişilemiyor. Form, diğer güvenlik kontrolleriyle gönderilebilir.
        </p>
      )}
    </div>
  );
}