'use client';

import { useState } from 'react';
import { CheckCircle2, DatabaseBackup, Download, Loader2 } from 'lucide-react';

type BackupMetadata = {
  format: string;
  extension: string;
  checksumAlgorithm: string;
  verification: string;
};

function downloadFile(content: BlobPart, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export default function DatabaseBackupClient() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ checksum: string; fileName: string } | null>(null);

  async function downloadBackup() {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const metadataResponse = await fetch('/admin/api/database-backup?metadata=1', { cache: 'no-store' });
      if (!metadataResponse.ok) throw new Error('metadata');
      const metadata = await metadataResponse.json() as BackupMetadata;
      if (metadata.checksumAlgorithm !== 'SHA-256' || metadata.format !== 'postgresql-custom') {
        throw new Error('metadata');
      }

      const response = await fetch('/admin/api/database-backup', { cache: 'no-store' });
      if (!response.ok) throw new Error('backup');
      const buffer = await response.arrayBuffer();
      const checksum = toHex(await crypto.subtle.digest('SHA-256', buffer));
      const generatedAt = response.headers.get('X-Backup-Generated-At') ?? new Date().toISOString();
      const fileName = `istanbul-vip-transfer-${generatedAt.replace(/[:.]/g, '-')}${metadata.extension}`;
      const manifest = [
        `SHA256 (${fileName}) = ${checksum}`,
        `format=${metadata.format}`,
        `generatedAt=${generatedAt}`,
        `verification=${metadata.verification}`,
        '',
      ].join('\n');

      downloadFile(buffer, fileName, 'application/octet-stream');
      downloadFile(manifest, `${fileName}.sha256.txt`, 'text/plain;charset=utf-8');
      setResult({ checksum, fileName });
    } catch {
      setError('Yedek indirilemedi veya doğrulama bilgisi oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={downloadBackup}
        disabled={busy}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: busy ? '#93C5FD' : '#2563EB', color: '#FFFFFF', border: 0, textDecoration: 'none', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}
      >
        {busy ? <Loader2 size={16} /> : <DatabaseBackup size={16} />}
        {busy ? 'Yedek hazırlanıyor…' : 'Yedeği indir ve doğrula'}
      </button>
      {error && <p role="alert" style={{ margin: '12px 0 0', color: '#B91C1C', fontSize: '13px' }}>{error}</p>}
      {result && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '14px', color: '#166534', fontSize: '12px', lineHeight: 1.5 }}>
          <CheckCircle2 size={17} style={{ flex: '0 0 auto', marginTop: '1px' }} />
          <div>
            <strong>Doğrulama manifesti oluşturuldu.</strong> <code>{result.fileName}.sha256.txt</code> dosyasını yedekle birlikte saklayın.
            <br />SHA-256: <code style={{ overflowWrap: 'anywhere' }}>{result.checksum}</code>
          </div>
        </div>
      )}
      <p style={{ display: 'flex', gap: '6px', alignItems: 'center', margin: '12px 0 0', color: '#52697A', fontSize: '12px', lineHeight: 1.5 }}>
        <Download size={14} /> Yedek ve SHA-256 manifesti yalnızca bu tarayıcıya indirilir; sunucuda saklanmaz.
      </p>
    </>
  );
}