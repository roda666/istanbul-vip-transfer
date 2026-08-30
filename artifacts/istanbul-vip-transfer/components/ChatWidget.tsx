'use client';

/**
 * Floating AI + admin hybrid chat widget.
 *
 * Flow:
 *  1. Customer sends a message → POST /api/chatbot
 *  2a. If admin is NOT active → streams AI response (SSE)
 *  2b. If admin IS active → returns { mode:'admin' } → widget polls /api/chatbot/[id]/poll
 *  3. When admin replies it appears via poll; polling stops on AI takeover.
 *
 * Session ID is generated once and stored in sessionStorage so it survives
 * page refreshes but not new tabs (intentional: each tab = one session).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLang } from '@/lib/i18n/context';
import { useBookingFormVisible } from '@/lib/hooks/useBookingFormVisible';

interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'admin';
  content: string;
  pending?: boolean;
}

const SESSION_KEY = 'ivt_chat_sid';
const ADMIN_POLL_INTERVAL = 3000; // ms

function renderChatMessageContent(content: string) {
  return content.split(/(https:\/\/[^\s]+)/g).map((part, index) => {
    if (!part.startsWith('https://')) return part;
    try {
      const url = new URL(part);
      return (
        <a
          key={`${url.href}-${index}`}
          href={url.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'inherit', textDecoration: 'underline', overflowWrap: 'anywhere' }}
        >
          {part}
        </a>
      );
    } catch {
      return part;
    }
  });
}

export default function ChatWidget({
  initialOpen = false,
  modal = false,
}: {
  initialOpen?: boolean;
  /** Used by DeferredChatLauncher so its explicit-open flow is a real modal. */
  modal?: boolean;
}) {
  const { dict, lang } = useLang();
  const cb = dict.chatbot;

  const [open, setOpen]         = useState(initialOpen);
  // When opened from the deferred launcher, keep the return target visible
  // immediately if the visitor closes the dialog before the usual entrance delay.
  const [appeared, setAppeared] = useState(initialOpen);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [streaming, setStreaming] = useState(false);
  const [adminMode, setAdminMode] = useState(false); // waiting for human admin reply
  const [error, setError]       = useState<string | null>(null);

  const sessionIdRef  = useRef<string | null>(null);
  const bottomRef     = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLInputElement>(null);
  const dialogRef     = useRef<HTMLDivElement>(null);
  const launcherRef   = useRef<HTMLButtonElement>(null);
  const abortRef      = useRef<AbortController | null>(null);
  const pollTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPollTime  = useRef<string>(new Date().toISOString());
  const formVisible   = useBookingFormVisible();

  // Entrance delay
  useEffect(() => {
    const t = setTimeout(() => setAppeared(true), 1800);
    return () => clearTimeout(t);
  }, []);

  // Restore history only when the visitor opens the panel. This avoids an API
  // request and state work for a widget that may never be used.
  useEffect(() => {
    if (!open) return;
    const sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) return;
    sessionIdRef.current = sid;

    // Load full conversation history so page-refresh doesn't wipe the chat
    fetch(`/data/chatbot/${sid}/poll?after=${encodeURIComponent('1970-01-01T00:00:00.000Z')}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { messages: Array<{ id: string; role: string; content: string; createdAt: string }> } | null) => {
        if (!data?.messages?.length) return;
        const lastMsg = data.messages[data.messages.length - 1];
        // Advance 1 ms past the last loaded message so the live poll
        // doesn't re-fetch messages we already have.
        lastPollTime.current = new Date(new Date(lastMsg.createdAt).getTime() + 1).toISOString();
        setMessages(data.messages.map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant' | 'admin',
          content: m.content,
        })));
      })
      .catch(() => {/* ignore — fresh start is fine */});
  }, [open]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  // ── Persistent admin-reply polling ──────────────────────────────────────
  // Poll only while the conversation panel is open. A visitor who reopens it
  // receives the complete history above, so no human reply is lost while the
  // widget is closed.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      const sid = sessionIdRef.current;
      if (sid) {
        try {
          const res = await fetch(
            `/data/chatbot/${sid}/poll?after=${encodeURIComponent(lastPollTime.current)}`,
          );
          if (res.ok && !cancelled) {
            const data = await res.json() as {
              messages: Array<{ id: string; role: string; content: string; createdAt: string }>;
              aiModeRestored?: boolean;
            };
            if (data.messages.length > 0) {
              // Advance 1 ms past the last returned message to prevent the
              // boundary record from being re-fetched on the next poll.
              const lastCreatedAt = data.messages[data.messages.length - 1].createdAt;
              lastPollTime.current = new Date(new Date(lastCreatedAt).getTime() + 1).toISOString();
            }

            // Admin messages: direct human reply
            const adminMsgs = data.messages.filter(m => m.role === 'admin');
            // AI messages surfaced via poll: 2-minute fallback kicked in
            const aiRestoreMsgs = data.aiModeRestored
              ? data.messages.filter(m => m.role === 'assistant')
              : [];

            const incomingMsgs = [...adminMsgs, ...aiRestoreMsgs];
            if (incomingMsgs.length > 0) {
              setMessages(prev => {
                const existingIds = new Set(prev.map(m => m.id).filter(Boolean));
                const newMsgs = incomingMsgs.filter(m => !existingIds.has(m.id));
                if (newMsgs.length === 0) return prev;
                // Drop any pending "..." bubble and append the real messages
                return [
                  ...prev.filter(m => !m.pending),
                  ...newMsgs.map(m => ({
                    id:      m.id,
                    role:    m.role as 'admin' | 'assistant',
                    content: m.content,
                  })),
                ];
              });
              setAdminMode(false);
            } else if (data.aiModeRestored) {
              // Timer elapsed but no last user message to respond to — just exit admin mode
              setAdminMode(false);
              setMessages(prev => prev.filter(m => !m.pending));
            }
          }
        } catch { /* ignore */ }
      }
      if (!cancelled) pollTimerRef.current = setTimeout(poll, ADMIN_POLL_INTERVAL);
    };

    pollTimerRef.current = setTimeout(poll, ADMIN_POLL_INTERVAL);
    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [open]); // reads sessionIdRef dynamically so a newly-created session is included

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput('');
    setError(null);

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);

    // Build messages array for API (exclude pending/admin UI markers)
    const apiMessages = [...messages, userMsg]
      .filter(m => !m.pending && (m.role === 'user' || m.role === 'assistant'))
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/data/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          messages:  apiMessages,
          lang,
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error('request failed');

      const contentType = res.headers.get('content-type') ?? '';

      // ── Admin mode: JSON response ────────────────────────────────────────
      if (contentType.includes('application/json')) {
        const data = await res.json() as { mode?: string; sessionId?: string };
        if (data.sessionId) {
          sessionIdRef.current = data.sessionId;
          sessionStorage.setItem(SESSION_KEY, data.sessionId);
        }
        if (data.mode === 'admin') {
          setAdminMode(true);
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: '…',
            pending: true,
          }]);
        }
        setStreaming(false);
        return;
      }

      // ── AI streaming mode ────────────────────────────────────────────────
      if (!res.body) throw new Error('no body');
      setAdminMode(false);
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const payload = JSON.parse(line.slice(6)) as {
              type?: string; sessionId?: string; content?: string; done?: boolean;
            };

            if (payload.type === 'session' && payload.sessionId) {
              sessionIdRef.current = payload.sessionId;
              sessionStorage.setItem(SESSION_KEY, payload.sessionId);
            } else if (payload.done) {
              break;
            } else if (payload.content) {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + payload.content,
                };
                return updated;
              });
            }
          } catch {
            // ignore
          }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'AbortError') return;
      setError(cb.error);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        return last?.role === 'assistant' && (last.content === '' || last.pending)
          ? prev.slice(0, -1)
          : prev;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, messages, streaming, lang, cb.error]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const closeChat = useCallback(() => {
    setOpen(false);
    // Once the panel is gone, return keyboard users to the same launcher that
    // will reopen it rather than leaving focus on removed dialog content.
    window.setTimeout(() => launcherRef.current?.focus(), 0);
  }, []);

  const trapDialogFocus = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeChat();
      return;
    }
    if (e.key !== 'Tab') return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const isRtl = lang === 'ar';

  // Remove pending bubble when real admin message arrives
  useEffect(() => {
    const hasPending = messages.some(m => m.pending);
    const hasRealAdminMsg = messages.some(m => m.role === 'admin' && !m.pending);
    if (hasPending && hasRealAdminMsg) {
      setMessages(prev => prev.filter(m => !m.pending));
    }
  }, [messages]);

  const bubbleStyle = (role: Message['role'], pending?: boolean): React.CSSProperties => ({
    maxWidth: '88%',
    padding: '0.65rem 0.875rem',
    borderRadius: role === 'user'
      ? '0.75rem 0.75rem 0.1rem 0.75rem'
      : '0.75rem 0.75rem 0.75rem 0.1rem',
    background: role === 'user' ? '#C99A32' : role === 'admin' ? '#EEF3F9' : '#F0F4F8',
    color: role === 'user' ? '#fff' : '#263F55',
    fontSize: '0.875rem',
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    opacity: pending ? 0.6 : 1,
    fontStyle: pending ? 'italic' : 'normal',
  });

  return (
    <>
      {/* This backdrop is intentionally non-interactive: it prevents pointer
          and touch input from reaching the public page while the modal is open.
          10000 sits above CookieConsentBanner's documented z-index of 9999. */}
      {open && modal && !formVisible && (
        <div
          aria-hidden="true"
          role="presentation"
          style={{
            position: 'fixed',
            zIndex: 10000,
            inset: 0,
            background: 'rgba(16,42,67,0.28)',
            touchAction: 'none',
          }}
        />
      )}
      {/* Conversation state lives in React state, so the panel can be unmounted
          while the booking form is visible without leaving focusable controls
          inside an aria-hidden subtree. */}
      {open && !formVisible && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal={modal || undefined}
          aria-label={cb.title}
          aria-labelledby="ivt-chat-title"
          dir={isRtl ? 'rtl' : 'ltr'}
          onKeyDown={trapDialogFocus}
          style={{
            position: 'fixed',
            zIndex: modal ? 10001 : 51,
            bottom: 'calc(8.5rem + env(safe-area-inset-bottom, 0px))',
            right:  'calc(1.25rem + env(safe-area-inset-right, 0px))',
            width:  'min(340px, calc(100vw - 2rem))',
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
          <div style={{
            background: '#102A43',
            padding: '0.875rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                width: 28, height: 28, borderRadius: '50%',
                background: '#C99A32',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }} aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
                </svg>
              </span>
              <span id="ivt-chat-title" style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{cb.title}</span>
              {adminMode && (
                <span style={{
                  background: '#16A36A', color: '#fff',
                  fontSize: '0.65rem', fontWeight: 600,
                  padding: '0.1rem 0.4rem', borderRadius: '999px', letterSpacing: '0.02em',
                }}>LIVE</span>
              )}
            </div>
            <button onClick={closeChat} aria-label={cb.close} className="ivt-chat-control"
              style={{ background:'transparent', border:'none', cursor:'pointer',
                color:'rgba(255,255,255,0.7)', padding:'0.25rem', borderRadius:'0.25rem',
                lineHeight:1, fontSize:'1.2rem' }}>×</button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '1rem',
            display: 'flex', flexDirection: 'column', gap: '0.75rem',
          }}>
            {messages.length === 0 && (
              <div style={bubbleStyle('assistant')}>
                {cb.welcome}
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={msg.id ?? i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={bubbleStyle(msg.role, msg.pending)}>
                  {msg.pending
                    ? cb.typing
                    : (msg.content ? renderChatMessageContent(msg.content) : null) || (streaming && i === messages.length - 1
                        ? <span style={{ opacity: 0.6 }}>{cb.typing}</span>
                        : null)
                  }
                </div>
              </div>
            ))}

            {error && (
              <p style={{ fontSize:'0.8rem', color:'#c0392b', textAlign:'center' }}>{error}</p>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            borderTop: '1px solid #D9E2EC',
            padding: '0.625rem 0.75rem',
            display: 'flex', gap: '0.5rem',
            flexShrink: 0, background: '#FFFDF8',
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={cb.placeholder}
              aria-label={cb.placeholder}
              disabled={streaming}
              className="ivt-chat-control"
              dir={isRtl ? 'rtl' : 'ltr'}
              style={{
                flex: 1, border: '1px solid #D9E2EC', borderRadius: '0.5rem',
                padding: '0.5rem 0.75rem', fontSize: '0.875rem',
                outline: 'none', background: '#fff', color: '#102A43', minWidth: 0,
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
              aria-label={cb.send}
              className="ivt-chat-control"
              style={{
                background: '#C99A32', border: 'none', borderRadius: '0.5rem',
                width: 38, height: 38,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: !input.trim() || streaming ? 'not-allowed' : 'pointer',
                opacity: !input.trim() || streaming ? 0.5 : 1,
                flexShrink: 0, transition: 'opacity 0.15s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating button — also hidden while the booking form is on screen. */}
      <button
        ref={launcherRef}
        onClick={() => open ? closeChat() : setOpen(true)}
        aria-label={cb.aria}
        aria-expanded={open}
        aria-hidden={formVisible || undefined}
        tabIndex={formVisible ? -1 : undefined}
        className="ivt-chat-control ivt-float-button ivt-chat-float"
        style={{
          position: 'fixed',
          zIndex: open && modal ? 59 : 50,
          bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))',
          right:  'calc(1.25rem + env(safe-area-inset-right, 0px))',
          width: 52, height: 52, borderRadius: '50%',
          background: open ? '#102A43' : '#C99A32',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 18px rgba(201,154,50,0.45)',
          opacity: appeared && !formVisible ? 1 : 0,
          visibility: appeared && !formVisible ? 'visible' : 'hidden',
          pointerEvents: formVisible ? 'none' : 'auto',
          transform: appeared ? 'scale(1)' : 'scale(0)',
          transition: appeared
            ? 'opacity 0.35s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1), background 0.2s ease, visibility 0s'
            : 'opacity 0.2s ease, transform 0.2s ease, visibility 0s 0.2s',
        }}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
          </svg>
        )}
      </button>
    </>
  );
}
