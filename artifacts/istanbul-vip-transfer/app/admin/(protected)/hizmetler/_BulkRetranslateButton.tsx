'use client';

import { useState } from 'react';

type QueuedTask = { jobId: string; taskId: string };

const CONCURRENCY = 2;

export default function BulkRetranslateButton() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function runAll() {
    if (!window.confirm('Tüm aktif hizmet sayfaları etkin dillere yeniden çevrilecek. Elle kilitlenmiş çeviriler korunur. Devam edilsin mi?')) {
      return;
    }

    setIsRunning(true);
    setMessage(null);
    try {
      const setup = await fetch('/admin/api/service-pages/retranslate-all', { method: 'POST' });
      const payload = await setup.json() as {
        queuedTasks?: QueuedTask[];
        serviceCount?: number;
        localeCount?: number;
        error?: string;
      };
      if (!setup.ok) throw new Error(payload.error ?? 'Çeviri kuyruğu başlatılamadı.');

      const tasks = payload.queuedTasks ?? [];
      if (tasks.length === 0) {
        setMessage('Çalıştırılacak yeni çeviri görevi yok. Devam eden görevler varsa Çeviriler ekranından takip edebilirsiniz.');
        return;
      }

      let done = 0;
      let failed = 0;
      const total = tasks.length;
      setProgress({ done, total, failed });

      const worker = async () => {
        while (tasks.length > 0) {
          const task = tasks.shift();
          if (!task) return;
          try {
            const response = await fetch(
              `/admin/api/translations/jobs/${task.jobId}/tasks/${task.taskId}/run`,
              { method: 'POST' },
            );
            if (!response.ok) failed += 1;
          } catch {
            failed += 1;
          } finally {
            done += 1;
            setProgress({ done, total, failed });
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, worker));
      setMessage(
        failed === 0
          ? `${payload.serviceCount} hizmet × ${payload.localeCount} dil için çeviri tamamlandı.`
          : `${done} görev tamamlandı; ${failed} görev başarısız oldu. Çeviriler ekranından yeniden deneyebilirsiniz.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Çeviri kuyruğu başlatılamadı.');
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={runAll}
        disabled={isRunning}
        style={{
          border: '1px solid #7C3AED',
          background: isRunning ? '#EDE9FE' : '#F5F3FF',
          color: '#5B21B6',
          borderRadius: '8px',
          padding: '8px 14px',
          fontSize: '12px',
          fontWeight: 700,
          fontFamily: 'Inter, sans-serif',
          cursor: isRunning ? 'wait' : 'pointer',
        }}
      >
        {isRunning
          ? `Çevriliyor… ${progress?.done ?? 0}/${progress?.total ?? 0}`
          : '↺ Tüm Hizmetleri Yeniden Çevir'}
      </button>
      {message && (
        <span role="status" style={{ fontSize: '11px', color: '#475569', fontFamily: 'Inter, sans-serif' }}>
          {message}
        </span>
      )}
    </div>
  );
}