'use client';

import { useState, useRef, useEffect, Fragment, useId } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, ChevronDown, Edit2, Power, PowerOff, Archive, ArchiveRestore, Trash2, MoreVertical, Info, X } from 'lucide-react';
import { AdminActionButton } from './AdminActionButton';

export const ADMIN_RECORD_ACTION_ORDER = ['up', 'down', 'edit', 'activation', 'archive', 'custom', 'delete'] as const;

interface ActionConfig {
  onClick?: () => Promise<void> | void;
  disabled?: boolean;
  disabledReason?: string;
  hidden?: boolean;
  confirmMessage?: string;
}

export interface AdminRecordActionsProps {
  up?: ActionConfig;
  down?: ActionConfig;
  edit?: ActionConfig & { href?: string };
  activation?: ActionConfig & { isActive: boolean };
  archive?: ActionConfig & { isArchived: boolean; onRestore?: () => Promise<void> | void };
  delete?: ActionConfig;
  deleteOmittedReason?: string;
  customActions?: Array<{
    id: string;
    label: string;
    icon: React.ElementType;
    colorClass: string;
    mobileColorClass?: string;
    onClick?: () => Promise<void> | void;
    disabled?: boolean;
    disabledReason?: string;
    hidden?: boolean;
  }>;
}

export function AdminRecordActions({
  up,
  down,
  edit,
  activation,
  archive,
  delete: del,
  deleteOmittedReason,
  customActions,
}: AdminRecordActionsProps) {
  const dialogId = useId();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeSheet = () => {
    setSheetOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;
    
    const previousOverflow = document.body.style.overflow;
    
    function handleClickOutside(event: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(event.target as Node)) {
        closeSheet();
      }
    }
    
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeSheet();
      } else if (event.key === 'Tab' && sheetRef.current) {
        const focusableElements = sheetRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement?.focus();
          }
        }
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    
    // Focus first element
    const firstButton = sheetRef.current?.querySelector('button:not([disabled]), a:not([aria-disabled="true"])') as HTMLElement;
    if (firstButton) {
      firstButton.focus();
    }
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [sheetOpen]);

  const wrapAction = (name: string, fn?: () => Promise<void> | void) => async () => {
    if (!fn || busyAction) return;
    setBusyAction(name);
    try {
      await fn();
    } finally {
      setBusyAction(null);
      closeSheet();
    }
  };

  const actions = [
    {
      id: 'up',
      config: up,
      label: 'Yukarı',
      icon: ChevronUp,
      colorClass: 'text-slate-700 bg-white border border-slate-200 hover:bg-slate-50',
    },
    {
      id: 'down',
      config: down,
      label: 'Aşağı',
      icon: ChevronDown,
      colorClass: 'text-slate-700 bg-white border border-slate-200 hover:bg-slate-50',
    },
    {
      id: 'edit',
      config: edit,
      label: 'Düzenle',
      icon: Edit2,
      colorClass: 'text-blue-700 bg-blue-50 border border-blue-100 hover:bg-blue-100',
    },
    {
      id: 'activation',
      config: activation,
      label: activation?.isActive ? 'Pasifleştir' : 'Aktifleştir',
      icon: activation?.isActive ? PowerOff : Power,
      colorClass: activation?.isActive 
        ? 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100'
        : 'text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100',
    },
    {
      id: 'archive',
      config: archive,
      label: archive?.isArchived ? 'Arşivden Çıkar' : 'Arşivle',
      icon: archive?.isArchived ? ArchiveRestore : Archive,
      colorClass: archive?.isArchived
        ? 'text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100'
        : 'text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100',
    },
    {
      id: 'delete',
      config: del,
      label: 'Sil',
      icon: Trash2,
      colorClass: 'text-red-700 bg-red-50 border border-red-200 hover:bg-red-100',
    }
  ];

  const standardActions = actions.filter(a => a.id !== 'delete' && a.config && !a.config.hidden);
  const deleteAction = actions.find(a => a.id === 'delete');
  const visibleActions = [
    ...standardActions,
    ...(customActions || []).filter(a => !a.hidden).map(a => ({
      ...a,
      config: { onClick: a.onClick, disabled: a.disabled, disabledReason: a.disabledReason }
    })),
    ...(deleteAction?.config && !deleteAction.config.hidden ? [deleteAction] : []),
  ];

  const renderButton = (action: {
    id: string;
    config?: ActionConfig;
    label: string;
    icon: React.ElementType;
    colorClass: string;
    mobileColorClass?: string;
  }, isMobile: boolean) => {
    const isBusy = busyAction === action.id;
    const isDisabled = action.config?.disabled || !!busyAction;
    const title = action.config?.disabled && action.config.disabledReason
      ? action.config.disabledReason
      : action.label;

    const onClick = action.id === 'archive' && archive?.isArchived
      ? archive.onRestore
      : action.config?.onClick;
    const guardedOnClick = action.id === 'delete' && action.config?.confirmMessage
      ? async () => {
          if (!window.confirm(action.config?.confirmMessage)) return;
          await onClick?.();
        }
      : onClick;

    return (
      <AdminActionButton
        label={action.label}
        icon={action.icon}
        variant={
          action.id === 'delete' ? 'delete'
            : action.id === 'edit' ? 'edit'
            : action.id === 'activation' ? (activation?.isActive ? 'deactivate' : 'activate')
            : action.id === 'archive' ? 'archive'
            : action.id === 'up' || action.id === 'down' ? 'subtle'
            : 'subtle'
        }
        href={action.id === 'edit' ? edit?.href : undefined}
         onClick={action.id === 'edit' && edit?.href ? closeSheet : wrapAction(action.id, guardedOnClick)}
        disabled={isDisabled}
        loading={isBusy}
        title={title}
        ariaLabel={action.label}
        testId={`admin-record-action-${action.id}`}
        className={isMobile ? 'w-full justify-start rounded-none border-0 bg-transparent px-4 py-3 text-left hover:bg-slate-50' : ''}
      />
    );
  };

  return (
    <div
      className="flex items-center justify-end gap-2"
      data-admin
      data-admin-record-actions
      data-admin-action-order={visibleActions.map(action => action.id).join(',')}
    >
      {/* Desktop/Tablet row */}
      <div className="hidden min-[481px]:flex flex-wrap items-center justify-end gap-2" data-admin-actions-desktop>
        {deleteOmittedReason && (!del || del.hidden) && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2.5 min-h-[44px] rounded-md" title={deleteOmittedReason}>
            <Info size={14} />
            <span className="max-w-[120px] truncate">{deleteOmittedReason}</span>
          </div>
        )}
        {visibleActions.map(action => (
          <Fragment key={action.id}>
            {renderButton(action, false)}
          </Fragment>
        ))}
      </div>

      {/* Mobile Sheet Trigger */}
      <div className="max-[480px]:block min-[481px]:hidden relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setSheetOpen(true)}
          className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-md bg-white border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50"
          aria-expanded={sheetOpen}
          aria-haspopup="dialog"
          data-admin-actions-mobile-trigger
        >
          <MoreVertical size={16} />
          İşlemler
        </button>
      </div>

      {/* Mobile Bottom Sheet Portal */}
      {mounted && sheetOpen && createPortal(
        <div className="fixed inset-0 z-[200] flex flex-col justify-end" aria-modal="true" role="dialog" aria-labelledby={dialogId}>
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={closeSheet}
            aria-hidden="true"
          />
          
          {/* Sheet */}
          <div 
            ref={sheetRef}
            className="relative bg-white rounded-t-xl shadow-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 id={dialogId} className="text-base font-bold text-slate-900">İşlemler</h3>
              <button
                type="button"
                onClick={closeSheet}
                className="p-2 -mr-2 text-slate-500 hover:bg-slate-100 rounded-full"
                aria-label="Kapat"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto pb-6" data-admin-actions-mobile-sheet>
              {deleteOmittedReason && (!del || del.hidden) && (
                <div className="flex items-start gap-2 p-4 bg-slate-50 border-b border-slate-100 text-sm text-slate-600">
                  <Info size={16} className="mt-0.5 shrink-0 text-slate-400" />
                  <p className="leading-relaxed">{deleteOmittedReason}</p>
                </div>
              )}
              <div className="flex flex-col py-2">
                {visibleActions.map(action => (
                  <div key={action.id}>
                    {renderButton(action, true)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
