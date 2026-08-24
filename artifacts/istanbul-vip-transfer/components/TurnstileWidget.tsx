'use client';

import { useEffect, useRef, useState } from 'react';

type TurnstileForm = 'reservation' | 'contact';
type WidgetState = 'disabled' | 'loading' | 'ready' | 'error' | 'unconfigured';

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

export default function TurnstileWidget({
  form,
  onTokenChange,
}: {
  form: TurnstileForm;
  onTokenChange: (token: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [config, setConfig] = useState<TurnstileConfig | null>(null);
  const [state, setState] = useState<WidgetState>('loading');

  useEffect(() => {
    let active = true;
    fetch(`/data/turnstile-config?form=${form}`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data: TurnstileConfig | null) => {
        if (!active) return;
        setConfig(data);
        if (!data?.enabled) setState('disabled');
        else if (!data.configured || !data.siteKey) setState('unconfigured');
      })
      .catch(() => {
        if (active) setState('error');
      });

    return () => { active = false; };
  }, [form]);

  useEffect(() => {
    if (!config?.enabled || !config.configured || !config.siteKey || !containerRef.current) return;

    let active = true;
    setState('loading');
    loadTurnstileApi()
      .then((api) => {
        if (!active || !containerRef.current) return;
        widgetIdRef.current = api.render(containerRef.current, {
          sitekey: config.siteKey,
          theme: 'auto',
          size: 'normal',
          action: `ivt_${form}`,
          callback: (token: string) => {
            if (!active) return;
            onTokenChange(token);
            setState('ready');
          },
          'expired-callback': () => {
            if (!active) return;
            onTokenChange(null);
            setState('loading');
          },
          'timeout-callback': () => {
            if (!active) return;
            onTokenChange(null);
            setState('error');
          },
          'error-callback': () => {
            if (!active) return;
            onTokenChange(null);
            setState('error');
          },
        });
      })
      .catch(() => {
        if (active) setState('error');
      });

    return () => {
      active = false;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [config, form, onTokenChange]);

  if (state === 'disabled') return null;

  if (state === 'unconfigured') {
    return (
      <p role="alert" data-testid="turnstile-unconfigured" style={{ color: '#9A3412', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', lineHeight: 1.45 }}>
        Güvenlik doğrulaması henüz yapılandırılmamış. Lütfen daha sonra tekrar deneyin.
      </p>
    );
  }

  return (
    <div>
      <div ref={containerRef} data-testid={`turnstile-${form}`} />
      {state === 'loading' && (
        <p aria-live="polite" style={{ color: '#52697A', fontSize: '12px', marginTop: '8px' }}>
          Güvenlik doğrulaması hazırlanıyor…
        </p>
      )}
      {state === 'error' && (
        <p role="alert" data-testid="turnstile-error" style={{ color: '#9A3412', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', lineHeight: 1.45, marginTop: '8px' }}>
          Güvenlik doğrulaması şu anda yüklenemedi. Lütfen bağlantınızı kontrol edip birkaç saniye sonra tekrar deneyin.
        </p>
      )}
    </div>
  );
}