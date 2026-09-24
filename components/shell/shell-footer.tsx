'use client';

import { useSyncExternalStore } from 'react';
import { LayoutGroup } from 'motion/react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { NavigationMenu, UserProfile } from '@/components/user-profile';
import { useUser } from '@/contexts/user-context';
import { useShellSettings } from './shell-settings';

const subscribeToNothing = () => () => {};

function useIsHydrated(): boolean {
  return useSyncExternalStore(subscribeToNothing, () => true, () => false);
}

/**
 * Share account and appearance controls between the rail and More sheet.
 * @param props - Unique motion group and optional callback to dismiss the enclosing sheet.
 * @returns Hydration-safe footer controls that open the persistent settings dialog.
 */
export function ShellFooter({ layoutGroupId, onOpenSettings }: { layoutGroupId: string; onOpenSettings?: () => void }) {
  const { user, subscriptionData, isProUser, isLoading } = useUser();
  const isHydrated = useIsHydrated();
  const settings = useShellSettings();

  return (
    <div className="flex items-center justify-between gap-2">
      {/* Browser-cached user data differs from the empty server snapshot until hydration. */}
      {isHydrated ? (
        <UserProfile
          user={user ?? null}
          subscriptionData={subscriptionData}
          isProUser={isProUser}
          isProStatusLoading={isLoading}
          setSettingsOpen={(open) => {
            if (!open) return;
            onOpenSettings?.();
            settings.open();
          }}
        />
      ) : (
        <div className="flex size-8 items-center justify-center">
          <div className="size-4 animate-pulse rounded-full bg-muted/50" />
        </div>
      )}
      <NavigationMenu />
      <LanguageSwitcher />
      {/* Each surface needs its own scope for the theme switcher's shared layoutId. */}
      <LayoutGroup id={layoutGroupId}>
        <ThemeSwitcher />
      </LayoutGroup>
    </div>
  );
}
