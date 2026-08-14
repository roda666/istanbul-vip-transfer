'use client';

/**
 * AI ile Çevir — persistent job-based AI translation for content entities.
 *
 * Creates a translation job (POST /admin/api/translations/jobs) and processes
 * each target language as a separate request (max concurrency 2) so no single
 * request can time out waiting for all 8 languages. Job state survives browser
 * refresh; re-opening the modal polls the last active job.
 *
 * Safe response parsing: never calls response.json() unconditionally.
 */
import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Brain, Check, X, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { safeFetch, safeJson } from '@/lib/safe-fetch-json';

const LANG_LABELS: Record<string, string> = {
  en: 'English', de: 'Deutsch', ru: 'Русский', ar: 'العربية',
  es: 'Español', fr: 'Français', it: 'Italiano', nl: 'Nederlands',
};

interface Props {
  contentId:   string;
  enabledLangs: string[];
}

interface Task {
  id:                 string;
  targetLanguageCode: string;
  status:             string;
  errorMessage:       string | null;
  attempts:           number;
}

interface Job {
  id:             string;
  status:         string;
  totalTasks:     number;
  completedTasks: number;
  failedTasks:    number;
}

async function concurrentForEach<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let idx = 0;
  const worker = async () => {
    while (idx < items.length) {
      const item = items[idx++];
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

export default function AiTranslateButton({ contentId, enabledLangs }: Props) {
  const [open,     setOpen]     = useState(false);
  const [selected, setSelected] = useState<string[]>(enabledLangs);
  const [running,  setRunning]  = useState(false);
  const [job,      setJob]      = useState<Job | null>(null);
  const [tasks,    setTasks]    = useState<Task[]>([]);
  const [error,    setError]    = useState<string | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const canTranslate = enabledLangs.length > 0;
  const completed = tasks.filter(t => t.status === 'COMPLETED').length;
  const failed    = tasks.filter(t => t.status === 'FAILED').length;
  const pending   = tasks.filter(t => ['QUEUED', 'RUNNING', 'RETRYING'].length && ['QUEUED', 'RUNNING', 'RETRYING'].includes(t.status)).length;
  const isDone    = job && !running && !['QUEUED', 'RUNNING'].includes(job.status);

  const refreshJob = useCallback(async (id: string) => {
    const result = await safeFetch<{ job: Job; tasks: Task[] }>(
      `/admin/api/translations/jobs/${id}`, {}, 'AiTranslateButton/refresh'
    );
    if (result.ok && result.data) {
      setJob(result.data.job);
      setTasks(result.data.tasks);
    }
  }, []);

  const runTask = useCallback(async (jobId: string, taskId: string) => {
    const res = await fetch(`/admin/api/translations/jobs/${jobId}/tasks/${taskId}/run`, { method: 'POST' });
    await safeJson(res, 'AiTranslateButton/runTask');
    await refreshJob(jobId);
  }, [refreshJob]);

  async function submit() {
    if (!selected.length) return;
    setRunning(true);
    setError(null);
    setJob(null);
    setTasks([]);

    const result = await safeFetch<{ job: Job; tasks: Task[] }>(
      '/admin/api/translations/jobs',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'content',
          entityId:   contentId,
          targetLanguageCodes: selected,
          force: false,
        }),
      },
      'AiTranslateButton/createJob'
    );

    if (!result.ok || !result.data) {
      setError(result.error || 'İş oluşturulamadı.');
      setRunning(false);
      return;
    }

    const { job: newJob, tasks: newTasks } = result.data;
    jobIdRef.current = newJob.id;
    setJob(newJob);
    setTasks(newTasks);

    // Process QUEUED tasks with concurrency 2
    const queued = newTasks.filter(t => t.status === 'QUEUED');
    await concurrentForEach(queued, 2, async (task) => {
      await runTask(newJob.id, task.id);
    });

    await refreshJob(newJob.id);
    setRunning(false);
  }

  async function retryFailed(force = false) {
    if (!jobIdRef.current) return;
    setRunning(true);
    setError(null);

    const result = await safeFetch<{ ok: boolean; tasks: Task[] }>(
      `/admin/api/translations/jobs/${jobIdRef.current}/retry-failed`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force }) },
      'AiTranslateButton/retry'
    );

    if (!result.ok || !result.data) {
      setError(result.error || 'Yeniden deneme başlatılamadı.');
      setRunning(false);
      return;
    }

    const retryTasks = result.data.tasks.filter(t => t.status === 'QUEUED');
    setTasks(result.data.tasks);

    await concurrentForEach(retryTasks, 2, async (task) => {
      await runTask(jobIdRef.current!, task.id);
    });

    await refreshJob(jobIdRef.current!);
    setRunning(false);
  }

  const hasFailed = failed > 0 && !running;
  const hasNeedsConfirmation = hasFailed && tasks.some(t =>
    t.status === 'FAILED' && t.errorMessage?.includes('elle düzenlenmiş') ||
    t.errorMessage?.includes('onay')
  );

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); }}
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
          onClick={(e) => { if (e.target === e.currentTarget && !running) setOpen(false); }}
        >
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '28px', maxWidth: '480px', width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', fontFamily: 'Inter, sans-serif', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1A2B3C', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Brain size={18} style={{ color: '#7C3AED' }} />
                AI ile Çevir
              </h3>
              <button
                onClick={() => setOpen(false)}
                disabled={running}
                style={{ background: 'none', border: 'none', cursor: running ? 'not-allowed' : 'pointer', color: '#8899AA', padding: '4px', opacity: running ? 0.5 : 1 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ background: '#FFF7ED', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#92400E' }}>
              <AlertTriangle size={12} style={{ display: 'inline', marginRight: '4px' }} />
              AI çevirileri her zaman <strong>Taslak</strong> olarak kaydedilir. Yayınlanmadan önce inceleme ve onay gereklidir.
            </div>

            {!canTranslate ? (
              <p style={{ color: '#50677A', fontSize: '13px', marginBottom: '16px' }}>
                Hiçbir hedef dil etkinleştirilmemiş.{' '}
                <Link href="/admin/diller" style={{ color: '#2563EB' }}>Dil Yönetimi</Link>{' '}
                sayfasından dil ekleyin.
              </p>
            ) : !job ? (
              <>
                <p style={{ fontSize: '13px', color: '#50677A', marginBottom: '12px' }}>Hangi dillere çevrilsin?</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {enabledLangs.map((lang) => (
                    <label
                      key={lang}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px', border: `2px solid ${selected.includes(lang) ? '#7C3AED' : '#E8EDF3'}`, background: selected.includes(lang) ? '#EDE9FE' : '#FFFFFF', transition: 'all 0.15s' }}
                    >
                      <input type="checkbox" checked={selected.includes(lang)}
                        onChange={(e) => { if (e.target.checked) setSelected(p => [...p, lang]); else setSelected(p => p.filter(l => l !== lang)); }}
                        style={{ accentColor: '#7C3AED' }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#1A2B3C' }}>{LANG_LABELS[lang] ?? lang}</span>
                      <code style={{ marginLeft: 'auto', fontSize: '11px', background: '#F3F6FA', padding: '1px 6px', borderRadius: '4px', color: '#6B7A8A' }}>{lang}</code>
                    </label>
                  ))}
                </div>
              </>
            ) : null}

            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#991B1B' }}>
                {error}
              </div>
            )}

            {/* Progress display */}
            {job && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#1A2B3C' }}>
                    {running
                      ? `${completed}/${job.totalTasks} dil tamamlandı…`
                      : job.status === 'COMPLETED'
                      ? `${completed}/${job.totalTasks} dil başarıyla çevrildi ✓`
                      : job.status === 'PARTIAL'
                      ? `${completed} başarılı, ${failed} başarısız`
                      : `${completed}/${job.totalTasks} tamamlandı`}
                  </span>
                  {running && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: '#7C3AED' }} />}
                </div>

                {/* Progress bar */}
                <div style={{ height: '4px', background: '#F0F4F8', borderRadius: '2px', marginBottom: '12px' }}>
                  <div style={{ height: '4px', borderRadius: '2px', background: failed > 0 ? '#F59E0B' : '#7C3AED', width: `${job.totalTasks > 0 ? ((completed + failed) / job.totalTasks) * 100 : 0}%`, transition: 'width 0.3s' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {tasks.map(task => {
                    const isOk       = task.status === 'COMPLETED';
                    const isFailed   = task.status === 'FAILED';
                    const isRunning  = task.status === 'RUNNING';
                    const isRetrying = task.status === 'RETRYING';
                    return (
                      <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '6px', background: isOk ? '#F0FDF4' : isFailed ? '#FFF1F2' : '#F8FAFC', border: `1px solid ${isOk ? '#86EFAC' : isFailed ? '#FECDD3' : '#E2E8F0'}` }}>
                        {isRunning || isRetrying
                          ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', color: '#7C3AED', flexShrink: 0 }} />
                          : isOk
                          ? <Check size={12} style={{ color: '#16A34A', flexShrink: 0 }} />
                          : isFailed
                          ? <X size={12} style={{ color: '#DC2626', flexShrink: 0 }} />
                          : <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#CBD5E1', display: 'inline-block', flexShrink: 0 }} />}
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#1A2B3C', minWidth: '28px' }}>{task.targetLanguageCode.toUpperCase()}</span>
                        <span style={{ fontSize: '11px', color: '#60748A', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {isOk ? 'Taslak oluşturuldu'
                           : isFailed ? (task.errorMessage ?? 'Başarısız')
                           : isRunning ? 'Çevriliyor…'
                           : isRetrying ? 'Yeniden deneniyor…'
                           : 'Sırada'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {isDone && completed > 0 && (
                  <Link href="/admin/ceviriler" style={{ display: 'inline-block', marginTop: '10px', fontSize: '12px', color: '#2563EB' }}>
                    Çeviriler sayfasında incele →
                  </Link>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {hasFailed && !running && (
                <>
                  <button
                    onClick={() => retryFailed(false)}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#F59E0B', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <RefreshCw size={12} /> Başarısızları Yeniden Dene
                  </button>
                  {hasNeedsConfirmation && (
                    <button
                      onClick={() => retryFailed(true)}
                      style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #DC2626', background: '#FFF', color: '#DC2626', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                    >
                      Zorla Üzerine Yaz
                    </button>
                  )}
                </>
              )}
              <button
                onClick={() => { if (!running) setOpen(false); }}
                disabled={running}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #D9E2EC', background: '#FFF', cursor: running ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: running ? 0.6 : 1 }}
              >
                {isDone ? 'Kapat' : 'İptal'}
              </button>
              {!job && canTranslate && (
                <button
                  onClick={submit}
                  disabled={running || selected.length === 0}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#7C3AED', color: '#FFF', cursor: running || selected.length === 0 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', opacity: running || selected.length === 0 ? 0.6 : 1 }}
                >
                  {running && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                  {running ? 'Çevriliyor…' : `${selected.length} dile çevir`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
