'use client';

import { useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import type { AIWritingContext } from './AIWriteAssist';

type Props = {
  context: AIWritingContext;
  title: string;
  description: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  language?: string;
  disabled?: boolean;
};

type GenerateResponse = { text?: string; error?: string };
const DEFAULT_ERROR = 'SEO önerisi oluşturulamadı. Lütfen tekrar deneyin.';

async function generateField(
  context: AIWritingContext,
  field: 'seo_title' | 'seo_description',
  currentText: string,
  language: string,
  maxLength: number,
): Promise<string> {
  const response = await fetch('/admin/api/ai-writing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      context,
      field,
      fieldLabel: field === 'seo_title' ? 'SEO Meta Başlık' : 'SEO Meta Açıklama',
      currentText,
      language,
      maxLength,
    }),
  });
  const payload = await response.json().catch(() => ({})) as GenerateResponse;
  if (!response.ok || !payload.text) throw new Error(payload.error || DEFAULT_ERROR);
  return payload.text;
}

/**
 * Produces a reviewable SEO title/description pair without saving any editor
 * data. Authorization and audit handling remain centralized in ai-writing.
 */
export function AISeoGenerator({
  context,
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  language = 'tr',
  disabled = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<{ title: string; description: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (loading || disabled) return;
    setLoading(true);
    setError(null);
    try {
      const [nextTitle, nextDescription] = await Promise.all([
        generateField(context, 'seo_title', title, language, 60),
        generateField(context, 'seo_description', description, language, 160),
      ]);
      setDraft({ title: nextTitle, description: nextDescription });
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : DEFAULT_ERROR);
    } finally {
      setLoading(false);
    }
  }

  function applyDraft() {
    if (!draft) return;
    onTitleChange(draft.title);
    onDescriptionChange(draft.description);
    setDraft(null);
  }

  return (
    <div style={{ margin: '0 0 14px' }}>
      <button type="button" onClick={generate} disabled={loading || disabled} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid #C7D2FE', borderRadius: '6px', padding: '6px 9px', background: '#EEF2FF', color: '#4338CA', fontSize: '11px', fontWeight: 700, cursor: loading || disabled ? 'wait' : 'pointer', opacity: disabled ? 0.55 : 1 }}>
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
        {loading ? 'SEO oluşturuluyor...' : 'AI ile SEO oluştur'}
      </button>
      {error && <p role="alert" style={{ color: '#B91C1C', fontSize: '11px', margin: '6px 0 0' }}>{error}</p>}
      {draft && (
        <div style={{ marginTop: '8px', padding: '10px', border: '1px solid #C7D2FE', borderRadius: '7px', background: '#F8FAFF' }}>
          <p style={{ color: '#3730A3', fontSize: '11px', fontWeight: 700, margin: '0 0 6px' }}>AI önerisi — kaydetmeden önce gözden geçirin</p>
          <p style={{ color: '#334155', fontSize: '12px', margin: '0 0 4px' }}><strong>Başlık:</strong> {draft.title}</p>
          <p style={{ color: '#334155', fontSize: '12px', margin: '0 0 8px' }}><strong>Açıklama:</strong> {draft.description}</p>
          <button type="button" onClick={applyDraft} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: 'none', borderRadius: '6px', padding: '6px 9px', background: '#4338CA', color: '#FFF', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
            <Check size={13} /> Her ikisini uygula
          </button>
        </div>
      )}
    </div>
  );
}