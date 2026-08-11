'use client';

/**
 * AdminChatOverlay — floating admin live-chat panel embedded in the public site.
 *
 * TRIGGER  : Ctrl+Shift+A (keyboard) — invisible to regular visitors.
 * AUTH     : compact login form → POST /admin/api/login (same session cookie).
 * AUTO-ACT : opening a session auto-calls /takeover so AI is paused immediately.
 * NOTIFY   : Web Audio API beep + page-title blink when a new visitor message
 *            arrives while the panel is closed or a different session is selected.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Session {
  id: string;
  visitorLang: string;
  adminActiveUntil: string | null;
  lastMessageAt: string;
  messageCount: number;
  lastMessageTr: string | null;
  lastMessageRole: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'admin';
  content: string;
  contentTr: string | null;
  createdAt: string;
}

type AuthState = 'unknown' | 'in' | 'out';

const LANG_FLAGS: Record<string, string> = {
  tr: '🇹🇷', en: '🇬🇧', de: '🇩🇪', ru: '🇷🇺', ar: '🇸🇦',
};

function ago(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return 'şimdi';
  if (d < 3600) return `${Math.floor(d / 60)}dk`;
  if (d < 86400) return `${Math.floor(d / 3600)}s`;
  return `${Math.floor(d / 86400)}g`;
}

// ── Sound ────────────────────────────────────────────────────────────────────

function playNotificationBeep() {
  try {
    const ctx = new AudioContext();
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
  } catch { /* silently ignore if browser blocks AudioContext */ }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminChatOverlay() {
  const [open,     setOpen]    = useState(false);
  const [auth,     setAuth]    = useState<AuthState>('unknown');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selId,    setSelId]   = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selSess,  setSelSess] = useState<Session | null>(null);
  const [reply,    setReply]   = useState('');
  const [sending,  setSending] = useState(false);
  const [loginErr, setLoginErr] = useState('');
  const [email,    setEmail]   = useState('');
  const [password, setPassword] = useState('');
  const [logging,  setLogging] = useState(false);

  // Unread notification state
  const [unread,    setUnread]   = useState(false);
  const knownMsgIds = useRef<Set<string>>(new Set());
  const blinkTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const origTitle   = useRef('');
  const bottomRef   = useRef<HTMLDivElement>(null);

  // ── Title blink ────────────────────────────────────────────────────────────
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
    if (blinkTimer.current) {
      clearInterval(blinkTimer.current);
      blinkTimer.current = null;
    }
    if (origTitle.current) document.title = origTitle.current;
  }, []);

  // Stop blink when panel opened or session selected
  useEffect(() => {
    if (open) { setUnread(false); stopBlink(); }
  }, [open, stopBlink]);

  // ── Keyboard trigger: Ctrl+Shift+A ────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Auth check ─────────────────────────────────────────────────────────────
  const checkAuth = useCallback(async () => {
    const res = await fetch('/admin/api/chatbot/sessions').catch(() => null);
    if (!res) { setAuth('out'); return; }
    if (res.status === 401) { setAuth('out'); return; }
    if (res.ok) {
      setAuth('in');
      const data = await res.json() as { sessions: Session[] };
      setSessions(data.sessions);
      return;
    }
    // Any other error (500 etc.) → treat as not logged in so UI doesn't hang
    setAuth('out');
  }, []);

  useEffect(() => {
    if (open && auth === 'unknown') checkAuth();
  }, [open, auth, checkAuth]);

  // ── Session list polling (5s) ─────────────────────────────────────────────
  useEffect(() => {
    if (!open || auth !== 'in') return;
    const t = setInterval(async () => {
      const res = await fetch('/admin/api/chatbot/sessions').catch(() => null);
      if (res?.ok) {
        const data = await res.json() as { sessions: Session[] };
        setSessions(data.sessions);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [open, auth]);

  // ── Background session check for notifications (even when panel closed) ───
  useEffect(() => {
    if (auth !== 'in') return;
    const t = setInterval(async () => {
      const res = await fetch('/admin/api/chatbot/sessions').catch(() => null);
      if (!res?.ok) return;
      const data = await res.json() as { sessions: Session[] };

      // For each session, check for new user messages we haven't seen
      for (const s of data.sessions) {
        if (s.lastMessageRole === 'user' && s.lastMessageTr) {
          // Build a cheap fingerprint
          const key = `${s.id}:${s.lastMessageAt}`;
          if (!knownMsgIds.current.has(key)) {
            knownMsgIds.current.add(key);
            // Only notify if this isn't the currently open session
            const isCurrentlyViewing = open && selId === s.id;
            if (!isCurrentlyViewing) {
              setUnread(true);
              playNotificationBeep();
              startBlink();
            }
          }
        }
      }
    }, 4000);
    return () => clearInterval(t);
  }, [auth, open, selId, startBlink]);

  // ── Message polling for selected session ─────────────────────────────────
  const fetchMessages = useCallback(async (sid: string) => {
    const res = await fetch(`/admin/api/chatbot/${sid}/messages`).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json() as { session: Session; messages: Message[] };
    setMessages(data.messages);
    setSelSess(data.session);
    // Mark all current messages as known
    data.messages.forEach(m => knownMsgIds.current.add(m.id));
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  useEffect(() => {
    if (!selId) return;
    fetchMessages(selId);
    const t = setInterval(() => fetchMessages(selId), 3000);
    return () => clearInterval(t);
  }, [selId, fetchMessages]);

  // ── Select session → auto-takeover ───────────────────────────────────────
  const selectSession = useCallback(async (sid: string) => {
    setSelId(sid);
    setMessages([]);
    stopBlink();
    setUnread(false);
    // Auto-activate admin
    await fetch(`/admin/api/chatbot/${sid}/takeover`, { method: 'POST' }).catch(() => null);
  }, [stopBlink]);

  // ── Login ─────────────────────────────────────────────────────────────────
  const doLogin = async () => {
    setLogging(true);
    setLoginErr('');
    const res = await fetch('/admin/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).catch(() => null);
    setLogging(false);
    if (!res) { setLoginErr('Bağlantı hatası.'); return; }
    if (res.ok) { setAuth('in'); checkAuth(); return; }
    const j = await res.json().catch(() => ({})) as { error?: string };
    setLoginErr(j.error ?? 'Giriş başarısız.');
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const doLogout = async () => {
    await fetch('/admin/api/logout', { method: 'POST' }).catch(() => null);
    setAuth('out'); setSessions([]); setSelId(null); setMessages([]);
  };

  // ── Send reply ────────────────────────────────────────────────────────────
  const sendReply = async () => {
    if (!reply.trim() || !selId || sending) return;
    setSending(true);
    await fetch(`/admin/api/chatbot/${selId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: reply.trim() }),
    }).catch(() => null);
    setReply('');
    setSending(false);
    await fetchMessages(selId);
  };

  const adminIsActive = selSess?.adminActiveUntil
    ? new Date() < new Date(selSess.adminActiveUntil)
    : false;

  // ── Styles ────────────────────────────────────────────────────────────────
  const panel: React.CSSProperties = {
    position: 'fixed', zIndex: 9999,
    bottom: '1.25rem',
    right: '1.25rem',
    width: 'min(780px, calc(100vw - 2rem))',
    height: 'min(560px, calc(100dvh - 6rem))',
    background: '#F3F6FA',
    borderRadius: '1rem',
    boxShadow: '0 12px 48px rgba(16,42,67,0.22)',
    border: '1px solid #D9E2EC',
    display: open ? 'flex' : 'none',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const triggerBtn: React.CSSProperties = {
    position: 'fixed', zIndex: 9998,
    bottom: 'calc(1.5rem + env(safe-area-inset-bottom,0px))',
    right: 'calc(5.25rem + env(safe-area-inset-right,0px))',
    width: 44, height: 44,
    borderRadius: '50%',
    background: open ? '#102A43' : unread ? '#E53E3E' : '#263F55',
    border: '2px solid rgba(255,255,255,0.15)',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
    transition: 'background 0.2s',
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={triggerBtn}
        title="Admin Paneli (Ctrl+Shift+A)"
        aria-label="Admin chat paneli"
      >
        {unread && !open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
            <circle cx="18" cy="6" r="5" fill="#E53E3E"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
          </svg>
        )}
      </button>

      {/* Panel */}
      <div style={panel} role="dialog" aria-label="Admin Chat Paneli">

        {/* Header */}
        <div style={{
          background: '#102A43', color: '#fff',
          padding: '0.75rem 1rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>🛡 Admin — Canlı Sohbet</span>
            {auth === 'in' && (
              <span style={{ fontSize: '0.7rem', background: '#16A36A', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>
                Aktif
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {auth === 'in' && (
              <button onClick={doLogout}
                style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Çıkış
              </button>
            )}
            <button onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1 }}>
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        {auth === 'unknown' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#50677A' }}>
            Kontrol ediliyor…
          </div>
        )}

        {/* Login form */}
        {auth === 'out' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ fontWeight: 600, color: '#102A43', margin: 0, textAlign: 'center' }}>Admin Girişi</p>
              <input
                type="email" placeholder="E-posta" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doLogin()}
                style={inputStyle}
              />
              <input
                type="password" placeholder="Şifre" value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doLogin()}
                style={inputStyle}
              />
              {loginErr && <p style={{ color: '#c0392b', fontSize: '0.8rem', margin: 0 }}>{loginErr}</p>}
              <button
                onClick={doLogin} disabled={logging || !email || !password}
                style={{
                  background: '#C99A32', color: '#fff', border: 'none',
                  borderRadius: '0.5rem', padding: '0.65rem',
                  fontWeight: 700, cursor: 'pointer',
                  opacity: logging ? 0.6 : 1,
                }}>
                {logging ? 'Giriş yapılıyor…' : 'Giriş Yap'}
              </button>
            </div>
          </div>
        )}

        {/* Sessions + chat */}
        {auth === 'in' && (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr', overflow: 'hidden' }}>

            {/* Session list */}
            <div style={{ borderRight: '1px solid #D9E2EC', overflowY: 'auto', background: '#fff' }}>
              <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.72rem', color: '#50677A', fontWeight: 600, borderBottom: '1px solid #EEF3F9' }}>
                OTURUMLAR ({sessions.length})
              </div>
              {sessions.length === 0 && (
                <p style={{ padding: '1rem', color: '#50677A', fontSize: '0.8rem', textAlign: 'center' }}>Henüz sohbet yok</p>
              )}
              {sessions.map(s => (
                <button key={s.id} onClick={() => selectSession(s.id)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem',
                    borderBottom: '1px solid #F3F6FA', border: 'none',
                    background: selId === s.id ? '#EEF3F9' : 'transparent',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.2rem',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {LANG_FLAGS[s.visitorLang] ?? '🌐'} {s.visitorLang.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#50677A' }}>{ago(s.lastMessageAt)}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#50677A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                    {s.lastMessageTr ?? '—'}
                  </p>
                </button>
              ))}
            </div>

            {/* Chat area */}
            {!selId ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#50677A', fontSize: '0.85rem' }}>
                Bir oturum seçin
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Thread header */}
                <div style={{
                  padding: '0.5rem 0.875rem', borderBottom: '1px solid #D9E2EC',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#fff', flexShrink: 0,
                }}>
                  <span style={{ fontSize: '0.78rem', color: '#50677A' }}>
                    {adminIsActive
                      ? '✅ Siz aktifsiniz — AI bekliyor'
                      : '🤖 AI yanıtlıyor'}
                  </span>
                  <button
                    onClick={() => fetch(`/admin/api/chatbot/${selId}/takeover${adminIsActive ? '?release=true' : ''}`, { method: 'POST' }).then(() => fetchMessages(selId))}
                    style={{
                      fontSize: '0.72rem', padding: '0.2rem 0.5rem',
                      border: '1px solid #D9E2EC', borderRadius: '0.35rem',
                      background: adminIsActive ? '#EEF3F9' : '#C99A32',
                      color: adminIsActive ? '#102A43' : '#fff',
                      cursor: 'pointer',
                    }}>
                    {adminIsActive ? "AI'ya Bırak" : 'Devral'}
                  </button>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {messages.map(msg => (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'admin' ? 'flex-end' : 'flex-start', gap: '0.15rem' }}>
                      <span style={{ fontSize: '0.62rem', color: '#50677A', paddingInline: '0.2rem' }}>
                        {msg.role === 'user' ? '🙋 Ziyaretçi' : msg.role === 'admin' ? '👤 Siz' : '🤖 AI'}
                        {' · '}
                        {new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div style={{
                        maxWidth: '85%', padding: '0.5rem 0.75rem', fontSize: '0.82rem',
                        lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        borderRadius: msg.role === 'admin'
                          ? '0.75rem 0.75rem 0.1rem 0.75rem'
                          : '0.75rem 0.75rem 0.75rem 0.1rem',
                        background: msg.role === 'admin' ? '#C99A32' : msg.role === 'user' ? '#EEF3F9' : '#F0F7F4',
                        color: msg.role === 'admin' ? '#fff' : '#263F55',
                      }}>
                        {msg.role === 'user' ? (msg.contentTr ?? msg.content) : msg.role === 'admin' ? (msg.contentTr ?? msg.content) : msg.content}
                      </div>
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <p style={{ textAlign: 'center', color: '#50677A', fontSize: '0.8rem', marginTop: '1rem' }}>Henüz mesaj yok</p>
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Reply input */}
                <div style={{ borderTop: '1px solid #D9E2EC', padding: '0.6rem 0.75rem', display: 'flex', gap: '0.5rem', background: '#fff', flexShrink: 0 }}>
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                    placeholder="Türkçe yazın — müşteriye otomatik çevrilir"
                    rows={2}
                    style={{
                      flex: 1, border: '1px solid #D9E2EC', borderRadius: '0.5rem',
                      padding: '0.45rem 0.65rem', fontSize: '0.82rem', resize: 'none',
                      outline: 'none', color: '#102A43', background: '#FAFBFC',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    onClick={sendReply}
                    disabled={!reply.trim() || sending}
                    style={{
                      background: '#C99A32', color: '#fff', border: 'none',
                      borderRadius: '0.5rem', padding: '0 0.875rem',
                      fontWeight: 600, fontSize: '0.82rem',
                      cursor: !reply.trim() || sending ? 'not-allowed' : 'pointer',
                      opacity: !reply.trim() || sending ? 0.5 : 1,
                      alignSelf: 'flex-end', height: 38, flexShrink: 0,
                    }}>
                    {sending ? '…' : 'Gönder'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #D9E2EC', borderRadius: '0.5rem',
  padding: '0.55rem 0.75rem', fontSize: '0.875rem',
  outline: 'none', color: '#102A43', background: '#fff',
  width: '100%', boxSizing: 'border-box',
};
