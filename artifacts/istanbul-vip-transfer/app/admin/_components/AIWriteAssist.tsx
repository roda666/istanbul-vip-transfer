'use client';

import { useState } from 'react';
import { Check, Loader2, Sparkles, X } from 'lucide-react';

export type AIWritingContext = 'blog' | 'service' | 'homepage' | 'chatbot' | 'faq';
export type AIWritingField =
  | 'title'
  | 'body'
  | 'description'
  | 'short_text'
  | 'cta'
  | 'seo_title'
  | 'seo_description'
  | 'faq_question'
  | 'faq_answer'
  | 'chatbot_answer';

type AIWriteAssistProps = {
  context: AIWritingContext;
  field: AIWritingField;
  label: string;
  value: string;
  onChange: (value: string) => void;
  language?: string;
  maxLength?: number;
  disabled?: boolean;
};

type GenerateResponse = { text?: string; error?: string };
const DEFAULT_GENERATION_ERROR = 'AI taslağı oluşturulamadı. Lütfen tekrar deneyin.';

function safeErrorMessage(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_GENERATION_ERROR;
}

async function readJson(response: Response): Promise<GenerateResponse> {
  const raw = await response.text();
  if (!raw.trim()) return { error: 'Sunucu boş yanıt döndürdü.' };
  try { return JSON.parse(raw) as GenerateResponse; }
  catch { return { error: 'Sunucu beklenmeyen bir yanıt döndürdü.' }; }
}

/**
 * Shared, non-persisting AI helper for admin content fields. The generated
 * draft remains local until the editor explicitly applies and saves it.
 */
export function AIWriteAssist({
  context,
  field,
  label,
  value,
  onChange,
  language = 'tr',
  maxLength,
  disabled = false,
}: AIWriteAssistProps) {
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isContinuation = value.trim().length > 0;

  async function generate() {
    if (loading || disabled) return;
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 100_000);
    try {
      const response = await fetch('/admin/api/ai-writing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          context,
          field,
          fieldLabel: label,
          currentText: value,
          language,
          maxLength,
        }),
      });
      const payload = await readJson(response);
      if (!response.ok || !payload.text) {
        throw new Error(safeErrorMessage(payload.error));
      }
      setDraft(payload.text);
    } catch (cause) {
      setError(cause instanceof DOMException && cause.name === 'AbortError'
        ? 'AI isteği zaman aşımına uğradı. Lütfen tekrar deneyin.'
        : cause instanceof Error ? safeErrorMessage(cause.message) : DEFAULT_GENERATION_ERROR);
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }

  function apply(mode: 'replace' | 'append') {
    if (draft === null) return;
    onChange(mode === 'append' && value.trim() ? `${value.trimEnd()}\n\n${draft.trim()}` : draft);
    setDraft(null);
  }

  return (
    <div style={{ marginTop: '7px' }} data-testid={`ai-write-assist-${context}-${field}`}>
      <button
        type="button"
        onClick={generate}
        disabled={disabled || loading}
        aria-label={`${label} için ${isContinuation ? 'AI ile devam et' : 'AI ile yaz'}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 9px',
          borderRadius: '6px', border: '1px solid #C7D2FE', background: '#EEF2FF',
          color: '#4338CA', fontSize: '11px', fontWeight: 700, cursor: disabled || loading ? 'wait' : 'pointer',
          fontFamily: 'Inter, sans-serif', opacity: disabled ? 0.55 : 1,
        }}
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
        {loading ? 'Yazılıyor…' : isContinuation ? 'AI ile devam et' : 'AI ile yaz'}
      </button>

      {error && (
        <p role="alert" style={{ margin: '6px 0 0', color: '#B42318', fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>
          {error}
        </p>
      )}

      {draft !== null && (
        <div style={{ marginTop: '8px', padding: '10px', border: '1px solid #C7D2FE', borderRadius: '8px', background: '#F8FAFF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
            <strong style={{ color: '#3730A3', fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>AI taslağı — uygulamadan önce düzenleyin</strong>
            <button type="button" onClick={() => setDraft(null)} aria-label="AI taslağını kapat" style={{ border: 'none', background: 'none', color: '#64748B', cursor: 'pointer', padding: 2 }}>
              <X size={14} />
            </button>
          </div>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label={`${label} AI taslağı`}
            style={{ width: '100%', minHeight: '92px', resize: 'vertical', boxSizing: 'border-box', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '8px', background: '#FFF', color: '#172B3A', fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
            <button type="button" onClick={() => apply('replace')} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: 'none', borderRadius: '6px', padding: '6px 9px', background: '#4338CA', color: '#FFF', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
              <Check size={13} /> Metnin yerine koy
            </button>
            {value.trim() && (
              <button type="button" onClick={() => apply('append')} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #C7D2FE', borderRadius: '6px', padding: '6px 9px', background: '#FFF', color: '#4338CA', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                Sona ekle
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}