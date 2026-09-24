'use client';

import type { ComponentProps } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Navbar } from '@/components/navbar';
import { SettingsDialog } from '@/components/settings-dialog';
import { ChatShareAction } from '@/components/share';
import { Button } from '@/components/ui/button';
import { useSidebarOptional } from '@/components/ui/sidebar';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/**
 * Render local chat navigation and sharing without covering the category rail.
 * @param props - Existing chat header data and controlled settings dialog state.
 * @returns The shell chat header and the settings dialog used by chat callbacks.
 */
export function ChatHead({
  isDialogOpen, chatId, selectedVisibilityType, onVisibilityChange, status, user, isOwner = true,
  subscriptionData, isProUser, isProStatusLoading, isCustomInstructionsEnabled,
  setIsCustomInstructionsEnabled, settingsOpen, setSettingsOpen, settingsInitialTab,
}: ComponentProps<typeof Navbar>) {
  const t = useTranslations('shell.chat');
  const sidebar = useSidebarOptional();
  return (
    <>
      <header className={cn(
        'fixed left-0 right-0 top-0 z-30 flex items-center justify-between gap-2 p-3 transition-[left,background-color] duration-200',
        sidebar?.open ? 'md:left-[var(--sidebar-width)]' : 'md:left-0',
        isDialogOpen
          ? 'bg-transparent pointer-events-none'
          : status === 'streaming' || status === 'ready'
            ? 'bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60'
            : 'bg-background',
      )}>
        <div className="pointer-events-auto flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/chat"><ArrowLeft aria-hidden="true" />{t('allChats')}</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/chat/new"><Plus aria-hidden="true" /><span className="sr-only sm:not-sr-only">{t('newChat')}</span></Link>
          </Button>
        </div>
        <div className="pointer-events-auto flex items-center gap-1">
          <ChatShareAction
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
            onVisibilityChange={onVisibilityChange}
            user={user}
            isOwner={isOwner}
            labels={{ share: t('share'), shared: t('shared'), sharedPage: t('sharedPage'), sharedByOther: t('sharedByOther') }}
          />
        </div>
      </header>
      {settingsOpen !== undefined && setSettingsOpen && (
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          user={user}
          subscriptionData={subscriptionData}
          isProUser={isProUser}
          isProStatusLoading={isProStatusLoading}
          isCustomInstructionsEnabled={isCustomInstructionsEnabled}
          setIsCustomInstructionsEnabled={setIsCustomInstructionsEnabled}
          initialTab={settingsInitialTab}
        />
      )}
    </>
  );
}
