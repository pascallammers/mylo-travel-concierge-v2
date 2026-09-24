'use client';

import { Plane } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { Link, usePathname } from '@/i18n/navigation';
import { SHELL_AREAS, findActiveArea, type AreaGroup } from '@/lib/shell';
import { cn } from '@/lib/utils';
import type { RailWertzahl as RailWertzahlData } from '@/lib/valuation/wertzahl-loader';
import { RailWertzahl } from './rail-wertzahl';
import { AreaBadges, AreaIcon } from './area-badges';
import { ShellFooter } from './shell-footer';
import { useShellSettings } from './shell-settings';

const AREA_GROUPS: readonly AreaGroup[] = ['categories', 'assistant'];

/**
 * Render the category rail with the shared account controls.
 * @param props - Server-loaded Wertzahl promise and optional sidebar styling.
 * @returns The shell navigation inside the existing sidebar primitive.
 */
export function ShellRail({ className, wertzahl }: { className?: string; wertzahl: Promise<RailWertzahlData> }) {
  const t = useTranslations();
  const pathname = usePathname();
  const activeArea = findActiveArea(pathname);
  const { isMobile } = useSidebar();
  const settings = useShellSettings();

  if (isMobile) return null;

  return (
    <Sidebar className={cn('bg-background [&_[data-slot=sidebar-inner]]:bg-muted/30', className)}>
      <SidebarHeader className="gap-0 p-0">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <div className="flex size-7 items-center justify-center rounded-lg bg-foreground text-background">
            <Plane className="size-3.5" aria-hidden="true" />
          </div>
          <span className="font-bold tracking-tight">FlyMylo</span>
        </div>
        <div className="border-b p-4">
          <RailWertzahl wertzahl={wertzahl} onShowBreakdown={() => settings.open('loyalty')} />
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 p-2">
        <nav aria-label={t('shell.navigation')}>
          {AREA_GROUPS.map((group) => (
            <div key={group}>
              {group === 'assistant' && <SidebarSeparator className="mx-0 my-2 bg-border" />}
              <SidebarMenu className="gap-0.5">
                {SHELL_AREAS.filter((area) => area.group === group).map((area) => {
                  const isActive = activeArea?.slug === area.slug;
                  const isPreview = area.state === 'preview';

                  return (
                    <SidebarMenuItem key={area.slug}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className={cn(
                          'h-auto gap-3 rounded-lg px-3 py-2 font-medium hover:bg-background/60',
                          'data-[active=true]:bg-background data-[active=true]:text-foreground',
                          isActive ? 'shadow-sm' : isPreview ? 'text-muted-foreground/60' : 'text-muted-foreground',
                        )}
                      >
                        <Link href={area.href} aria-current={isActive ? 'page' : undefined}>
                          <AreaIcon area={area} />
                          <span className="min-w-0 flex-1 truncate">{t(area.titleKey)}</span>
                          <AreaBadges area={area} />
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </div>
          ))}
        </nav>
      </SidebarContent>

      <SidebarFooter className="border-t p-3">
        <ShellFooter layoutGroupId="shell-rail-theme" />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
