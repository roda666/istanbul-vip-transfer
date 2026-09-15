'use client';

import Link from 'next/link';
import type { CSSProperties, ElementType, MouseEventHandler, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { getAdminSectionForPath } from '@/lib/auth/authorization';
import { useOptionalAdminCapabilities } from './AdminCapabilityContext';

export type AdminActionVariant =
  | 'new'
  | 'edit'
  | 'save'
  | 'activate'
  | 'deactivate'
  | 'archive'
  | 'delete'
  | 'cancel'
  | 'subtle';

type Icon = ElementType;

export interface AdminActionButtonProps {
  label: string;
  icon?: Icon;
  variant?: AdminActionVariant;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  href?: string;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
  ariaLabel?: string;
  manage?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  style?: CSSProperties;
  testId?: string;
  children?: ReactNode;
}

const variantClasses: Record<AdminActionVariant, string> = {
  new: 'border border-blue-600 bg-blue-600 text-white hover:bg-blue-700',
  edit: 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
  save: 'border border-blue-800 bg-blue-800 text-white hover:bg-blue-900',
  activate: 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  deactivate: 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
  archive: 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
  delete: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
  cancel: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  subtle: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
};

/**
 * The canonical action control for the admin area. Keeping the minimum hit
 * target and responsive treatment here prevents screen-local action styles
 * from drifting apart.
 */
export function AdminActionButton({
  label,
  icon: Icon,
  variant = 'subtle',
  onClick,
  href,
  disabled = false,
  loading = false,
  title,
  ariaLabel,
  manage = true,
  type = 'button',
  className = '',
  style,
  testId,
  children,
}: AdminActionButtonProps) {
  const pathname = usePathname();
  const capabilities = useOptionalAdminCapabilities();
  const section = pathname ? getAdminSectionForPath(pathname) : undefined;
  if (manage && capabilities && section && !capabilities[section].canManage) return null;
  const unavailable = disabled || loading;
  const classes = [
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold',
    'whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
    'disabled:cursor-not-allowed disabled:opacity-50 max-[480px]:max-w-full max-[480px]:flex-1',
    unavailable ? 'cursor-not-allowed opacity-50' : '',
    variantClasses[variant],
    className,
  ].filter(Boolean).join(' ');
  const content = (
    <>
      {loading ? <Loader2 size={16} className="shrink-0 animate-spin" aria-hidden={true} /> : Icon ? <Icon size={16} className="shrink-0" aria-hidden={true} /> : null}
      <span>{children ?? label}</span>
    </>
  );
  const common = {
    title: title ?? label,
    'aria-label': ariaLabel ?? label,
    'aria-busy': loading || undefined,
    'data-admin-action': manage ? 'manage' : undefined,
    className: classes,
    style,
    'data-testid': testId,
  };

  if (href && !unavailable) {
    return <Link href={href} {...common}>{content}</Link>;
  }
  if (href) {
    return <span {...common} aria-disabled="true">{content}</span>;
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={unavailable}
      {...common}
    >
      {content}
    </button>
  );
}
