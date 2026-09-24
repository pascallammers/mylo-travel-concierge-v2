'use client';

import { GlobeHemisphereWestIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ComprehensiveUserData } from '@/lib/user-data-server';
import { ShareButton } from './share-button';

export interface ChatShareActionProps {
  chatId: string | null;
  selectedVisibilityType: 'public' | 'private';
  onVisibilityChange: (visibility: 'public' | 'private') => void | Promise<void>;
  user: ComprehensiveUserData | null;
  isOwner?: boolean;
  labels?: { share: string; shared: string; sharedPage: string; sharedByOther: string };
}

/**
 * Render the shared owner action or the public-chat indicator used by both headers.
 * @param props - Chat visibility, ownership, user and optional localized shell labels.
 * @returns The existing share controls, or nothing without a shareable chat.
 */
export function ChatShareAction({
  chatId, selectedVisibilityType, onVisibilityChange, user, isOwner = true, labels,
}: ChatShareActionProps) {
  if (!chatId) return null;
  if (user && isOwner) {
    return (
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
        labels={labels}
      />
    );
  }
  if (selectedVisibilityType !== 'public') return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="pointer-events-auto bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 opacity-80 cursor-not-allowed"
          disabled
        >
          <GlobeHemisphereWestIcon size={16} className="text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{labels?.shared ?? 'Shared'}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        {user ? (labels?.sharedByOther ?? "This is someone else's shared page") : (labels?.sharedPage ?? 'This is a shared page')}
      </TooltipContent>
    </Tooltip>
  );
}
