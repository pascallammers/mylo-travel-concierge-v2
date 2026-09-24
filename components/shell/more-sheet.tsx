'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useSidebar } from '@/components/ui/sidebar';
import { Link, usePathname } from '@/i18n/navigation';
import { findActiveArea, mobileMoreAreas } from '@/lib/shell';
import { cn } from '@/lib/utils';
import { AreaBadges, AreaIcon } from './area-badges';
import { ShellFooter } from './shell-footer';

/**
 * Show secondary destinations and account controls in a full-height mobile sheet.
 * @param props - The bottom bar's accessible sheet trigger.
 * @returns A sheet that closes when navigating or opening the shared settings dialog.
 */
export function MoreSheet({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const activeArea = findActiveArea(usePathname());
  const { isMobile } = useSidebar();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) setOpen(false);
  }, [isMobile]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="bottom"
        aria-describedby={undefined}
        className="h-dvh gap-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] [&>button]:top-[max(1rem,env(safe-area-inset-top))] [&>button]:flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center"
      >
        <SheetHeader className="shrink-0 border-b py-6 pr-16">
          <SheetTitle>{t('shell.moreTitle')}</SheetTitle>
        </SheetHeader>
        <nav aria-label={t('shell.navigation')} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {mobileMoreAreas().map((area) => {
            const isActive = activeArea?.slug === area.slug;
            return (
              <SheetClose key={area.slug} asChild>
                <Button
                  asChild
                  variant="ghost"
                  className={cn('h-auto min-h-14 w-full justify-start gap-3 px-3 py-4', isActive && 'bg-muted')}
                >
                  <Link href={area.href} aria-current={isActive ? 'page' : undefined}>
                    <AreaIcon area={area} className="size-5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-left">{t(area.titleKey)}</span>
                    <AreaBadges area={area} />
                  </Link>
                </Button>
              </SheetClose>
            );
          })}
        </nav>
        <div className="shrink-0 border-t p-3">
          <ShellFooter layoutGroupId="shell-more-theme" onOpenSettings={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
