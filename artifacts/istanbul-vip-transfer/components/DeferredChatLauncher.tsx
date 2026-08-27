'use client';

import { useState, type ComponentType } from 'react';
import { useLang } from '@/lib/i18n/context';
import { useBookingFormVisible } from '@/lib/hooks/useBookingFormVisible';

type ChatWidgetComponent = ComponentType<{ initialOpen?: boolean; modal?: boolean }>;

/**
 * Keeps the chat chunk out of the initial-load path. The launcher has a fixed
 * footprint, so showing it cannot move page content, and imports the widget
 * only after the visitor explicitly asks to chat.
 */
export default function DeferredChatLauncher() {
  const { dict } = useLang();
  const [ChatWidget, setChatWidget] = useState<ChatWidgetComponent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const formVisible = useBookingFormVisible();

  const openChat = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setLoadError(false);
    try {
      const chatModule = await import('./ChatWidget');
      setChatWidget(() => chatModule.default);
    } catch {
      setLoadError(true);
      setIsLoading(false);
    }
  };

  if (ChatWidget) {
    return <ChatWidget initialOpen modal />;
  }

  return (
    <button
      type="button"
      className="ivt-chat-control"
      onClick={openChat}
      aria-label={dict.chatbot.aria}
      aria-busy={isLoading}
      title={dict.chatbot.aria}
      aria-hidden={formVisible || undefined}
      tabIndex={formVisible ? -1 : undefined}
      style={{
        position: 'fixed',
        zIndex: 50,
        bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))',
        right: 'calc(1.25rem + env(safe-area-inset-right, 0px))',
        width: 52,
        height: 52,
        borderRadius: '50%',
        background: '#C99A32',
        border: 'none',
        cursor: isLoading ? 'wait' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 18px rgba(201,154,50,0.45)',
        color: '#fff',
        touchAction: 'manipulation',
        opacity: formVisible ? 0 : 1,
        visibility: formVisible ? 'hidden' : 'visible',
        pointerEvents: formVisible ? 'none' : 'auto',
        transition: 'opacity 0.2s ease, visibility 0.2s ease',
      }}
    >
      {isLoading ? (
        <span aria-live="polite" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
          …
        </span>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
        </svg>
      )}
      {loadError && (
        <span role="alert" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>
          Chat could not be opened. Please try again.
        </span>
      )}
    </button>
  );
}