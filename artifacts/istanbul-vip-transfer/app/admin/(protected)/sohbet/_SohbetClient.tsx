'use client';

/**
 * Admin live-chat interface — enhanced with:
 *  - Audio + visual notifications for incoming visitor messages
 *  - humanTakenOver status labels ("AI Yönetiminde" / "Admin Yönetiminde")
 *  - Original message text shown alongside Turkish translation
 *  - Unread message counter in the session list
 *  - Archive / close sessions (Kapat → Arşiv, Yeniden Aç)
 *  - Mobile-responsive: single-panel stack with back button
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface Session {
  id:               string;
  visitorLang:      string;
  adminActiveUntil: string | null;
  humanTakenOver:   boolean;
  pendingAiAfter:   string | null;
  resolvedAt:       string | null;
  createdAt:        string;
  lastMessageAt:    string;
  messageCount:     number;
  lastMessageTr:    string | null;
  lastMessageRole:  string | null;
}

interface Message {
  id:        string;
  sessionId: string;
  role:      'user' | 'assistant' | 'admin';
  content:   string;
  contentTr: string | null;
  createdAt: string;
}

import { LOCALE_REGISTRY } from '@/lib/i18n/locale-registry';

const LANG_LABELS: Record<string, string> = Object.fromEntries(
  LOCALE_REGISTRY.map(l => [l.code, `${l.flagEmoji} ${l.code.toUpperCase()}`])
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

// ── Audio notification ─────────────────────────────────────────────────────────
function playNotificationBeep() {
  try {
    const ctx  = new AudioContext();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
  } catch { /* browser may block AudioContext — ignore */ }
}

export default function SohbetClient() {
  const [sessions,        setSessions]        = useState<Session[]>([]);
  const [selectedId,      setSelectedId]      = useState<string | null>(null);
  const [messages,        setMessages]        = useState<Message[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [replyText,       setReplyText]       = useState('');
  const [sending,         setSending]         = useState(false);
  const [takingOver,      setTakingOver]      = useState(false);
  const [resolving,       setResolving]       = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [toast,           setToast]           = useState<string | null>(null);
  const [unreadIds,       setUnreadIds]       = useState<Set<string>>(new Set());
  const [showArchived,    setShowArchived]    = useState(false);

  // Mobile layout: 'list' shows session list, 'thread' shows message thread
  const [isMobile,    setIsMobile]    = useState(false);
  const [mobileView,  setMobileView]  = useState<'list' | 'thread'>('list');

  const bottomRef  = useRef<HTMLDivElement>(null);
  const knownKeys  = useRef<Set<string>>(new Set());
  const origTitle  = useRef('');
  const blinkTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Mobile detection ────────────────────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ── Title blink ─────────────────────────────────────────────────────────────
  const startBlink = useCallback(() => {
    if (blinkTimer.current) return;
    origTitle.current = document.title;
    let tog = false;
    blinkTimer.current = setInterval(() => {
      document.title = tog ? '💬 Yeni mesaj!' : origTitle.current;
      tog = !tog;
    }, 700);
  }, []);

  const stopBlink = useCallback(() => {
    if (blinkTimer.current) { clearInterval(blinkTimer.current); blinkTimer.current = null; }
    if (origTitle.current) document.title = origTitle.current;
  }, []);

  // ── Toast helper ─────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Session list polling ──────────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    const url = `/admin/api/chatbot/sessions${showArchived ? '?archived=true' : ''}`;
    const res = await fetch(url).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json() as { sessions: Session[] };
    const newSessions = data.sessions;

    // Detect new user messages via fingerprint = id:lastMessageAt (active only)
    if (!showArchived) {
      for (const s of newSessions) {
        if (s.lastMessageRole === 'user' && s.lastMessageTr) {
          const key = `${s.id}:${s.lastMessageAt}`;
          if (!knownKeys.current.has(key)) {
            knownKeys.current.add(key);
            const isCurrentlyViewing = selectedId === s.id;
            if (!isCurrentlyViewing) {
              setUnreadIds(prev => new Set([...prev, s.id]));
              playNotificationBeep();
              startBlink();
              showToast(`💬 ${LANG_LABELS[s.visitorLang] ?? s.visitorLang}: ${(s.lastMessageTr ?? '').slice(0, 60)}`);
            }
          }
        }
      }
    }

    setSessions(newSessions);
  }, [selectedId, startBlink, showToast, showArchived]);

  useEffect(() => {
    setSessions([]);
    setSelectedId(null);
    setMessages([]);
    setSelectedSession(null);
    if (isMobile) setMobileView('list');
  }, [showArchived, isMobile]);

  useEffect(() => {
    fetchSessions();
    const t = setInterval(fetchSessions, 5000);
    return () => clearInterval(t);
  }, [fetchSessions]);

  // ── Message polling ──────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async (sid: string) => {
    const res = await fetch(`/admin/api/chatbot/${sid}/messages`).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json() as { session: Session; messages: Message[] };
    setMessages(data.messages);
    setSelectedSession(data.session);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetchMessages(selectedId);
    const t = setInterval(() => fetchMessages(selectedId), 3000);
    return () => clearInterval(t);
  }, [selectedId, fetchMessages]);

  // ── Select session ───────────────────────────────────────────────────────────
  const selectSession = (sid: string) => {
    setSelectedId(sid);
    setMessages([]);
    setUnreadIds(prev => { const next = new Set(prev); next.delete(sid); return next; });
    stopBlink();
    if (isMobile) setMobileView('thread');
  };

  // ── Admin active status ──────────────────────────────────────────────────────
  const adminIsActive = selectedSession?.adminActiveUntil
    ? new Date() < new Date(selectedSession.adminActiveUntil)
    : false;

  // ── Send reply ───────────────────────────────────────────────────────────────
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

  // ── Takeover / release ───────────────────────────────────────────────────────
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

  // ── Archive / restore ────────────────────────────────────────────────────────
  const resolveSession = async (sid: string, unresolve = false) => {
    setResolving(true);
    try {
      const url = `/admin/api/chatbot/${sid}/resolve${unresolve ? '?unresolve=true' : ''}`;
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) throw new Error('failed');
      // Remove from current list, clear selection if needed
      setSessions(prev => prev.filter(s => s.id !== sid));
      if (selectedId === sid) {
        setSelectedId(null);
        setMessages([]);
        setSelectedSession(null);
        if (isMobile) setMobileView('list');
      }
      showToast(unresolve ? '✅ Sohbet yeniden aktif listeye taşındı' : '📁 Sohbet arşivlendi');
    } catch {
      showToast('İşlem başarısız, tekrar deneyin.');
    } finally {
      setResolving(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
  };

  // ── Styles ───────────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: '#fff', borderRadius: '0.75rem', border: '1px solid #D9E2EC', overflow: 'hidden',
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

  // ── Status badge for session list ─────────────────────────────────────────────
  const SessionStatusBadge = ({ s }: { s: Session }) => {
    if (s.resolvedAt) {
      return (
        <span style={{ fontSize: '0.62rem', background: '#F0F4F8', color: '#50677A', padding: '0.1rem 0.35rem', borderRadius: '999px' }}>
          📁 Arşiv
        </span>
      );
    }
    const adminActive = s.adminActiveUntil ? new Date() < new Date(s.adminActiveUntil) : false;
    if (s.humanTakenOver || adminActive) {
      return (
        <span style={{ fontSize: '0.62rem', background: '#C99A32', color: '#fff', padding: '0.1rem 0.35rem', borderRadius: '999px' }}>
          👤 Admin
        </span>
      );
    }
    return (
      <span style={{ fontSize: '0.62rem', background: '#EEF3F9', color: '#50677A', padding: '0.1rem 0.35rem', borderRadius: '999px' }}>
        🤖 AI
      </span>
    );
  };

  // ── Layout ────────────────────────────────────────────────────────────────────
  const isArchived = !!selectedSession?.resolvedAt;

  // List panel visibility
  const listVisible = !isMobile || mobileView === 'list';
  // Thread panel visibility
  const threadVisible = !isMobile || mobileView === 'thread';

  return (
    <div style={{ position: 'relative' }}>

      {/* ── Toast notification ───────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: isMobile ? '4rem' : '1.25rem',
          right: '1rem',
          zIndex: 9000,
          background: '#102A43', color: '#fff', borderRadius: '0.75rem',
          padding: '0.75rem 1rem', fontSize: '0.82rem',
          maxWidth: isMobile ? 'calc(100vw - 2rem)' : 320,
          boxShadow: '0 4px 20px rgba(16,42,67,0.3)',
          animation: 'slideIn 0.25s ease',
        }}>
          {toast}
        </div>
      )}

      {/* ── Layout wrapper ───────────────────────────────────────────────── */}
      <div style={{
        display: isMobile ? 'block' : 'grid',
        gridTemplateColumns: isMobile ? undefined : '280px 1fr',
        gap: isMobile ? undefined : '1rem',
        marginTop: '1.5rem',
        height: isMobile ? undefined : 'calc(100vh - 200px)',
        minHeight: isMobile ? undefined : 400,
      }}>

        {/* ── Session list ─────────────────────────────────────────────── */}
        {listVisible && (
          <div style={{
            ...card,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            height: isMobile ? 'calc(100vh - 160px)' : '100%',
            marginBottom: isMobile ? 0 : undefined,
          }}>
            {/* List header */}
            <div style={{
              padding: '0.875rem 1rem',
              borderBottom: '1px solid #EEF3F9',
              flexShrink: 0,
            }}>
              {/* Title row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#102A43' }}>
                  {showArchived ? `📁 Arşiv (${sessions.length})` : `Aktif Oturumlar (${sessions.length})`}
                </span>
                {!showArchived && unreadIds.size > 0 && (
                  <span style={{ background: '#E53E3E', color: '#fff', borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.72rem', fontWeight: 700 }}>
                    {unreadIds.size} yeni
                  </span>
                )}
              </div>
              {/* Archive toggle */}
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                <button
                  onClick={() => setShowArchived(false)}
                  style={{
                    flex: 1, padding: '0.3rem 0', fontSize: '0.75rem', borderRadius: '0.4rem',
                    border: '1px solid',
                    borderColor: !showArchived ? '#C99A32' : '#D9E2EC',
                    background: !showArchived ? '#C99A32' : '#fff',
                    color: !showArchived ? '#fff' : '#50677A',
                    cursor: 'pointer', fontWeight: !showArchived ? 600 : 400,
                  }}
                >
                  Aktif
                </button>
                <button
                  onClick={() => setShowArchived(true)}
                  style={{
                    flex: 1, padding: '0.3rem 0', fontSize: '0.75rem', borderRadius: '0.4rem',
                    border: '1px solid',
                    borderColor: showArchived ? '#C99A32' : '#D9E2EC',
                    background: showArchived ? '#C99A32' : '#fff',
                    color: showArchived ? '#fff' : '#50677A',
                    cursor: 'pointer', fontWeight: showArchived ? 600 : 400,
                  }}
                >
                  Arşiv
                </button>
              </div>
            </div>

            {/* Session rows */}
            <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
              {sessions.length === 0 && (
                <p style={{ padding: '1.5rem 1rem', color: '#50677A', fontSize: '0.8rem', textAlign: 'center' }}>
                  {showArchived ? 'Arşivde sohbet yok' : 'Henüz aktif sohbet yok'}
                </p>
              )}
              {sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => selectSession(s.id)}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: isMobile ? '0.9rem 1rem' : '0.75rem 1rem',
                    borderBottom: '1px solid #F3F6FA',
                    background: selectedId === s.id ? '#EEF3F9' : 'transparent',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: '0.25rem',
                    position: 'relative',
                    minHeight: isMobile ? 64 : undefined,
                  }}
                >
                  {/* Unread dot */}
                  {unreadIds.has(s.id) && (
                    <span style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', width: 8, height: 8, borderRadius: '50%', background: '#E53E3E' }} />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ fontSize: isMobile ? '0.8rem' : '0.75rem', fontWeight: 600, color: '#102A43' }}>
                      {LANG_LABELS[s.visitorLang] ?? s.visitorLang}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#50677A', flexShrink: 0 }}>{timeAgo(s.lastMessageAt)}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#50677A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.lastMessageTr ?? '—'}
                  </p>
                  <SessionStatusBadge s={s} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Chat thread ──────────────────────────────────────────────── */}
        {threadVisible && (
          <div style={{
            ...card,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            height: isMobile ? 'calc(100vh - 160px)' : '100%',
            marginTop: isMobile ? '0.75rem' : 0,
          }}>
            {!selectedId ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#50677A', fontSize: '0.9rem', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>💬</span>
                <span>Soldaki listeden bir oturum seçin</span>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #EEF3F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                    {/* Back button on mobile */}
                    {isMobile && (
                      <button
                        onClick={() => { setMobileView('list'); }}
                        style={{ background: '#EEF3F9', border: 'none', borderRadius: '0.4rem', padding: '0.35rem 0.6rem', cursor: 'pointer', color: '#102A43', fontSize: '0.8rem', flexShrink: 0 }}
                        aria-label="Geri"
                      >
                        ← Geri
                      </button>
                    )}
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#102A43', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {LANG_LABELS[selectedSession?.visitorLang ?? ''] ?? selectedSession?.visitorLang}
                    </span>
                    {/* Status badges */}
                    {isArchived ? (
                      <span style={{ fontSize: '0.7rem', background: '#F0F4F8', color: '#50677A', padding: '0.15rem 0.5rem', borderRadius: '999px', flexShrink: 0 }}>
                        📁 Arşivlendi
                      </span>
                    ) : selectedSession?.humanTakenOver ? (
                      <span style={{ fontSize: '0.7rem', background: '#C99A32', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '999px', flexShrink: 0 }}>
                        👤 Admin Yönetiminde
                      </span>
                    ) : adminIsActive ? (
                      <span style={{ fontSize: '0.7rem', background: '#16A36A', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '999px', flexShrink: 0 }}>
                        ✅ Siz Aktifsiniz
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.7rem', background: '#EEF3F9', color: '#50677A', padding: '0.15rem 0.5rem', borderRadius: '999px', flexShrink: 0 }}>
                        🤖 AI Yönetiminde
                      </span>
                    )}
                    {!isArchived && selectedSession?.pendingAiAfter && new Date() < new Date(selectedSession.pendingAiAfter) && (
                      <span style={{ fontSize: '0.65rem', background: '#FFF3CD', color: '#856404', padding: '0.1rem 0.4rem', borderRadius: '999px', flexShrink: 0 }}>
                        ⏳ 2dk pencere
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    {isArchived ? (
                      /* Archived session: only Restore */
                      <button
                        onClick={() => resolveSession(selectedId, true)}
                        disabled={resolving}
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem', borderRadius: '0.5rem', background: '#16A36A', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                      >
                        {resolving ? '…' : '↩ Yeniden Aç'}
                      </button>
                    ) : (
                      /* Active session: takeover / release + close */
                      <>
                        {(selectedSession?.humanTakenOver || adminIsActive) ? (
                          <button
                            onClick={() => takeover(true)}
                            disabled={takingOver}
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem', borderRadius: '0.5rem', background: '#EEF3F9', color: '#102A43', border: '1px solid #D9E2EC', cursor: 'pointer' }}
                          >
                            AI&apos;ya Bırak
                          </button>
                        ) : (
                          <button
                            onClick={() => takeover(false)}
                            disabled={takingOver}
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem', borderRadius: '0.5rem', background: '#C99A32', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                          >
                            Devral
                          </button>
                        )}
                        <button
                          onClick={() => resolveSession(selectedId, false)}
                          disabled={resolving}
                          title="Sohbeti arşivle"
                          style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem', borderRadius: '0.5rem', background: '#F3F6FA', color: '#50677A', border: '1px solid #D9E2EC', cursor: 'pointer' }}
                        >
                          {resolving ? '…' : '📁 Kapat'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                  {messages.map(msg => (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'admin' ? 'flex-end' : 'flex-start', gap: '0.2rem' }}>
                      <span style={{ fontSize: '0.65rem', color: '#50677A', paddingInline: '0.25rem' }}>
                        {msg.role === 'user' ? '🙋 Ziyaretçi' : msg.role === 'admin' ? '👤 Siz' : '🤖 AI'}
                        {' · '}
                        {new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div style={msgBubble(msg.role)}>
                        {msg.role === 'user' ? (
                          /* Show Turkish translation prominently; original below if different */
                          <>
                            <span>{msg.contentTr ?? msg.content}</span>
                            {msg.contentTr && msg.contentTr !== msg.content && (
                              <div style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid rgba(16,42,67,0.1)', fontSize: '0.75rem', color: '#50677A', fontStyle: 'italic' }}>
                                Orijinal: {msg.content}
                              </div>
                            )}
                          </>
                        ) : msg.role === 'admin' ? (
                          /* Show what admin typed (Turkish); visitor translation below */
                          <>
                            <span>{msg.contentTr ?? msg.content}</span>
                            {msg.contentTr && msg.contentTr !== msg.content && (
                              <div style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid rgba(255,255,255,0.25)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', fontStyle: 'italic' }}>
                                Çeviri: {msg.content}
                              </div>
                            )}
                          </>
                        ) : (
                          /* AI: show Turkish translation; original below if different */
                          <>
                            <span>{msg.contentTr ?? msg.content}</span>
                            {msg.contentTr && msg.contentTr !== msg.content && (
                              <div style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid rgba(16,42,67,0.1)', fontSize: '0.75rem', color: '#50677A', fontStyle: 'italic' }}>
                                Orijinal: {msg.content}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <p style={{ color: '#50677A', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>Bu oturumda henüz mesaj yok</p>
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Reply input — hidden for archived sessions */}
                {!isArchived && (
                  <div style={{ borderTop: '1px solid #D9E2EC', padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexShrink: 0 }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        onKeyDown={handleKey}
                        placeholder={isMobile ? 'Türkçe yazın — çevrilir' : 'Türkçe yazın — müşteriye otomatik çevrilir (Enter ile gönder)'}
                        rows={2}
                        style={{ width: '100%', border: '1px solid #D9E2EC', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: isMobile ? '1rem' : '0.875rem', resize: 'none', outline: 'none', color: '#102A43', background: '#fff', boxSizing: 'border-box' }}
                      />
                      {error && <span style={{ fontSize: '0.75rem', color: '#c0392b' }}>{error}</span>}
                    </div>
                    <button
                      onClick={sendReply}
                      disabled={!replyText.trim() || sending}
                      style={{
                        background: '#C99A32', border: 'none', borderRadius: '0.5rem',
                        padding: isMobile ? '0.75rem 1.1rem' : '0.6rem 1rem',
                        color: '#fff', fontWeight: 600, fontSize: '0.85rem',
                        cursor: !replyText.trim() || sending ? 'not-allowed' : 'pointer',
                        opacity: !replyText.trim() || sending ? 0.5 : 1,
                        flexShrink: 0, alignSelf: 'flex-end',
                        minWidth: isMobile ? 56 : undefined,
                        minHeight: isMobile ? 44 : undefined,
                      }}
                    >
                      {sending ? '…' : 'Gönder'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
