'use client';

/**
 * Admin live-chat interface.
 *
 * Left panel  → session list (last 7 days, newest first, auto-refreshes every 5s)
 * Right panel → selected session messages + Turkish reply input
 *
 * Customer messages are displayed in Turkish (content_tr).
 * Admin types Turkish → backend translates → customer sees their language.
 * "Devral" button marks the session as admin-active so AI stops auto-responding.
 * "AI'ya Bırak" releases control back to the AI.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface Session {
  id: string;
  visitorLang: string;
  adminActiveUntil: string | null;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
  lastMessageTr: string | null;
  lastMessageRole: string | null;
}

interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'admin';
  content: string;
  contentTr: string | null;
  createdAt: string;
}

import { LOCALE_REGISTRY } from '@/lib/i18n/locale-registry';

/** Registry-derived: automatically includes any new locale added to locale-registry.ts */
const LANG_LABELS: Record<string, string> = Object.fromEntries(
  LOCALE_REGISTRY.map((l) => [l.code, `${l.flagEmoji} ${l.code.toUpperCase()}`])
);

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)  return 'şimdi';
  if (min < 60) return `${min}dk`;
  const h = Math.floor(min / 60);
  if (h  < 24)  return `${h}s`;
  return `${Math.floor(h / 24)}g`;
}

export default function SohbetClient() {
  const [sessions,         setSessions]        = useState<Session[]>([]);
  const [selectedId,       setSelectedId]      = useState<string | null>(null);
  const [messages,         setMessages]        = useState<Message[]>([]);
  const [selectedSession,  setSelectedSession] = useState<Session | null>(null);
  const [replyText,        setReplyText]       = useState('');
  const [sending,          setSending]         = useState(false);
  const [takingOver,       setTakingOver]      = useState(false);
  const [error,            setError]           = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Session list polling ─────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    const res = await fetch('/admin/api/chatbot/sessions').catch(() => null);
    if (res?.ok) {
      const data = await res.json() as { sessions: Session[] };
      setSessions(data.sessions);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const t = setInterval(fetchSessions, 5000);
    return () => clearInterval(t);
  }, [fetchSessions]);

  // ── Message polling for selected session ────────────────────────────────
  const fetchMessages = useCallback(async (sid: string) => {
    const res = await fetch(`/admin/api/chatbot/${sid}/messages`).catch(() => null);
    if (res?.ok) {
      const data = await res.json() as { session: Session; messages: Message[] };
      setMessages(data.messages);
      setSelectedSession(data.session);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetchMessages(selectedId);
    const t = setInterval(() => fetchMessages(selectedId), 3000);
    return () => clearInterval(t);
  }, [selectedId, fetchMessages]);

  // ── Admin active status ──────────────────────────────────────────────────
  const adminIsActive = selectedSession?.adminActiveUntil
    ? new Date() < new Date(selectedSession.adminActiveUntil)
    : false;

  // ── Send reply ───────────────────────────────────────────────────────────
  const sendReply = async () => {
    if (!replyText.trim() || !selectedId || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/admin/api/chatbot/${selectedId}/reply`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content: replyText.trim() }),
      });
      if (!res.ok) throw new Error('failed');
      setReplyText('');
      await fetchMessages(selectedId);
      await fetchSessions();
    } catch {
      setError('Gönderim başarısız. Tekrar deneyin.');
    } finally {
      setSending(false);
    }
  };

  // ── Takeover / release ───────────────────────────────────────────────────
  const takeover = async (release = false) => {
    if (!selectedId) return;
    setTakingOver(true);
    try {
      await fetch(
        `/admin/api/chatbot/${selectedId}/takeover${release ? '?release=true' : ''}`,
        { method: 'POST' },
      );
      await fetchMessages(selectedId);
    } finally {
      setTakingOver(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
  };

  // ── Styles ───────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: '#fff',
    borderRadius: '0.75rem',
    border: '1px solid #D9E2EC',
    overflow: 'hidden',
  };

  const msgBubble = (role: string): React.CSSProperties => ({
    maxWidth: '80%',
    padding: '0.6rem 0.85rem',
    borderRadius: role === 'user' ? '0.75rem 0.75rem 0.1rem 0.75rem' : '0.75rem 0.75rem 0.75rem 0.1rem',
    background: role === 'user' ? '#EEF3F9' : role === 'admin' ? '#C99A32' : '#F0F7F4',
    color: role === 'admin' ? '#fff' : '#263F55',
    fontSize: '0.875rem',
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1rem', marginTop: '1.5rem', height: 'calc(100vh - 200px)', minHeight: 400 }}>

      {/* ── Session list ──────────────────────────────────────────────── */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid #EEF3F9', fontWeight: 600, fontSize: '0.875rem', color: '#102A43', flexShrink: 0 }}>
          Aktif Oturumlar ({sessions.length})
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sessions.length === 0 && (
            <p style={{ padding: '1.5rem 1rem', color: '#50677A', fontSize: '0.8rem', textAlign: 'center' }}>
              Henüz sohbet yok
            </p>
          )}
          {sessions.map(s => {
            const active = s.adminActiveUntil ? new Date() < new Date(s.adminActiveUntil) : false;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                style={{
                  width: '100%', textAlign: 'left', padding: '0.75rem 1rem',
                  borderBottom: '1px solid #F3F6FA',
                  background: selectedId === s.id ? '#EEF3F9' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: '0.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#102A43' }}>
                    {LANG_LABELS[s.visitorLang] ?? s.visitorLang}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#50677A' }}>{timeAgo(s.lastMessageAt)}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#50677A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                  {s.lastMessageTr ?? '—'}
                </p>
                {active && (
                  <span style={{ fontSize: '0.65rem', background: '#C99A32', color: '#fff', padding: '0.1rem 0.4rem', borderRadius: '999px', alignSelf: 'flex-start' }}>
                    Siz yanıtlıyorsunuz
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Chat thread ───────────────────────────────────────────────── */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedId ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#50677A', fontSize: '0.9rem' }}>
            Soldaki listeden bir oturum seçin
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #EEF3F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#102A43' }}>
                  {LANG_LABELS[selectedSession?.visitorLang ?? ''] ?? selectedSession?.visitorLang}
                </span>
                {adminIsActive ? (
                  <span style={{ fontSize: '0.7rem', background: '#16A36A', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                    Siz aktifsiniz
                  </span>
                ) : (
                  <span style={{ fontSize: '0.7rem', background: '#EEF3F9', color: '#50677A', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                    AI yanıtlıyor
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {!adminIsActive ? (
                  <button
                    onClick={() => takeover(false)}
                    disabled={takingOver}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', borderRadius: '0.5rem', background: '#C99A32', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Devral
                  </button>
                ) : (
                  <button
                    onClick={() => takeover(true)}
                    disabled={takingOver}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', borderRadius: '0.5rem', background: '#EEF3F9', color: '#102A43', border: '1px solid #D9E2EC', cursor: 'pointer' }}
                  >
                    AI&apos;ya Bırak
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {messages.map(msg => (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'admin' ? 'flex-end' : 'flex-start', gap: '0.2rem' }}>
                  <span style={{ fontSize: '0.65rem', color: '#50677A', paddingInline: '0.25rem' }}>
                    {msg.role === 'user' ? '🙋 Ziyaretçi' : msg.role === 'admin' ? '👤 Siz' : '🤖 AI'}
                    {' · '}
                    {new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div style={msgBubble(msg.role)}>
                    {/* Show Turkish translation for user messages, original for others */}
                    {msg.role === 'user'
                      ? (msg.contentTr ?? msg.content)
                      : msg.role === 'admin'
                        ? (msg.contentTr ?? msg.content) // admin's original Turkish
                        : msg.content
                    }
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <p style={{ color: '#50677A', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>Bu oturumda henüz mesaj yok</p>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Reply input */}
            <div style={{ borderTop: '1px solid #D9E2EC', padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexShrink: 0 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Türkçe yazın — müşteriye otomatik çevrilir (Enter ile gönder)"
                  rows={2}
                  style={{
                    width: '100%', border: '1px solid #D9E2EC', borderRadius: '0.5rem',
                    padding: '0.5rem 0.75rem', fontSize: '0.875rem', resize: 'none',
                    outline: 'none', color: '#102A43', background: '#fff', boxSizing: 'border-box',
                  }}
                />
                {error && <span style={{ fontSize: '0.75rem', color: '#c0392b' }}>{error}</span>}
              </div>
              <button
                onClick={sendReply}
                disabled={!replyText.trim() || sending}
                style={{
                  background: '#C99A32', border: 'none', borderRadius: '0.5rem',
                  padding: '0.6rem 1rem', color: '#fff', fontWeight: 600, fontSize: '0.85rem',
                  cursor: !replyText.trim() || sending ? 'not-allowed' : 'pointer',
                  opacity: !replyText.trim() || sending ? 0.5 : 1, flexShrink: 0,
                  alignSelf: 'flex-end',
                }}
              >
                {sending ? '…' : 'Gönder'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
