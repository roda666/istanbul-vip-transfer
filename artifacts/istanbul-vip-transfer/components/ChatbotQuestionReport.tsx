'use client';

import { useCallback, useEffect, useState } from 'react';

interface QuestionRow {
  question: string;
  count: number;
  lastAskedAt: string;
}

interface Report {
  periodDays: number;
  totalQuestions: number;
  questions: QuestionRow[];
}

export default function ChatbotQuestionReport() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch('/admin/api/chatbot/report', { cache: 'no-store' });
      if (!response.ok) throw new Error('report_failed');
      setReport(await response.json() as Report);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadReport(); }, [loadReport]);

  return (
    <section
      aria-labelledby="chatbot-question-report-title"
      style={{
        marginTop: '1.5rem',
        background: '#fff',
        border: '1px solid #D9E2EC',
        borderRadius: '0.75rem',
        padding: '1.1rem 1.25rem 1.25rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2 id="chatbot-question-report-title" style={{ margin: 0, color: '#102A43', fontSize: '1rem', fontWeight: 700 }}>
            Son 30 günde en çok sorulanlar
          </h2>
          <p style={{ margin: '0.3rem 0 0', color: '#50677A', fontSize: '0.78rem' }}>
            Ziyaretçi soruları, tekrarları birleştirilerek gösterilir.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadReport()}
          disabled={loading}
          style={{
            minHeight: 40, padding: '0.45rem 0.75rem', borderRadius: '0.5rem',
            border: '1px solid #D9E2EC', background: '#F8FAFC', color: '#263F55',
            cursor: loading ? 'wait' : 'pointer', fontSize: '0.78rem', fontWeight: 600,
          }}
        >
          {loading ? 'Yükleniyor…' : 'Yenile'}
        </button>
      </div>

      {error ? (
        <p style={{ color: '#B42318', fontSize: '0.82rem', margin: '1rem 0 0' }}>
          Rapor şu anda yüklenemedi. Lütfen tekrar deneyin.
        </p>
      ) : loading && !report ? (
        <p style={{ color: '#50677A', fontSize: '0.82rem', margin: '1rem 0 0' }}>Sorular hazırlanıyor…</p>
      ) : report && report.totalQuestions === 0 ? (
        <p style={{ color: '#50677A', fontSize: '0.82rem', margin: '1rem 0 0' }}>
          Son 30 günde raporlanacak ziyaretçi sorusu yok.
        </p>
      ) : report ? (
        <>
          <p style={{ color: '#50677A', fontSize: '0.75rem', margin: '1rem 0 0.6rem' }}>
            Toplam ziyaretçi sorusu: <strong style={{ color: '#102A43' }}>{report.totalQuestions}</strong>
          </p>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
            {report.questions.map((item, index) => (
              <li
                key={`${item.question}-${index}`}
                style={{
                  display: 'grid', gridTemplateColumns: '1.6rem 1fr auto', alignItems: 'start',
                  gap: '0.55rem', padding: '0.65rem 0.7rem', borderRadius: '0.5rem',
                  background: index === 0 ? '#FFF9E8' : '#F8FAFC',
                }}
              >
                <span style={{ color: '#C99A32', fontWeight: 700, fontSize: '0.8rem' }}>{index + 1}</span>
                <span style={{ color: '#263F55', fontSize: '0.82rem', lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                  {item.question}
                </span>
                <span style={{ color: '#102A43', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {item.count} kez
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </section>
  );
}