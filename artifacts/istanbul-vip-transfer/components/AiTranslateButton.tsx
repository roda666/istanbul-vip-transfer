'use client';

/**
 * AI ile Çevir — triggers AI translation jobs for a content entity.
 * Shown in the blog article editor. Results are saved as DRAFT and must
 * be reviewed + approved before publication.
 */
import { useState } from 'react';
import Link from 'next/link';
import { Brain, Check, X, Loader2, AlertTriangle } from 'lucide-react';

const LANG_LABELS: Record<string, string> = {
  en: 'English',
  de: 'Deutsch',
  ru: 'Русский',
  ar: 'العربية',
};

interface Props {
  contentId: string;
  enabledLangs: string[];
}

type Result = { lang: string; status: string; jobId?: string; error?: string };

export default function AiTranslateButton({ contentId, enabledLangs }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(enabledLangs);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setRunning(true);
    setResults(null);
    setError(null);
    try {
      const res = await fetch('/admin/api/translations/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'content',
          entityId: contentId,
          targetLanguageCodes: selected,
        }),
      });
      const data = await res.json();
      if (res.status === 503) {
        setError(data.error ?? 'OpenAI çeviri servisi yapılandırılmamış (OPENAI_API_KEY gereklidir).');
        return;
      }
      if (!res.ok && res.status !== 207) {
        setError(data.error ?? 'Çeviri başlatılamadı.');
        return;
      }
      setResults(data.results ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  const canTranslate = enabledLangs.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setResults(null); setError(null); }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
        style={{ background: '#EDE9FE', color: '#5B21B6', border: '1px solid #DDD6FE', fontFamily: 'Inter, sans-serif' }}
        title="AI ile tüm dillere çevir"
      >
        <Brain size={15} aria-hidden="true" />
        AI ile Çevir
      </button>

      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            style={{ background: '#FFFFFF', borderRadius: '16px', padding: '28px', maxWidth: '460px', width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', fontFamily: 'Inter, sans-serif' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1A2B3C', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Brain size={18} style={{ color: '#7C3AED' }} />
                AI ile Çevir
              </h3>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8899AA', padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <div
              style={{ background: '#FFF7ED', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#92400E' }}
            >
              <AlertTriangle size={12} style={{ display: 'inline', marginRight: '4px' }} />
              AI çevirileri her zaman <strong>Taslak</strong> olarak kaydedilir. Yayınlanmadan önce inceleme ve onay gereklidir.
            </div>

            {!canTranslate ? (
              <p style={{ color: '#50677A', fontSize: '13px', marginBottom: '16px' }}>
                Hiçbir hedef dil etkinleştirilmemiş. <Link href="/admin/diller" style={{ color: '#2563EB' }}>Dil Yönetimi</Link> sayfasından dil ekleyin.
              </p>
            ) : (
              <>
                <p style={{ fontSize: '13px', color: '#50677A', marginBottom: '12px' }}>
                  Hangi dillere çevrilsin?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {enabledLangs.map((lang) => (
                    <label
                      key={lang}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px', border: `2px solid ${selected.includes(lang) ? '#7C3AED' : '#E8EDF3'}`, background: selected.includes(lang) ? '#EDE9FE' : '#FFFFFF', transition: 'all 0.15s' }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(lang)}
                        onChange={(e) => {
                          if (e.target.checked) setSelected((p) => [...p, lang]);
                          else setSelected((p) => p.filter((l) => l !== lang));
                        }}
                        style={{ accentColor: '#7C3AED' }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#1A2B3C' }}>
                        {LANG_LABELS[lang] ?? lang}
                      </span>
                      <code style={{ marginLeft: 'auto', fontSize: '11px', background: '#F3F6FA', padding: '1px 6px', borderRadius: '4px', color: '#6B7A8A' }}>{lang}</code>
                    </label>
                  ))}
                </div>
              </>
            )}

            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#991B1B' }}>
                {error}
              </div>
            )}

            {results && (
              <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                {results.map((r) => (
                  <div key={r.lang} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: r.status === 'draft' ? '#065F46' : '#991B1B', marginBottom: '4px' }}>
                    {r.status === 'draft' ? <Check size={12} /> : <X size={12} />}
                    <strong>{LANG_LABELS[r.lang] ?? r.lang}</strong>: {r.status === 'draft' ? 'Taslak oluşturuldu ✓' : r.error ?? r.status}
                  </div>
                ))}
                {results.every((r) => r.status === 'draft') && (
                  <Link href="/admin/ceviriler" style={{ display: 'inline-block', marginTop: '8px', fontSize: '12px', color: '#2563EB' }}>
                    Çeviriler sayfasında incele →
                  </Link>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setOpen(false)}
                style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #D9E2EC', background: '#FFF', cursor: 'pointer', fontSize: '13px' }}
              >
                {results ? 'Kapat' : 'İptal'}
              </button>
              {!results && canTranslate && (
                <button
                  onClick={submit}
                  disabled={running || selected.length === 0}
                  style={{
                    padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#7C3AED', color: '#FFF',
                    cursor: running || selected.length === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px',
                    opacity: running || selected.length === 0 ? 0.6 : 1,
                  }}
                >
                  {running && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                  {running ? `${selected.length} dile çevriliyor...` : `${selected.length} dile çevir`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
