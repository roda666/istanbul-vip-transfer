'use client';

/**
 * Floating AI chat widget for Istanbul VIP Transfer.
 *
 * Positioning: sits above the WhatsApp float button (offset by 70px).
 * Color scheme: gold (#C99A32) primary, navy (#102A43) text.
 * RTL: follows the page direction automatically via CSS `dir` inheritance.
 * Streams responses from /api/chatbot via SSE.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLang } from '@/lib/i18n/context';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatWidget() {
  const { dict, lang } = useLang();
  const cb = dict.chatbot;

  const [open, setOpen] = useState(false);
  const [appeared, setAppeared] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Entrance delay — same 1.5 s as WhatsAppFloat
  useEffect(() => {
    const t = setTimeout(() => setAppeared(true), 1800);
    return () => clearTimeout(t);
  }, []);

  // Scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput('');
    setError(null);
    const userMsg: Message = { role: 'user', content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setStreaming(true);

    // Placeholder for streaming assistant response
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, lang }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error('stream error');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const payload = JSON.parse(line.slice(6)) as { content?: string; done?: boolean };
            if (payload.done) break;
            if (payload.content) {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: updated[updated.length - 1].content + payload.content,
                };
                return updated;
              });
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'AbortError') return;
      setError(cb.error);
      // Remove empty placeholder on error
      setMessages(prev => {
        const last = prev[prev.length - 1];
        return last?.role === 'assistant' && last.content === '' ? prev.slice(0, -1) : prev;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, messages, streaming, lang, cb.error]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isRtl = lang === 'ar';

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label={cb.title}
          dir={isRtl ? 'rtl' : 'ltr'}
          style={{
            position: 'fixed',
            zIndex: 51,
            bottom: 'calc(8.5rem + env(safe-area-inset-bottom, 0px))',
            right: 'calc(1.25rem + env(safe-area-inset-right, 0px))',
            width: 'min(340px, calc(100vw - 2rem))',
            borderRadius: '1rem',
            boxShadow: '0 8px 40px rgba(16,42,67,0.18)',
            background: '#FFFDF8',
            border: '1px solid #D9E2EC',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            maxHeight: 'min(480px, calc(100dvh - 12rem))',
          }}
        >
          {/* Header */}
          <div
            style={{
              background: '#102A43',
              padding: '0.875rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {/* AI spark icon */}
              <span
                style={{
                  width: 28, height: 28,
                  borderRadius: '50%',
                  background: '#C99A32',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
                </svg>
              </span>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem', letterSpacing: '0.01em' }}>
                {cb.title}
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label={cb.close}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.7)',
                padding: '0.25rem',
                borderRadius: '0.25rem',
                lineHeight: 1,
                fontSize: '1.2rem',
              }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            {/* Welcome */}
            {messages.length === 0 && (
              <div
                style={{
                  background: '#EEF3F9',
                  borderRadius: '0.75rem 0.75rem 0.75rem 0.1rem',
                  padding: '0.75rem 0.875rem',
                  fontSize: '0.875rem',
                  color: '#263F55',
                  lineHeight: 1.55,
                  maxWidth: '88%',
                }}
              >
                {cb.welcome}
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '88%',
                    padding: '0.65rem 0.875rem',
                    borderRadius: msg.role === 'user'
                      ? '0.75rem 0.75rem 0.1rem 0.75rem'
                      : '0.75rem 0.75rem 0.75rem 0.1rem',
                    background: msg.role === 'user' ? '#C99A32' : '#EEF3F9',
                    color: msg.role === 'user' ? '#fff' : '#263F55',
                    fontSize: '0.875rem',
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content || (msg.role === 'assistant' && streaming && i === messages.length - 1
                    ? <span style={{ opacity: 0.6 }}>{cb.typing}</span>
                    : null
                  )}
                </div>
              </div>
            ))}

            {error && (
              <p style={{ fontSize: '0.8rem', color: '#c0392b', textAlign: 'center' }}>{error}</p>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            style={{
              borderTop: '1px solid #D9E2EC',
              padding: '0.625rem 0.75rem',
              display: 'flex',
              gap: '0.5rem',
              flexShrink: 0,
              background: '#FFFDF8',
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={cb.placeholder}
              disabled={streaming}
              dir={isRtl ? 'rtl' : 'ltr'}
              style={{
                flex: 1,
                border: '1px solid #D9E2EC',
                borderRadius: '0.5rem',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                outline: 'none',
                background: '#fff',
                color: '#102A43',
                minWidth: 0,
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
              aria-label={cb.send}
              style={{
                background: '#C99A32',
                border: 'none',
                borderRadius: '0.5rem',
                width: 38,
                height: 38,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: !input.trim() || streaming ? 'not-allowed' : 'pointer',
                opacity: !input.trim() || streaming ? 0.5 : 1,
                flexShrink: 0,
                transition: 'opacity 0.15s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={cb.aria}
        aria-expanded={open}
        style={{
          position: 'fixed',
          zIndex: 50,
          bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))',
          right: 'calc(1.25rem + env(safe-area-inset-right, 0px))',
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: open ? '#102A43' : '#C99A32',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 18px rgba(201,154,50,0.45)',
          opacity: appeared ? 1 : 0,
          visibility: appeared ? 'visible' : 'hidden',
          transform: appeared ? 'scale(1)' : 'scale(0)',
          transition: appeared
            ? 'opacity 0.35s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1), background 0.2s ease, visibility 0s'
            : 'opacity 0.2s ease, transform 0.2s ease, visibility 0s 0.2s',
        }}
      >
        {open ? (
          /* X icon when open */
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        ) : (
          /* Chat bubble icon when closed */
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
          </svg>
        )}
      </button>
    </>
  );
}
