'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { LOCALE_REGISTRY } from '@/lib/i18n/locale-registry';
import { 
  Plus, Edit2, Trash2, Globe, X, Filter, AlertCircle, Save, Loader2, Database 
} from 'lucide-react';
import { AIWriteAssist } from '@/app/admin/_components/AIWriteAssist';

type AIWritingLanguage = 'tr' | 'en' | 'de' | 'ru' | 'ar' | 'fr' | 'es' | 'it' | 'nl';

interface KnowledgeRecord {
  id: string;
  title: string;
  question: string | null;
  answer: string;
  category: string | null;
  language: string;
  isActive: boolean;
  sourceId: string | null;
  createdAt: string;
  updatedAt: string;
}

const LANGUAGES = LOCALE_REGISTRY.map(l => ({
  code: l.code,
  name: l.nativeName,
}));

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu.';
}

export default function ChatbotKnowledgeClient() {
  const [records, setRecords] = useState<KnowledgeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterLang, setFilterLang] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('');

  // Modals
  const [editForm, setEditForm] = useState<Partial<KnowledgeRecord> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [translateId, setTranslateId] = useState<string | null>(null);

  const [targetLang, setTargetLang] = useState('');
  
  // Action states
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [translating, setTranslating] = useState(false);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (filterLang) q.set('language', filterLang);
      if (filterActive) q.set('active', filterActive);
      const res = await fetch(`/admin/api/chatbot/knowledge?${q.toString()}`);
      if (!res.ok) throw new Error('Kayıtlar yüklenemedi');
      const data = await res.json() as { records?: KnowledgeRecord[] };
      setRecords(data.records ?? []);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [filterLang, filterActive]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Actions
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm || !editForm.title || !editForm.answer || !editForm.language) return;
    setSaving(true);
    try {
      const isUpdate = !!editForm.id;
      const url = isUpdate 
        ? `/admin/api/chatbot/knowledge/${editForm.id}`
        : '/admin/api/chatbot/knowledge';
      
      const payload = {
        title: editForm.title,
        question: editForm.question || null,
        answer: editForm.answer,
        category: editForm.category || null,
        language: editForm.language,
        isActive: editForm.isActive !== undefined ? editForm.isActive : true,
      };

      const res = await fetch(url, {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Kaydedilemedi');
      await loadRecords();
      setEditForm(null);
    } catch {
      alert('Kayıt işlemi başarısız oldu.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/admin/api/chatbot/knowledge/${deleteId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Silinemedi');
      await loadRecords();
      setDeleteId(null);
    } catch {
      alert('Silme işlemi başarısız oldu.');
    } finally {
      setDeleting(false);
    }
  };

  const handleTranslate = async () => {
    if (!translateId || !targetLang) return;
    setTranslating(true);
    try {
      const res = await fetch(`/admin/api/chatbot/knowledge/${translateId}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLanguage: targetLang })
      });
      if (!res.ok) throw new Error('Çeviri yapılamadı');
      await loadRecords();
      setTranslateId(null);
      setTargetLang('');
    } catch {
      alert('Çeviri işlemi başarısız oldu.');
    } finally {
      setTranslating(false);
    }
  };

  const toggleActive = async (record: KnowledgeRecord) => {
    try {
      // Optimistic update
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, isActive: !r.isActive } : r));
      const res = await fetch(`/admin/api/chatbot/knowledge/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !record.isActive })
      });
      if (!res.ok) {
        // Revert
        setRecords(prev => prev.map(r => r.id === record.id ? { ...r, isActive: record.isActive } : r));
        throw new Error('Güncellenemedi');
      }
    } catch {
      alert('Durum güncellenemedi.');
    }
  };

  // UI Components
  const buttonBaseStyle = {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 500,
    cursor: 'pointer', border: 'none', transition: 'all 0.2s',
  };

  const primaryBtnStyle = { ...buttonBaseStyle, background: '#C99A32', color: '#fff' };
  const outlineBtnStyle = { ...buttonBaseStyle, background: '#fff', color: '#334155', border: '1px solid #E2E8F0' };
  const dangerBtnStyle = { ...buttonBaseStyle, background: '#EF4444', color: '#fff' };
  
  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '6px',
    border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '16px 20px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} color="#64748B" />
            <select
              style={{ ...inputStyle, width: '140px', padding: '8px 10px' }}
              value={filterLang}
              onChange={(e) => setFilterLang(e.target.value)}
            >
              <option value="">Tüm Diller</option>
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              style={{ ...inputStyle, width: '140px', padding: '8px 10px' }}
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
            >
              <option value="">Tüm Durumlar</option>
              <option value="true">Sadece Aktif</option>
              <option value="false">Sadece Pasif</option>
            </select>
          </div>
        </div>
        <button 
          style={primaryBtnStyle}
          onClick={() => setEditForm({ language: 'tr', isActive: true })}
        >
          <Plus size={16} /> Yeni Kayıt Ekle
        </button>
      </div>

      {/* Content */}
      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#64748B', gap: '12px' }}>
            <Loader2 size={24} className="animate-spin" />
            <span>Kayıtlar yükleniyor...</span>
          </div>
        ) : error ? (
          <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#EF4444', gap: '12px' }}>
            <AlertCircle size={24} />
            <span>{error}</span>
            <button style={outlineBtnStyle} onClick={loadRecords}>Tekrar Dene</button>
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#64748B', gap: '12px' }}>
            <Database size={32} color="#CBD5E1" />
            <span>Kayıt bulunamadı.</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600, width: '30%' }}>Başlık / Soru</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Kategori</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Dil</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Durum</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: i === records.length - 1 ? 'none' : '1px solid #E2E8F0', background: r.sourceId ? '#FDFDFD' : '#FFF' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: '4px' }}>{r.title}</div>
                      {r.question && <div style={{ color: '#64748B', fontSize: '12px' }}>Soru: {r.question}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>
                      {r.category ? <span style={{ background: '#F1F5F9', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>{r.category}</span> : '-'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>
                      {LANGUAGES.find(l => l.code === r.language)?.name || r.language.toUpperCase()}
                      {r.sourceId && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#94A3B8', border: '1px solid #E2E8F0', borderRadius: '4px', padding: '2px 4px' }}>Çeviri</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
                        <input type="checkbox" checked={r.isActive} onChange={() => toggleActive(r)} style={{ accentColor: '#C99A32', width: '16px', height: '16px' }} />
                        <span style={{ color: r.isActive ? '#16A34A' : '#64748B', fontSize: '12px', fontWeight: 500 }}>
                          {r.isActive ? 'Aktif' : 'Pasif'}
                        </span>
                      </label>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setTranslateId(r.id)}
                          style={{ padding: '6px', background: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD', borderRadius: '4px', cursor: 'pointer', display: 'flex' }}
                          title="Çevir"
                        >
                          <Globe size={14} />
                        </button>
                        <button
                          onClick={() => setEditForm(r)}
                          style={{ padding: '6px', background: '#F8FAFC', color: '#334155', border: '1px solid #E2E8F0', borderRadius: '4px', cursor: 'pointer', display: 'flex' }}
                          title="Düzenle"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteId(r.id)}
                          style={{ padding: '6px', background: '#FEF2F2', color: '#EF4444', border: '1px solid #FECACA', borderRadius: '4px', cursor: 'pointer', display: 'flex' }}
                          title="Sil"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit/Create Modal */}
      {editForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '8px', width: '600px', maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#0F172A' }}>
                {editForm.id ? 'Kaydı Düzenle' : 'Yeni Kayıt Ekle'}
              </h2>
              <button onClick={() => setEditForm(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex' }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} style={{ overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#334155', marginBottom: '6px' }}>Başlık *</label>
                <input
                  required
                  style={inputStyle}
                  placeholder="Örn: Bagaj Kapasitesi"
                  value={editForm.title || ''}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                />
                <AIWriteAssist context="chatbot" field="title" label="Bilgi başlığı" value={editForm.title || ''} onChange={v => setEditForm({ ...editForm, title: v })} language={(editForm.language || 'tr') as AIWritingLanguage} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#334155', marginBottom: '6px' }}>Kategori</label>
                <input
                  style={inputStyle}
                  placeholder="Örn: Kurallar (İsteğe bağlı)"
                  value={editForm.category || ''}
                  onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#334155', marginBottom: '6px' }}>Dil *</label>
                <select
                  required
                  style={inputStyle}
                  value={editForm.language || 'tr'}
                  onChange={e => setEditForm({ ...editForm, language: e.target.value })}
                  disabled={!!editForm.id}
                >
                  {LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#334155', marginBottom: '6px' }}>Soru (Varyasyonlar) <span style={{ color: '#94A3B8' }}>(İsteğe bağlı)</span></label>
                <input
                  style={inputStyle}
                  placeholder="Kullanıcının sorabileceği olası sorular"
                  value={editForm.question || ''}
                  onChange={e => setEditForm({ ...editForm, question: e.target.value })}
                />
                <AIWriteAssist context="chatbot" field="faq_question" label="Soru varyasyonu" value={editForm.question || ''} onChange={v => setEditForm({ ...editForm, question: v })} language={(editForm.language || 'tr') as AIWritingLanguage} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#334155', marginBottom: '6px' }}>Yanıt *</label>
                <textarea
                  required
                  style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
                  placeholder="Chatbotun vereceği resmi yanıt..."
                  value={editForm.answer || ''}
                  onChange={e => setEditForm({ ...editForm, answer: e.target.value })}
                />
                <AIWriteAssist context="chatbot" field="chatbot_answer" label="Chatbot yanıtı" value={editForm.answer || ''} onChange={v => setEditForm({ ...editForm, answer: v })} language={(editForm.language || 'tr') as AIWritingLanguage} maxLength={5_000} />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editForm.isActive !== false}
                    onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })}
                    style={{ accentColor: '#C99A32', width: '16px', height: '16px' }}
                  />
                  <span style={{ fontSize: '14px', color: '#334155' }}>Aktif (Chatbot kullanabilir)</span>
                </label>
              </div>
            </form>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#F8FAFC' }}>
              <button type="button" style={outlineBtnStyle} onClick={() => setEditForm(null)} disabled={saving}>İptal</button>
              <button type="button" style={primaryBtnStyle} onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Translate Modal */}
      {translateId && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '8px', width: '400px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0F172A' }}>AI ile Çevir</h2>
              <button onClick={() => { setTranslateId(null); setTargetLang(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#475569' }}>
                Bu kaydı yapay zeka kullanarak seçtiğiniz dile çevirebilirsiniz. Yeni çeviri ayrı bir kayıt olarak eklenecektir.
              </p>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#334155', marginBottom: '6px' }}>Hedef Dil</label>
                <select
                  style={inputStyle}
                  value={targetLang}
                  onChange={e => setTargetLang(e.target.value)}
                >
                  <option value="" disabled>Dil Seçin...</option>
                  {LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#F8FAFC' }}>
              <button type="button" style={outlineBtnStyle} onClick={() => { setTranslateId(null); setTargetLang(''); }} disabled={translating}>İptal</button>
              <button type="button" style={primaryBtnStyle} onClick={handleTranslate} disabled={translating || !targetLang}>
                {translating ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                {translating ? 'Çevriliyor...' : 'Çevir ve Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '8px', width: '400px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '24px', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600, color: '#0F172A' }}>Kaydı Sil</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#475569' }}>
                  Bu bilgiyi tamamen silmek istediğinize emin misiniz? Chatbot bu bilgiye artık erişemeyecektir.
                </p>
              </div>
            </div>
            <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'center', gap: '12px', background: '#F8FAFC', borderRadius: '0 0 8px 8px' }}>
              <button style={outlineBtnStyle} onClick={() => setDeleteId(null)} disabled={deleting}>İptal</button>
              <button style={dangerBtnStyle} onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
