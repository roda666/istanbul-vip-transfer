'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Vehicle } from '@/db/schema';
import type { ContentStatus } from '@/lib/workflow';
import { STATUS_LABELS } from '@/lib/workflow';
import StatusBadge from '../../_components/StatusBadge';
import { ImageUploadField } from '../../_components/ImageUploadField';
import { AISeoGenerator } from '../../_components/AISeoGenerator';
import { normalizeVehicleType, VEHICLE_TYPE_OPTIONS } from '@/lib/vehicle-options';
import { VEHICLE_FEATURE_CATALOG } from '@/lib/vehicle-feature-catalog';
import { TOLL_VEHICLE_CLASSES, TOLL_VEHICLE_CLASS_DESCRIPTIONS, TOLL_VEHICLE_CLASS_LABELS, TOLL_VEHICLE_CLASS_SELECTION_WARNING } from '@/lib/toll-vehicle-classes';

/** Active toll point, as needed for per-point class assignment. */
export interface TollPointOption {
  id: string;
  name: string;
  classificationLabel: string | null;
  bannedVehicleClasses: string[] | null;
}

export interface TollPointClassAssignment {
  tollPointId: string;
  vehicleClass: string;
}

// ── Design tokens ────────────────────────────────────────────────────────────
const GOLD = '#C9A84C';
const BG2 = '#FFFFFF';
const BORDER = '#D8E1E9';
const TEXT = '#172033';
const MUTED = '#64748B';
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 10px', borderRadius: '7px',
  border: `1px solid ${BORDER}`, background: '#FFFFFF', color: TEXT,
  fontSize: '13px', fontFamily: 'Inter, sans-serif', outline: 'none',
};

// ── Types ────────────────────────────────────────────────────────────────────
interface GalleryItem { url: string; alt: string }

interface FormState {
  name: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  vehicleType: string;
  priceCalculationEligible: boolean;
  pricingClass: string;
  tollClass: string;
  tollClassSourceUrl: string;
  tollClassEvidence: string;
  isActive: boolean;
  passengerCapacity: string;
  luggageCapacity: string;
  coverImage: string;
  coverImageAlt: string;
  features: string[];
  gallery: GalleryItem[];
  displayOrder: string;
  isFeatured: boolean;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  ogImage: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
}

function slugify(val: string) {
  return val
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function vehicleToForm(v: Vehicle): FormState {
  return {
    name: v.name,
    slug: v.slug,
    shortDescription: v.shortDescription ?? '',
    fullDescription: v.fullDescription ?? '',
    vehicleType: normalizeVehicleType(v.vehicleType) ?? '',
    priceCalculationEligible: v.priceCalculationEligible,
    pricingClass: v.pricingClass,
    tollClass: v.tollClass ?? '',
    tollClassSourceUrl: v.tollClassSourceUrl ?? '',
    tollClassEvidence: v.tollClassEvidence ?? '',
    isActive: v.isActive,
    passengerCapacity: v.passengerCapacity != null ? String(v.passengerCapacity) : '',
    luggageCapacity: v.luggageCapacity != null ? String(v.luggageCapacity) : '',
    coverImage: v.coverImage ?? '',
    coverImageAlt: v.coverImageAlt ?? '',
    features: (v.features as string[]).length > 0 ? (v.features as string[]) : [''],
    gallery:
      (v.gallery as GalleryItem[]).length > 0
        ? (v.gallery as GalleryItem[])
        : [{ url: '', alt: '' }],
    displayOrder: String(v.displayOrder),
    isFeatured: v.isFeatured,
    metaTitle: v.metaTitle ?? '',
    metaDescription: v.metaDescription ?? '',
    canonicalUrl: v.canonicalUrl ?? '',
    ogImage: v.ogImage ?? '',
    robotsIndex: v.robotsIndex,
    robotsFollow: v.robotsFollow,
  };
}

const emptyForm: FormState = {
  name: '',
  slug: '',
  shortDescription: '',
  fullDescription: '',
  vehicleType: '',
  priceCalculationEligible: false,
  pricingClass: 'automobile',
  tollClass: '',
  tollClassSourceUrl: '',
  tollClassEvidence: '',
  isActive: true,
  passengerCapacity: '',
  luggageCapacity: '',
  coverImage: '',
  coverImageAlt: '',
  features: [''],
  gallery: [{ url: '', alt: '' }],
  displayOrder: '0',
  isFeatured: false,
  metaTitle: '',
  metaDescription: '',
  canonicalUrl: '',
  ogImage: '',
  robotsIndex: true,
  robotsFollow: true,
};

// ── Sub-components ────────────────────────────────────────────────────────────
function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label
      style={{
        display: 'block',
        color: '#52697A',
        fontSize: '12px',
        fontFamily: 'Inter, sans-serif',
        marginBottom: '6px',
        fontWeight: 600,
      }}
    >
      {children}
      {required && <span style={{ color: '#D64545', marginLeft: '3px' }}>*</span>}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: '100%',
        background: BG2,
        border: `1px solid ${BORDER}`,
        borderRadius: '6px',
        color: '#172B3A',
        fontSize: '13px',
        fontFamily: 'Inter, sans-serif',
        padding: '8px 12px',
        outline: 'none',
        boxSizing: 'border-box',
        opacity: disabled ? 0.5 : 1,
      }}
    />
  );
}

function VehicleTypeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={{
        width: '100%', background: BG2, border: `1px solid ${BORDER}`, borderRadius: '6px',
        color: '#172B3A', fontSize: '13px', fontFamily: 'Inter, sans-serif',
        padding: '8px 12px', outline: 'none', boxSizing: 'border-box',
      }}
    >
      <option value="">Seçiniz</option>
      {VEHICLE_TYPE_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: '100%',
        background: BG2,
        border: `1px solid ${BORDER}`,
        borderRadius: '6px',
        color: '#172B3A',
        fontSize: '13px',
        fontFamily: 'Inter, sans-serif',
        padding: '8px 12px',
        outline: 'none',
        resize: 'vertical',
        boxSizing: 'border-box',
      }}
    />
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        color: GOLD,
        fontSize: '13px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        margin: '32px 0 16px',
        paddingBottom: '8px',
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      {children}
    </h2>
  );
}

function CharCounter({ value, max }: { value: string; max: number }) {
  const len = value.length;
  const over = len > max;
  return (
    <span
      style={{
        fontSize: '11px',
        fontFamily: 'Inter, sans-serif',
        color: over ? '#D64545' : len > max * 0.85 ? '#D97706' : '#718596',
        marginLeft: '4px',
      }}
    >
      {len}/{max}
    </span>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div
      style={{
        background: '#FEF2F2',
        border: '1px solid #FECACA',
        borderRadius: '8px',
        padding: '12px 16px',
        color: '#D64545',
        fontSize: '13px',
        fontFamily: 'Inter, sans-serif',
        marginBottom: '16px',
      }}
    >
      {msg}
    </div>
  );
}

function ActionButton({
  onClick,
  loading,
  disabled,
  variant,
  children,
}: {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  children: React.ReactNode;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: '#2563EB', color: '#FFFFFF', fontWeight: 600 },
    secondary: {
      background: 'transparent',
      color: '#2563EB',
      border: '1px solid #2563EB',
      fontWeight: 500,
    },
    danger: {
      background: '#FEF2F2',
      color: '#D64545',
      border: '1px solid #FECACA',
      fontWeight: 500,
    },
    ghost: {
      background: '#F1F5F9',
      color: '#52697A',
      fontWeight: 400,
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 18px',
        borderRadius: '8px',
        border: 'none',
        fontSize: '13px',
        fontFamily: 'Inter, sans-serif',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.6 : 1,
        transition: 'opacity 0.15s',
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

// ── Confirmation Dialog ───────────────────────────────────────────────────────
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(23,43,58,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #D8E1E9',
          borderRadius: '12px',
          padding: '28px',
          maxWidth: '440px',
          width: '100%',
          boxShadow: '0 8px 32px rgba(23,43,58,0.12)',
        }}
      >
        <h3
          style={{
            color: '#172B3A',
            fontSize: '16px',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            margin: '0 0 12px',
          }}
        >
          {title}
        </h3>
        <p
          style={{
            color: '#52697A',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            margin: '0 0 24px',
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <ActionButton variant="ghost" onClick={onCancel}>
            Vazgeç
          </ActionButton>
          <ActionButton variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  vehicle?: Vehicle;
  userRole: string;
  tollPoints?: TollPointOption[];
}

export default function VehicleForm({ vehicle, userRole, tollPoints = [] }: Props) {
  const router = useRouter();
  const isEdit = !!vehicle;
  const [form, setForm] = useState<FormState>(vehicle ? vehicleToForm(vehicle) : emptyForm);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(isEdit);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Unsaved changes tracking
  const savedRef = useRef(false);
  const isDirty = useCallback(() => {
    if (!isEdit) return form.name.length > 0 || form.slug.length > 0;
    return true; // simplified: always warn on edit to be safe
  }, [form, isEdit]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!savedRef.current && isDirty()) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Auto-slug from name
  function handleNameChange(val: string) {
    setForm((f) => ({
      ...f,
      name: val,
      slug: slugManuallyEdited ? f.slug : slugify(val),
    }));
  }

  function handleSlugChange(val: string) {
    setSlugManuallyEdited(true);
    setForm((f) => ({ ...f, slug: val }));
  }

  /**
   * Fill only empty rows. Existing values are confirmed per-operator choices,
   * so changing a fleet type must never overwrite them.
   */
  function handleVehicleTypeChange(vehicleType: string) {
    setForm((current) => ({ ...current, vehicleType }));
  }

  // Features helpers — a fixed catalog, not free text, so every checked code
  // has a real icon and translation in every public language. Leaving this
  // empty means the vehicle inherits the fleet-wide default list.
  function toggleFeature(code: string) {
    setForm((f) => ({
      ...f,
      features: f.features.includes(code)
        ? f.features.filter((c) => c !== code)
        : [...f.features, code],
    }));
  }

  // Gallery helpers
  function setGalleryItem(i: number, field: keyof GalleryItem, val: string) {
    setForm((f) => {
      const gallery = [...f.gallery];
      gallery[i] = { ...gallery[i], [field]: val };
      return { ...f, gallery };
    });
  }
  function addGalleryItem() {
    setForm((f) => ({ ...f, gallery: [...f.gallery, { url: '', alt: '' }] }));
  }
  function removeGalleryItem(i: number) {
    setForm((f) => ({ ...f, gallery: f.gallery.filter((_, idx) => idx !== i) }));
  }

  function buildPayload() {
    return {
      name: form.name,
      slug: form.slug,
      shortDescription: form.shortDescription || null,
      fullDescription: form.fullDescription || null,
      passengerCapacity: form.passengerCapacity ? parseInt(form.passengerCapacity, 10) : null,
      luggageCapacity: form.luggageCapacity ? parseInt(form.luggageCapacity, 10) : null,
      vehicleType: form.vehicleType || null,
      priceCalculationEligible: form.priceCalculationEligible,
      pricingClass: form.pricingClass,
      tollClass: form.tollClass || null,
      tollClassSourceUrl: form.tollClassSourceUrl || null,
      tollClassEvidence: form.tollClassEvidence || null,
      isActive: form.isActive,
      features: form.features.filter(Boolean),
      coverImage: form.coverImage || null,
      coverImageAlt: form.coverImageAlt || null,
      gallery: form.gallery.filter((g) => g.url),
      displayOrder: parseInt(form.displayOrder, 10) || 0,
      isFeatured: form.isFeatured,
      metaTitle: form.metaTitle || null,
      metaDescription: form.metaDescription || null,
      canonicalUrl: form.canonicalUrl || null,
      ogImage: form.ogImage || null,
      robotsIndex: form.robotsIndex,
      robotsFollow: form.robotsFollow,
    };
  }

  async function handleSave(status: 'DRAFT' | 'REVIEW') {
    setError('');
    setSaving(true);
    try {
      const payload = { ...buildPayload(), status };
      const url = isEdit ? `/admin/api/vehicles/${vehicle!.id}` : '/admin/api/vehicles';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Bir hata oluştu.'); return; }
      savedRef.current = true;
      router.push('/admin/araclar');
      router.refresh();
    } catch {
      setError('Sunucu hatası. Lütfen tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!isEdit || !canPublish) return;
    setError('');
    setSaving(true);
    try {
      const saveRes = await fetch(`/admin/api/vehicles/${vehicle!.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...buildPayload(), status: 'DRAFT' }) });
      const saveJson = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveJson.error ?? 'Değişiklikler kaydedilemedi.');
      const publishRes = await fetch(`/admin/api/vehicles/${vehicle!.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'publish' }) });
      const publishJson = await publishRes.json();
      if (!publishRes.ok) throw new Error(publishJson.error ?? 'Yayınlama başarısız.');
      savedRef.current = true;
      router.push('/admin/araclar');
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Yayınlama başarısız.');
    } finally { setSaving(false); }
  }

  async function runAction(action: 'approve' | 'publish' | 'archive') {
    setError('');
    setActionLoading(action);
    try {
      const res = await fetch(`/admin/api/vehicles/${vehicle!.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Bir hata oluştu.'); return; }
      savedRef.current = true;
      router.push('/admin/araclar');
      router.refresh();
    } catch {
      setError('Sunucu hatası.');
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteVehicle() {
    if (!isEdit) return;
    setActionLoading('delete');
    try {
      const res = await fetch(`/admin/api/vehicles/${vehicle!.id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Silme başarısız.');
      savedRef.current = true;
      router.push('/admin/araclar');
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Silme başarısız.'); }
    finally { setActionLoading(null); }
  }

  const currentStatus = vehicle?.status as ContentStatus | undefined;
  const canPublish = isEdit && (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN');
  const showArchiveBtn = isEdit && currentStatus !== 'ARCHIVED';
  const isApprovedOrPublished =
    currentStatus === 'APPROVED' || currentStatus === 'PUBLISHED' || currentStatus === 'SCHEDULED';

  return (
    <div style={{ maxWidth: '800px' }}>
      {/* Approval-reset warning */}
      {isApprovedOrPublished && (
        <div
          style={{
            background: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.25)',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#fbbf24',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            marginBottom: '20px',
          }}
        >
          ⚠️ Bu araç <strong>{STATUS_LABELS[currentStatus!]}</strong> durumunda. Kaydetmeniz
          durumu <strong>İnceleme</strong>&apos;ye döndürecektir. Değişiklikler yeniden onay gerektirir.
        </div>
      )}

      {error && <ErrorBanner msg={error} />}

      {/* ── Temel Bilgiler ─────────────────────────────── */}
      <SectionTitle>Temel Bilgiler</SectionTitle>

      <div style={{ marginBottom: '16px' }}>
        <Label required>Araç Adı</Label>
        <Input value={form.name} onChange={handleNameChange} placeholder="ör. Mercedes-Benz E-Serisi" />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Label required>Slug</Label>
        <Input
          value={form.slug}
          onChange={handleSlugChange}
          placeholder="ör. mercedes-benz-e-serisi"
        />
        <p style={{ color: '#555', fontSize: '11px', fontFamily: 'Inter, sans-serif', marginTop: '4px' }}>
          Yalnızca küçük harf, rakam ve tire. URL&apos;de kullanılır.
        </p>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Label>Araç Tipi</Label>
        <VehicleTypeSelect value={form.vehicleType} onChange={handleVehicleTypeChange} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <Label>Yolcu Kapasitesi</Label>
          <Input
            type="number"
            value={form.passengerCapacity}
            onChange={(v) => setForm((f) => ({ ...f, passengerCapacity: v }))}
            placeholder="ör. 4"
          />
        </div>
        <div>
          <Label>Bagaj Kapasitesi</Label>
          <Input
            type="number"
            value={form.luggageCapacity}
            onChange={(v) => setForm((f) => ({ ...f, luggageCapacity: v }))}
            placeholder="ör. 2"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              color: '#172B3A',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              style={{ accentColor: GOLD, width: '14px', height: '14px' }}
            />
            Aktif araç
          </label>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Label>Kısa Açıklama</Label>
        <Textarea
          value={form.shortDescription}
          onChange={(v) => setForm((f) => ({ ...f, shortDescription: v }))}
          placeholder="Araç hakkında kısa bir açıklama"
          rows={2}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Label>Tam Açıklama</Label>
        <Textarea
          value={form.fullDescription}
          onChange={(v) => setForm((f) => ({ ...f, fullDescription: v }))}
          placeholder="Araç hakkında detaylı açıklama"
          rows={6}
        />
      </div>

      {/* ── Fiyat Hesaplama ─────────────────────────────── */}
      <SectionTitle>Fiyat Hesaplama</SectionTitle>
      <div style={{ background: '#F8FAFC', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '14px 16px', marginBottom: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', cursor: 'pointer', color: '#172B3A', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
          <input
            type="checkbox"
            checked={form.priceCalculationEligible}
            onChange={(event) => setForm((current) => ({ ...current, priceCalculationEligible: event.target.checked }))}
            style={{ accentColor: '#2563EB', width: '15px', height: '15px', marginTop: '2px' }}
          />
          <span><strong>Bu araç otomatik fiyat hesaplamasına uygundur</strong><br /><span style={{ color: '#52697A', fontSize: '12px', lineHeight: 1.5 }}>Kapalıysa araç yayınlanmaya devam eder; yönetici fiyat merkezinde “teklif iste” olarak görünür.</span></span>
        </label>
      </div>
      <div style={{ marginBottom: '16px' }}>
        <Label>Geçiş Tarife Sınıfı</Label>
        <select value={form.pricingClass} onChange={(event) => setForm((current) => ({ ...current, pricingClass: event.target.value }))} style={{ width: '100%', background: BG2, border: `1px solid ${BORDER}`, borderRadius: '6px', color: '#172B3A', fontSize: '13px', fontFamily: 'Inter, sans-serif', padding: '8px 12px', outline: 'none', boxSizing: 'border-box' }}>
          <option value="automobile">Otomobil</option>
          <option value="minivan">Otomobil (eski kayıt uyumluluğu)</option>
          <option value="minibus">Minibüs</option>
          <option value="midibus">Midibüs</option>
          <option value="bus">Otobüs</option>
        </select>
        <div style={{ color: MUTED, fontSize: '11px', marginTop: '4px' }}>Bu alan yalnızca genel fiyat profilini belirler; köprü/tünel geçiş ücretlerini aşağıdaki resmî KGM sınıfı belirler.</div>
      </div>
      <div style={{ marginBottom: '16px' }}>
        <Label>Resmî Global Geçiş Sınıfı</Label>
        <div style={{ color: MUTED, fontSize: '11px', marginBottom: '10px', lineHeight: 1.5 }}>
          Bu seçim tüm geçiş noktalarında kullanılır. Araç tipi değiştirildiğinde sınıf otomatik olarak değiştirilmez; doğrulanmamış araçlarda tarife eksik kabul edilir.
        </div>
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', color: '#92400E', fontSize: '11px', lineHeight: 1.6, fontWeight: 600 }}>
          {TOLL_VEHICLE_CLASS_SELECTION_WARNING}
        </div>
        <select value={form.tollClass} onChange={(event) => setForm((current) => ({ ...current, tollClass: event.target.value }))} style={{ ...inputStyle, marginBottom: '10px' }}>
          <option value="">— Henüz doğrulanmadı —</option>
          {TOLL_VEHICLE_CLASSES.map((cls) => (
            <option key={cls} value={cls}>{TOLL_VEHICLE_CLASS_LABELS[cls]}</option>
          ))}
        </select>
        {form.tollClass && (
          <div style={{ color: MUTED, fontSize: '11px', marginBottom: '10px' }}>
            {TOLL_VEHICLE_CLASS_DESCRIPTIONS[form.tollClass as keyof typeof TOLL_VEHICLE_CLASS_DESCRIPTIONS]}
          </div>
        )}
        <Input value={form.tollClassSourceUrl} onChange={(value) => setForm((current) => ({ ...current, tollClassSourceUrl: value }))} placeholder="Resmî kaynak URL (https://...)" />
        <Textarea value={form.tollClassEvidence} onChange={(value) => setForm((current) => ({ ...current, tollClassEvidence: value }))} placeholder="Kanıt / doğrulama notu" rows={2} />
        {form.tollClass && tollPoints.some((point) => (point.bannedVehicleClasses ?? []).includes(form.tollClass)) && (
          <div style={{ color: '#D64545', fontSize: '11px', marginTop: '8px', fontWeight: 600 }}>
            Seçilen sınıf bazı geçiş noktalarında yasaklıdır; bu noktaları içeren alternatifler fiyatlandırılamaz.
          </div>
        )}
      </div>
      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', color: '#1E3A8A', fontSize: '12px', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
        Mesafe ve saatlik tahsis formülleri tek merkezden yönetilir. Bu aracın formülünü görmek veya değiştirmek için{' '}
        <Link href="/admin/fiyat-kurallari#pricing-profiles" style={{ color: '#1D4ED8', fontWeight: 700, textDecoration: 'underline' }}>
          Fiyat Kuralları → Hesaplama Formülleri
        </Link>{' '}
        bölümünü kullanın.
      </div>
      {isEdit && (
        <div style={{ marginTop: '14px', color: MUTED, fontSize: '11px', lineHeight: 1.5 }}>
          Kalıcı silme, yalnızca hiç yayınlanmamış taslak araçlarda liste ekranından yapılabilir. Fiyat teklifi kaydı gibi bağımlılıklar varsa sunucu silmeyi güvenle reddeder.
        </div>
      )}

      {/* ── Görsel ─────────────────────────────────────── */}
      <SectionTitle>Kapak Görseli</SectionTitle>

      <div style={{ marginBottom: '16px' }}>
        <ImageUploadField
          label="Kapak Görseli"
          value={form.coverImage}
          onChange={(v) => setForm((f) => ({ ...f, coverImage: v }))}
          namespace={`vehicles/${form.slug || 'yeni'}`}
          hint="JPEG, PNG, WebP, GIF veya AVIF — max 10 MB."
          altValue={form.coverImageAlt}
          onAltChange={(v) => setForm((f) => ({ ...f, coverImageAlt: v }))}
          altLabel="Kapak Görseli ALT Metni"
        />
        {form.coverImage && !form.coverImageAlt && (
          <p style={{ color: '#f87171', fontSize: '11px', fontFamily: 'Inter, sans-serif', marginTop: '4px' }}>
            Görsel eklendiğinde ALT metni zorunludur.
          </p>
        )}
      </div>

      {/* ── Özellikler ──────────────────────────────────── */}
      <SectionTitle>Araç Özellikleri</SectionTitle>
      <p style={{ color: MUTED, fontSize: '12px', fontFamily: 'Inter, sans-serif', margin: '0 0 10px' }}>
        Hiçbiri seçilmezse bu araç, panelde tanımlı ortak varsayılan listeyi kullanır
        (Araçlar sayfasındaki &quot;Varsayılan Özellikler&quot; ayarından yönetilir). Burada seçim
        yaparsanız bu araç için gerçek bir istisna tanımlarsınız ve yalnızca seçtikleriniz gösterilir.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {VEHICLE_FEATURE_CATALOG.map(({ code, label }) => {
          const checked = form.features.includes(code);
          return (
            <label
              key={code}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '7px',
                border: `1px solid ${checked ? GOLD : BORDER}`,
                background: checked ? 'rgba(201,168,76,0.1)' : BG2,
                color: TEXT,
                fontSize: '13px',
                fontFamily: 'Inter, sans-serif',
                cursor: 'pointer',
              }}
            >
              <input type="checkbox" checked={checked} onChange={() => toggleFeature(code)} />
              {label}
            </label>
          );
        })}
      </div>

      {/* ── Galeri ──────────────────────────────────────── */}
      <SectionTitle>Galeri</SectionTitle>

      {form.gallery.map((item, i) => (
        <div
          key={i}
          style={{
            background: BG2,
            border: `1px solid ${BORDER}`,
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: '#666', fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>
              Görsel {i + 1}
            </span>
            {form.gallery.length > 1 && (
              <button
                onClick={() => removeGalleryItem(i)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f87171',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Kaldır
              </button>
            )}
          </div>
          <div style={{ marginBottom: '8px' }}>
            <ImageUploadField
              label="Görsel URL veya Yolu"
              value={item.url}
              onChange={(v) => setGalleryItem(i, 'url', v)}
              namespace={`vehicles/${form.slug || 'yeni'}/galeri`}
              hint="JPEG, PNG, WebP, GIF veya AVIF — max 10 MB."
              altValue={item.alt}
              onAltChange={(v) => setGalleryItem(i, 'alt', v)}
              altLabel="ALT Metni"
            />
          </div>
        </div>
      ))}
      <button
        onClick={addGalleryItem}
        style={{
          background: 'transparent',
          border: `1px dashed ${BORDER}`,
          borderRadius: '6px',
          color: '#666',
          cursor: 'pointer',
          padding: '8px 16px',
          fontSize: '12px',
          fontFamily: 'Inter, sans-serif',
          marginTop: '4px',
        }}
      >
        + Galeri Görseli Ekle
      </button>

      {/* ── Yayın Ayarları ──────────────────────────────── */}
      <SectionTitle>Yayın Ayarları</SectionTitle>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <Label>Sıralama</Label>
          <Input
            type="number"
            value={form.displayOrder}
            onChange={(v) => setForm((f) => ({ ...f, displayOrder: v }))}
            placeholder="0"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              color: '#aaa',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
              style={{ accentColor: GOLD, width: '14px', height: '14px' }}
            />
            Öne Çıkan Araç
          </label>
        </div>
      </div>

      {/* ── SEO ─────────────────────────────────────────── */}
      <SectionTitle>SEO</SectionTitle>
      <AISeoGenerator
        context="vehicle"
        title={form.metaTitle}
        description={form.metaDescription}
        onTitleChange={(metaTitle) => setForm((f) => ({ ...f, metaTitle }))}
        onDescriptionChange={(metaDescription) => setForm((f) => ({ ...f, metaDescription }))}
      />

      <div style={{ marginBottom: '16px' }}>
        <Label>
          Meta Başlık <CharCounter value={form.metaTitle} max={60} />
        </Label>
        <Input
          value={form.metaTitle}
          onChange={(v) => setForm((f) => ({ ...f, metaTitle: v }))}
          placeholder="Arama sonuçlarında görünecek başlık"
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Label>
          Meta Açıklama <CharCounter value={form.metaDescription} max={160} />
        </Label>
        <Textarea
          value={form.metaDescription}
          onChange={(v) => setForm((f) => ({ ...f, metaDescription: v }))}
          placeholder="Arama sonuçlarında görünecek açıklama"
          rows={2}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Label>Kanonik URL</Label>
        <Input
          value={form.canonicalUrl}
          onChange={(v) => setForm((f) => ({ ...f, canonicalUrl: v }))}
          placeholder="https://..."
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <ImageUploadField
          label="OG / Sosyal Medya Görseli"
          value={form.ogImage}
          onChange={(v) => setForm((f) => ({ ...f, ogImage: v }))}
          namespace={`vehicles/${form.slug || 'yeni'}`}
          hint="Sosyal paylaşımlarda görünen görsel — 1200×630 piksel önerilir."
        />
      </div>

      <div style={{ display: 'flex', gap: '24px', marginBottom: '16px' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            color: '#aaa',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <input
            type="checkbox"
            checked={form.robotsIndex}
            onChange={(e) => setForm((f) => ({ ...f, robotsIndex: e.target.checked }))}
            style={{ accentColor: GOLD, width: '14px', height: '14px' }}
          />
          Robots Index
        </label>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            color: '#aaa',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <input
            type="checkbox"
            checked={form.robotsFollow}
            onChange={(e) => setForm((f) => ({ ...f, robotsFollow: e.target.checked }))}
            style={{ accentColor: GOLD, width: '14px', height: '14px' }}
          />
          Robots Follow
        </label>
      </div>

      {/* ── Durum (edit mode) ────────────────────────────── */}
      {isEdit && currentStatus && (
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#666', fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
            Mevcut durum:
          </span>
          <StatusBadge status={currentStatus} size="sm" />
        </div>
      )}

      {/* ── Buttons ─────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          marginTop: '32px',
          paddingTop: '20px',
          borderTop: `1px solid ${BORDER}`,
        }}
      >
        <ActionButton variant="ghost" onClick={() => router.push('/admin/araclar')} disabled={saving}>
          İptal Et
        </ActionButton>

        <ActionButton
          variant="secondary"
          onClick={() => handleSave('DRAFT')}
          loading={saving}
          disabled={!!actionLoading}
        >
          {saving ? 'Kaydediliyor...' : 'Taslağa Kaydet'}
        </ActionButton>

        <ActionButton
          variant="primary"
          onClick={() => handlePublish()}
          loading={saving}
          disabled={!!actionLoading}
        >
          Yayınla
        </ActionButton>

        {/* Archive */}
        {showArchiveBtn && (
          <ActionButton
            variant="danger"
            onClick={() =>
              setConfirm({
                title: 'Aracı Arşivle',
                message:
                  'Bu araç arşivlenecek ve listeden kaldırılacaktır. Arşivlenen araçlar kalıcı olarak silinmez ve daha sonra geri alınabilir.',
                confirmLabel: 'Arşivle',
                danger: true,
                onConfirm: () => { setConfirm(null); runAction('archive'); },
              })
            }
            loading={actionLoading === 'archive'}
            disabled={saving}
          >
            Arşivle
          </ActionButton>
        )}
        {isEdit && (
          <ActionButton variant="danger" onClick={() => setConfirm({ title: 'Aracı Sil', message: 'Bu işlem geri alınamaz. Backend güvenlik kontrolleri uygulanacaktır.', confirmLabel: 'Sil', danger: true, onConfirm: () => { setConfirm(null); deleteVehicle(); } })} loading={actionLoading === 'delete'} disabled={saving}>
            Sil
          </ActionButton>
        )}
      </div>

      {/* Confirmation dialog */}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
