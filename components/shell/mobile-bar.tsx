'use client';

import { Ellipsis } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link, usePathname } from '@/i18n/navigation';
import { findActiveArea, mobileBarAreas } from '@/lib/shell';
import { cn } from '@/lib/utils';
import { MoreSheet } from './more-sheet';

const SLOT_CLASS = 'h-14 min-w-0 flex-col gap-1 rounded-none px-1 py-2 text-[11px] font-medium';

/**
 * Render the three registered primary destinations and the More sheet opener.
 * @param - No props; the active route and shell registry supply navigation state.
 * @returns A four-slot bottom bar with room for the device's home indicator.
 */
export function MobileBar() {
  const t = useTranslations();
  const activeArea = findActiveArea(usePathname());

  return (
    <nav
      aria-label={t('shell.navigation')}
      className="fixed inset-x-0 bottom-0 z-30 grid h-[calc(3.5rem+env(safe-area-inset-bottom))] grid-cols-4 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {mobileBarAreas().map((area) => {
        const isActive = activeArea?.slug === area.slug;
        const Icon = area.icon;
        return (
          <Button key={area.slug} asChild variant="ghost" className={cn(SLOT_CLASS, isActive ? 'bg-muted text-foreground' : 'text-muted-foreground')}>
            <Link href={area.href} aria-current={isActive ? 'page' : undefined}>
              <Icon className="size-5" aria-hidden="true" />
              <span>{t(area.titleKey)}</span>
            </Link>
          </Button>
        );
      })}
      <MoreSheet>
        <Button
          variant="ghost"
          className={cn(SLOT_CLASS, activeArea?.mobile === 'more' ? 'bg-muted text-foreground' : 'text-muted-foreground')}
          aria-current={activeArea?.mobile === 'more' ? 'page' : undefined}
        >
          <Ellipsis className="size-5" aria-hidden="true" />
          <span>{t('shell.more')}</span>
        </Button>
      </MoreSheet>
    </nav>
  );
}
