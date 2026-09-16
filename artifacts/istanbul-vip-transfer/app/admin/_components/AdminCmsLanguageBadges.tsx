'use client';

import {
  adminCmsStatusLabel,
  CUSTOMER_CMS_LOCALES,
  normalizeAdminCmsLanguageStatuses,
  type AdminCmsStatus,
} from '@/lib/admin-cms-status';

const COLORS: Record<AdminCmsStatus, { background: string; color: string; border: string }> = {
  current: { background: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  translated: { background: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  published: { background: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  translating: { background: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
  draft: { background: '#F8FAFC', color: '#64748B', border: '#E2E8F0' },
  outdated: { background: '#FFF7ED', color: '#C2410C', border: '#FDBA74' },
  failed: { background: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
};

export function AdminCmsLanguageBadges({ statuses }: { statuses?: Record<string, unknown> | null }) {
  const normalized = normalizeAdminCmsLanguageStatuses(statuses);
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5" aria-label="Dil durumları">
      {CUSTOMER_CMS_LOCALES.map(locale => {
        const status = normalized[locale];
        const colors = COLORS[status];
        return (
          <span
            key={locale}
            title={`${locale.toUpperCase()}: ${adminCmsStatusLabel(status)}`}
            className="inline-flex min-h-6 items-center rounded border px-1.5 text-[10px] font-bold"
            style={colors}
          >
            {locale.toUpperCase()}
          </span>
        );
      })}
    </div>
  );
}