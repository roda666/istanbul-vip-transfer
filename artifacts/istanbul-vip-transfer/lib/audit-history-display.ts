const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Giriş yaptı',
  LOGOUT: 'Çıkış yaptı',
  CREATE: 'Oluşturdu',
  UPDATE: 'Güncelledi',
  DELETE: 'Sildi',
  APPROVE: 'Onayladı',
  PUBLISH: 'Yayınladı',
  ARCHIVE: 'Arşivledi',
  CANCEL: 'İptal etti',
  QUOTE_RESPONSE: 'Teklif yanıtladı',
  'translation.ai_complete': 'Çeviriyi tamamladı',
  'blog.publish_all_languages': 'Blogu tüm dillerde yayınladı',
};

/** Shows only deliberately allowlisted, human-readable audit metadata. */
export function getAuditRecordLabel(entityId: string | null, metadata: unknown): string {
  const id = typeof entityId === 'string' && entityId.trim() ? entityId.trim() : '';
  const record = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {};
  const labelKey = ['title', 'name', 'label', 'key', 'slug'].find((key) =>
    typeof record[key] === 'string' && record[key].trim().length > 0,
  );
  const label = labelKey ? String(record[labelKey]).trim().slice(0, 120) : '';
  if (!id && !label) return '—';
  const shortId = id.length > 32 ? `${id.slice(0, 32)}…` : id;
  return label && id ? `${label} · ${shortId}` : label || shortId;
}

export function getAuditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replaceAll('_', ' ').toLowerCase();
}