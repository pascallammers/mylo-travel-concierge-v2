'use client';

import { useState, useSyncExternalStore } from 'react';
import { Lock, Plane } from 'lucide-react';
import { LayoutGroup } from 'motion/react';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { NavigationMenu, UserProfile } from '@/components/user-profile';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/sidebar';
import { useUser } from '@/contexts/user-context';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { Link, usePathname } from '@/i18n/navigation';
import { SHELL_AREAS, findActiveArea, type AreaGroup } from '@/lib/shell';
import { cn } from '@/lib/utils';
import type { RailWertzahl as RailWertzahlData } from '@/lib/valuation/wertzahl-loader';
import { RailWertzahl } from './rail-wertzahl';

const AREA_GROUPS: readonly AreaGroup[] = ['categories', 'assistant'];

const subscribeToNothing = () => () => {};

/**
 * Report whether the component renders in the browser after hydration.
 * @returns False during SSR and hydration, true afterwards.
 */
function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

/**
 * Render the category rail with the shared account controls.
 * @param props - Server-loaded Wertzahl promise and optional sidebar styling.
 * @returns The shell navigation inside the existing sidebar primitive.
 */
export function ShellRail({ className, wertzahl }: { className?: string; wertzahl: Promise<RailWertzahlData> }) {
  const t = useTranslations();
  const pathname = usePathname();
  const activeArea = findActiveArea(pathname);
  const { user, subscriptionData, isProUser, isLoading } = useUser();
  const isHydrated = useIsHydrated();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState('profile');
  const handleSettingsOpenChange = (open: boolean) => {
    setSettingsOpen(open);
    if (!open) setSettingsInitialTab('profile');
  };
  const showLoyaltyBreakdown = () => {
    setSettingsInitialTab('loyalty');
    setSettingsOpen(true);
  };
  const [isCustomInstructionsEnabled, setIsCustomInstructionsEnabled] = useLocalStorage(
    'scira-custom-instructions-enabled',
    true,
  );

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
          <RailWertzahl wertzahl={wertzahl} onShowBreakdown={showLoyaltyBreakdown} />
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
                  const Icon = isPreview ? Lock : area.icon;

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
                          <Icon className="size-4" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">{t(area.titleKey)}</span>
                          {isPreview && <span className="sr-only">{t('shell.locked')}</span>}
                          {area.state === 'beta' && (
                            <Badge className="rounded border-0 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700 dark:text-amber-400">
                              {t('shell.beta')}
                            </Badge>
                          )}
                          {area.counter && (
                            <Badge
                              variant="outline"
                              className="rounded px-1.5 py-0.5 text-[10px] font-bold text-inherit tabular-nums"
                            >
                              {area.counter}
                            </Badge>
                          )}
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
        <div className="flex items-center justify-between gap-2">
          {/* useUser() starts from localStorage in the browser but empty on the server, so SSR would mismatch. */}
          {isHydrated ? (
            <UserProfile
              user={user ?? null}
              subscriptionData={subscriptionData}
              isProUser={isProUser}
              isProStatusLoading={isLoading}
              isCustomInstructionsEnabled={isCustomInstructionsEnabled}
              setIsCustomInstructionsEnabled={setIsCustomInstructionsEnabled}
              settingsOpen={settingsOpen}
              setSettingsOpen={handleSettingsOpenChange}
              settingsInitialTab={settingsInitialTab}
            />
          ) : (
            <div className="flex size-8 items-center justify-center">
              <div className="size-4 animate-pulse rounded-full bg-muted/50" />
            </div>
          )}
          <NavigationMenu />
          <LanguageSwitcher />
          {/* Separate group, otherwise its active ring shares layoutId with the switcher in the NavigationMenu dropdown. */}
          <LayoutGroup id="shell-rail-theme">
            <ThemeSwitcher />
          </LayoutGroup>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
