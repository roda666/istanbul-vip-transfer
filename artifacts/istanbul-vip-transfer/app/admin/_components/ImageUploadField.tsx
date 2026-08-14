'use client';

/**
 * Shared image upload widget for admin editors.
 *
 * Provides:
 *  - URL text input (paste any link)
 *  - "Dosya Yükle" button → presigned PUT to object storage
 *  - Live thumbnail preview
 *  - Optional inline ALT text field
 *
 * Usage:
 *   <ImageUploadField
 *     label="Hero Görseli"
 *     value={heroImage}
 *     onChange={setHeroImage}
 *     namespace="pages/hakkimizda"   // storage path prefix
 *     altValue={heroImageAlt}
 *     onAltChange={setHeroImageAlt}
 *   />
 */

import { useState, useRef } from 'react';
import Image from 'next/image';

interface ImageUploadFieldProps {
  /** Field label shown above the control. Omit when wrapping in an external label. */
  label?: string;
  /** Current URL/path value. */
  value: string;
  /** Called when value changes (upload or manual input). */
  onChange: (v: string) => void;
  /**
   * Storage path prefix for uploads.
   * e.g. "pages/hakkimizda", "blog/istanbul-rehberi", "vehicles/vito",
   *      "homepage", "uploads"
   * Defaults to "uploads".
   */
  namespace?: string;
  /** Small hint shown below the input. */
  hint?: string;
  /** When true, shows read-only input with no upload button. */
  readOnly?: boolean;
  /** Optional inline ALT text value. */
  altValue?: string;
  /** Called when ALT text changes. */
  onAltChange?: (v: string) => void;
  /** Label for the ALT text sub-field. Defaults to "ALT Metni". */
  altLabel?: string;
}

const baseLabel: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#374151',
  fontFamily: 'Inter, sans-serif',
  marginBottom: '4px',
  display: 'block',
};

const baseInput = (readOnly?: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #D1D5DB',
  borderRadius: '6px',
  fontSize: '13px',
  fontFamily: 'Inter, sans-serif',
  color: '#1E293B',
  background: readOnly ? '#F8FAFC' : '#FFFFFF',
  boxSizing: 'border-box',
  opacity: readOnly ? 0.7 : 1,
});

export function ImageUploadField({
  label,
  value,
  onChange,
  namespace = 'uploads',
  hint,
  readOnly,
  altValue,
  onAltChange,
  altLabel,
}: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const metaRes = await fetch('/admin/api/storage/request-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || 'image/jpeg',
          namespace,
        }),
      });
      if (!metaRes.ok) {
        const err = await metaRes.json().catch(() => ({ error: 'Sunucu hatası' }));
        throw new Error((err as { error?: string }).error ?? 'Yükleme URL alınamadı');
      }
      const { uploadURL, serveUrl, contentType } = (await metaRes.json()) as {
        uploadURL: string; serveUrl: string; contentType: string;
      };
      const putRes = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': contentType || file.type || 'image/jpeg' },
      });
      if (!putRes.ok) throw new Error('Depolamaya yükleme başarısız');
      onChange(serveUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const hasPreview = value && (value.startsWith('/') || value.startsWith('http'));

  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={baseLabel}>{label}</label>

      {readOnly ? (
        <input style={baseInput(true)} value={value} readOnly />
      ) : (
        <>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch' }}>
            {/* URL / link input */}
            <input
              style={{ ...baseInput(), flex: 1 }}
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder="URL yapıştırın veya aşağıdan dosya yükleyin…"
            />
            {/* Upload button */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="Bilgisayarınızdan görsel yükleyin (JPEG, PNG, WebP, GIF, AVIF — max 10 MB)"
              style={{
                border: '1px solid #D1D5DB',
                background: uploading ? '#F1F5F9' : '#EFF6FF',
                color: uploading ? '#94A3B8' : '#1D4ED8',
                borderRadius: '6px',
                padding: '0 14px',
                cursor: uploading ? 'default' : 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              {uploading ? '⏳ Yükleniyor…' : '⬆ Dosya Yükle'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              style={{ display: 'none' }}
              onChange={handleFile}
            />
          </div>

          {uploadError && (
            <p style={{
              fontSize: '11px', color: '#DC2626', marginTop: '4px',
              fontFamily: 'Inter, sans-serif',
            }}>
              ⚠ {uploadError}
            </p>
          )}
        </>
      )}

      {hint && (
        <p style={{
          fontSize: '11px', color: '#94A3B8', marginTop: '3px',
          fontFamily: 'Inter, sans-serif',
        }}>
          {hint}
        </p>
      )}

      {/* Live thumbnail preview */}
      {hasPreview && (
        <div style={{
          marginTop: '8px',
          width: '180px',
          height: '100px',
          position: 'relative',
          borderRadius: '6px',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          background: '#F8FAFC',
        }}>
          <Image
            src={value}
            alt="Önizleme"
            fill
            sizes="180px"
            style={{ objectFit: 'cover' }}
            unoptimized
          />
        </div>
      )}

      {/* Optional inline ALT text sub-field */}
      {altValue !== undefined && onAltChange && (
        <div style={{ marginTop: '8px' }}>
          <label style={{ ...baseLabel, fontSize: '11px', color: '#6B7280' }}>
            {altLabel ?? 'ALT Metni'}
          </label>
          <input
            style={{ ...baseInput(readOnly), fontSize: '12px' }}
            value={altValue}
            onChange={e => onAltChange(e.target.value)}
            placeholder="Görseli tanımlayan metin (SEO ve erişilebilirlik için önemli)"
            readOnly={readOnly}
          />
        </div>
      )}
    </div>
  );
}
