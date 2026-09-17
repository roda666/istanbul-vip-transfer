'use client';

import type { ReactNode } from 'react';
import { AdminCmsLanguageBadges } from './AdminCmsLanguageBadges';

export function AdminCmsRecordCard({
  title,
  description,
  status,
  languageStatuses,
  children,
  className,
  ...rest
}: {
  title: string;
  description?: ReactNode;
  status?: ReactNode;
  languageStatuses?: Record<string, unknown> | null;
  children: ReactNode;
  className?: string;
  'data-testid'?: string;
  'data-service-id'?: string;
}) {
  return (
    <article data-admin-record-card="true" {...rest} className={`min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm${className ? ` ${className}` : ''}`}>
      <div className="min-w-0 space-y-2 p-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-sm font-semibold text-slate-900">{title}</h3>
            {description && <div className="mt-1 break-words text-xs text-slate-500">{description}</div>}
          </div>
          {status}
        </div>
        {languageStatuses && <AdminCmsLanguageBadges statuses={languageStatuses} />}
      </div>
      <div data-admin-record-actions-row="true" className="flex min-w-0 flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/70 p-3 [&_a]:min-h-11 [&_button]:min-h-11">
        {children}
      </div>
    </article>
  );
}