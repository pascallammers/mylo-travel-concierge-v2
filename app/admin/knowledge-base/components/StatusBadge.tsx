'use client';

import { cn } from '@/lib/utils';
import { CheckCircle2, Info } from 'lucide-react';
import type { DocumentStatus } from '../hooks/useDocuments';

/**
 * Migration status types for File Search Store migration.
 * - indexed: Document has been migrated to File Search Store
 * - legacy: Document uses old Gemini Files API
 */
export type MigrationStatus = 'indexed' | 'legacy';

/**
 * Combined status type that includes both document and migration statuses.
 */
export type BadgeStatus = DocumentStatus | MigrationStatus;

/**
 * Props for the StatusBadge component.
 */
interface StatusBadgeProps {
  /** Document or migration status to display */
  status: BadgeStatus;
  /** Additional CSS classes */
  className?: string;
  /** Optional tooltip text */
  title?: string;
}

/**
 * Status configuration with colors, labels, and optional icons.
 */
const statusConfig: Record<
  BadgeStatus,
  { label: string; className: string; icon?: React.ReactNode }
> = {
  // Document statuses
  uploading: {
    label: 'Uploading',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  processing: {
    label: 'Processing',
    className:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  active: {
    label: 'Active',
    className:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
  archived: {
    label: 'Archived',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  },
  // Migration statuses
  indexed: {
    label: 'Indexed',
    className:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  legacy: {
    label: 'Legacy',
    className:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    icon: <Info className="w-3 h-3" />,
  },
};

/**
 * Default tooltips for migration statuses.
 */
const defaultTooltips: Partial<Record<BadgeStatus, string>> = {
  indexed: 'Document is indexed in File Search Store (new API)',
  legacy: 'Document uses legacy Gemini Files API',
};

/**
 * StatusBadge - Displays document or migration status with appropriate styling.
 *
 * Supports both document lifecycle statuses (uploading, processing, active, etc.)
 * and migration statuses (indexed, legacy) for the File Search Store migration.
 *
 * @param props - Component props
 * @returns Status badge element
 *
 * @example
 * ```tsx
 * <StatusBadge status="active" />
 * <StatusBadge status="indexed" title="Custom tooltip" />
 * <StatusBadge status="legacy" className="ml-2" />
 * ```
 */
export function StatusBadge({ status, className, title }: StatusBadgeProps) {
  const config = statusConfig[status];
  const tooltipText = title || defaultTooltips[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
        'transition-colors',
        config.className,
        className
      )}
      role="status"
      aria-label={`Status: ${config.label}`}
      title={tooltipText}
    >
      {config.icon}
      {config.label}
    </span>
  );
}
