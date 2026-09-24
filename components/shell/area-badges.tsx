'use client';

import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { ShellArea } from '@/lib/shell';

/**
 * Choose the area icon or its preview lock consistently across navigation surfaces.
 * @param props - Registered area and optional icon sizing.
 * @returns A decorative area icon.
 */
export function AreaIcon({ area, className = 'size-4' }: { area: ShellArea; className?: string }) {
  const Icon = area.state === 'preview' ? Lock : area.icon;
  return <Icon className={className} aria-hidden="true" />;
}

/**
 * Describe an area's preview, beta and quota status consistently.
 * @param props - Registered area whose badges should be displayed.
 * @returns Accessible lock text and the applicable badges.
 */
export function AreaBadges({ area }: { area: ShellArea }) {
  const t = useTranslations('shell');
  return (
    <>
      {area.state === 'preview' && <span className="sr-only">{t('locked')}</span>}
      {area.state === 'beta' && (
        <Badge className="rounded border-0 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700 dark:text-amber-400">
          {t('beta')}
        </Badge>
      )}
      {area.counter && (
        <Badge variant="outline" className="rounded px-1.5 py-0.5 text-[10px] font-bold text-inherit tabular-nums">
          {area.counter}
        </Badge>
      )}
    </>
  );
}
