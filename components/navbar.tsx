'use client';

/* eslint-disable @next/next/no-img-element */
import React, { memo, useMemo } from 'react';
import Link from 'next/link';
import { PlusIcon, GlobeHemisphereWestIcon } from '@phosphor-icons/react';

import { Button } from '@/components/ui/button';
import { UserProfile, NavigationMenu } from '@/components/user-profile';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LoyaltyHeaderWidget } from '@/components/awardwallet';
import { SidebarTrigger, useSidebarOptional } from '@/components/ui/sidebar';

import { ShareButton } from '@/components/share';
import { cn } from '@/lib/utils';

import { useRouter, usePathname } from 'next/navigation';
import { ComprehensiveUserData } from '@/lib/user-data-server';

type VisibilityType = 'public' | 'private';

interface NavbarProps {
  isDialogOpen: boolean;
  chatId: string | null;
  selectedVisibilityType: VisibilityType;
  onVisibilityChange: (visibility: VisibilityType) => void | Promise<void>;
  status: string;
  user: ComprehensiveUserData | null;
  isOwner?: boolean;
  subscriptionData?: any;
  isProUser?: boolean;
  isProStatusLoading?: boolean;
  isCustomInstructionsEnabled?: boolean;
  setIsCustomInstructionsEnabled?: (value: boolean | ((val: boolean) => boolean)) => void;
  settingsOpen?: boolean;
  setSettingsOpen?: (open: boolean) => void;
  settingsInitialTab?: string;
  onOpenSettingsWithTab?: (tab: string) => void;
}

const Navbar = memo(
  ({
    isDialogOpen,
    chatId,
    selectedVisibilityType,
    onVisibilityChange,
    status,
    user,
    isOwner = true,
    subscriptionData,
    isProUser,
    isProStatusLoading,
    isCustomInstructionsEnabled,
    setIsCustomInstructionsEnabled,
    settingsOpen,
    setSettingsOpen,
    settingsInitialTab,
    onOpenSettingsWithTab,
  }: NavbarProps) => {
    const router = useRouter();
    const pathname = usePathname();
    const isSearchWithId = useMemo(() => Boolean(pathname && /^\/search\/[^/]+/.test(pathname)), [pathname]);
    
    // Get sidebar context - will be null if not within SidebarProvider
    const sidebarContext = useSidebarOptional();
    const isMobile = sidebarContext?.isMobile ?? false;

    // Use passed Pro status directly
    const hasActiveSubscription = isProUser;
    const showProLoading = isProStatusLoading;

    return (
      <>
        <div
          className={cn(
            'fixed left-0 right-0 z-30 top-0 flex justify-between items-center p-3 transition-colors duration-200',
            isDialogOpen
              ? 'bg-transparent pointer-events-none'
              : status === 'streaming' || status === 'ready'
                ? 'bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60'
                : 'bg-background',
          )}
        >
          <div className={cn('flex items-center gap-2', isDialogOpen ? 'pointer-events-auto' : '')}>
            {/* Mobile Sidebar Trigger - only shown on mobile when user is logged in */}
            {user && isMobile && sidebarContext && (
              <SidebarTrigger className="pointer-events-auto" />
            )}
            <Link href="/new">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="rounded-lg bg-accent hover:bg-accent/80 group transition-all hover:scale-105 pointer-events-auto"
              >
                <PlusIcon size={16} className="group-hover:rotate-90 transition-all" />
                <span className="text-sm ml-1.5">Neuer Chat</span>
              </Button>
            </Link>
          </div>
          <div className={cn('flex items-center gap-1', isDialogOpen ? 'pointer-events-auto' : '')}>
            {/* Share functionality using unified component */}
            {chatId && (
              <>
                {user && isOwner ? (
                  /* Authenticated chat owners get share functionality */
                  <ShareButton
                    chatId={chatId}
                    selectedVisibilityType={selectedVisibilityType}
                    onVisibilityChange={async (visibility) => {
                      await Promise.resolve(onVisibilityChange(visibility));
                    }}
                    isOwner={isOwner}
                    user={user}
                    variant="navbar"
                    className="mr-1"
                    disabled={false}
                  />
                ) : (
                  /* Non-owners (authenticated or not) just see indicator */
                  selectedVisibilityType === 'public' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="pointer-events-auto bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 opacity-80 cursor-not-allowed"
                          disabled
                        >
                          <GlobeHemisphereWestIcon size={16} className="text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Shared</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" sideOffset={4}>
                        {user ? "This is someone else's shared page" : 'This is a shared page'}
                      </TooltipContent>
                    </Tooltip>
                  )
                )}
              </>
            )}

            {/* Subscription Status - show loading or Pro status only */}
            {user && isSearchWithId && (
              <>
                {showProLoading ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="rounded-md pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 border border-border">
                        <div className="size-4 rounded-full bg-muted animate-pulse" />
                        <div className="w-8 h-3 bg-muted rounded animate-pulse hidden sm:block" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={4}>
                      Loading subscription status...
                    </TooltipContent>
                  </Tooltip>
                ) : hasActiveSubscription ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="pointer-events-auto mr-1">
                        <span className="font-baumans! px-2.5 pt-0.5 pb-1.75 sm:pt-1 leading-4 inline-flex items-center gap-1 rounded-lg shadow-sm border-transparent ring-1 ring-ring/35 ring-offset-1 ring-offset-background bg-gradient-to-br from-secondary/25 via-primary/20 to-accent/25 text-foreground  dark:bg-gradient-to-br dark:from-primary dark:via-secondary dark:to-primary dark:text-foreground">
                          <span>pro</span>
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={4}>
                      Pro Subscribed - Unlimited access
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </>
            )}

            {/* Loyalty Programs Widget - only on mobile since desktop uses banner */}
            {user && isMobile && (
              <LoyaltyHeaderWidget
                onOpenSettings={() => {
                  onOpenSettingsWithTab?.('loyalty') ?? setSettingsOpen?.(true);
                }}
              />
            )}
            {/* Navigation Menu - settings icon for general navigation */}
            <NavigationMenu />
            {/* User Profile - focused on authentication and account management */}
            <UserProfile
              user={user}
              subscriptionData={subscriptionData}
              isProUser={isProUser}
              isProStatusLoading={isProStatusLoading}
              isCustomInstructionsEnabled={isCustomInstructionsEnabled}
              setIsCustomInstructionsEnabled={setIsCustomInstructionsEnabled}
              settingsOpen={settingsOpen}
              setSettingsOpen={setSettingsOpen}
              settingsInitialTab={settingsInitialTab}
            />
          </div>
        </div>
      </>
    );
  },
);

Navbar.displayName = 'Navbar';

export { Navbar };
