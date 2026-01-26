/**
 * ChatSidebarList component with categorized chat list and infinite scroll.
 * @module components/chat-sidebar/chat-sidebar-list
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { History } from 'lucide-react';
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar';
import { Chat, CategorizedChats } from '@/lib/chat-utils';
import { ChatSidebarItem } from './chat-sidebar-item';
import { ClassicLoader } from '@/components/ui/loading';

// Constants for scroll behavior
const SCROLL_THRESHOLD = 0.8;
const INTERSECTION_ROOT_MARGIN = '100px';

/**
 * Category definition for rendering chat groups.
 */
interface CategoryConfig {
  key: keyof CategorizedChats;
  heading: string;
}

const CATEGORIES: CategoryConfig[] = [
  { key: 'today', heading: 'Heute' },
  { key: 'yesterday', heading: 'Gestern' },
  { key: 'thisWeek', heading: 'Diese Woche' },
  { key: 'lastWeek', heading: 'Letzte Woche' },
  { key: 'thisMonth', heading: 'Diesen Monat' },
  { key: 'older', heading: 'Älter' },
];

/**
 * Props for the ChatSidebarList component.
 */
export interface ChatSidebarListProps {
  /** Categorized chats to display */
  categorizedChats: CategorizedChats;
  /** All chats (for empty state check) */
  allChats: Chat[];
  /** Whether initial loading is in progress */
  isLoading: boolean;
  /** Whether fetching next page is in progress */
  isFetchingNextPage: boolean;
  /** Whether there are more pages to load */
  hasNextPage: boolean;
  /** Callback to fetch next page */
  fetchNextPage: () => void;
  /** ID of the currently active chat */
  currentChatId: string | null;
  /** Callback when a chat is selected */
  onSelectChat: (chatId: string) => void;
  /** Callback to delete a chat */
  onDeleteChat: (chatId: string) => Promise<void>;
  /** Callback to update chat title */
  onUpdateChatTitle: (chatId: string, title: string) => Promise<void>;
  /** Whether a delete operation is in progress */
  isDeletingChat: boolean;
  /** Whether a title update is in progress */
  isUpdatingTitle: boolean;
  /** ID of the chat being edited */
  editingChatId: string | null;
  /** Current editing title */
  editingTitle: string;
  /** Callback to set editing chat ID */
  onSetEditingChatId: (id: string | null) => void;
  /** Callback to set editing title */
  onSetEditingTitle: (title: string) => void;
  /** ID of the chat pending deletion */
  deletingChatId: string | null;
  /** Callback to set deleting chat ID */
  onSetDeletingChatId: (id: string | null) => void;
  /** Current search query (for empty state message) */
  searchQuery?: string;
}

/**
 * Scrollable list of categorized chats with infinite scroll support.
 * @param props - Component props
 * @returns Chat list with categories and infinite scroll
 */
export function ChatSidebarList({
  categorizedChats,
  allChats,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  currentChatId,
  onSelectChat,
  onDeleteChat,
  onUpdateChatTitle,
  isDeletingChat,
  isUpdatingTitle,
  editingChatId,
  editingTitle,
  onSetEditingChatId,
  onSetEditingTitle,
  deletingChatId,
  onSetDeletingChatId,
  searchQuery = '',
}: ChatSidebarListProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // Handle scroll for infinite loading
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      const scrolledPercentage = (scrollTop + clientHeight) / scrollHeight;

      if (scrolledPercentage > SCROLL_THRESHOLD && hasNextPage && !isFetchingNextPage && !isLoading) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, isLoading, fetchNextPage],
  );

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const trigger = loadMoreTriggerRef.current;
    const content = contentRef.current;

    if (!trigger || !content) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage && !isLoading) {
          fetchNextPage();
        }
      },
      {
        root: content,
        rootMargin: INTERSECTION_ROOT_MARGIN,
        threshold: 0.1,
      },
    );

    observer.observe(trigger);

    return () => {
      observer.unobserve(trigger);
    };
  }, [hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  // Loading skeleton
  if (isLoading) {
    return (
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Kürzliche Unterhaltungen</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {Array.from({ length: 5 }).map((_, i) => (
                <SidebarMenuSkeleton key={`skeleton-${i}`} showIcon />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    );
  }

  // Empty state
  if (allChats.length === 0) {
    return (
      <SidebarContent className="flex items-center justify-center">
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <History className="size-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Keine Unterhaltungen</p>
          {searchQuery ? (
            <div className="text-xs text-muted-foreground mt-2 space-y-1">
              <p>Versuchen Sie einen anderen Suchbegriff</p>
              <div className="text-[10px] text-muted-foreground/70 mt-2">
                <p>Suchtipps:</p>
                <p>• <code className="bg-muted px-1 rounded">public:</code> oder <code className="bg-muted px-1 rounded">private:</code></p>
                <p>• <code className="bg-muted px-1 rounded">today:</code>, <code className="bg-muted px-1 rounded">week:</code>, <code className="bg-muted px-1 rounded">month:</code></p>
                <p>• <code className="bg-muted px-1 rounded">date:22/05/25</code></p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Starten Sie einen neuen Chat
            </p>
          )}
        </div>
      </SidebarContent>
    );
  }

  // Render categories
  const hasAnyChats = CATEGORIES.some(({ key }) => categorizedChats[key].length > 0);

  if (!hasAnyChats && searchQuery) {
    return (
      <SidebarContent className="flex items-center justify-center">
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <History className="size-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Keine Ergebnisse</p>
          <p className="text-xs text-muted-foreground mt-1">
            Keine Chats für &quot;{searchQuery}&quot; gefunden
          </p>
        </div>
      </SidebarContent>
    );
  }

  return (
    <SidebarContent ref={contentRef} onScroll={handleScroll}>
      {CATEGORIES.map(({ key, heading }) => {
        const chats = categorizedChats[key];
        if (chats.length === 0) return null;

        return (
          <SidebarGroup key={key}>
            <SidebarGroupLabel>{heading}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {chats.map((chat) => (
                  <ChatSidebarItem
                    key={chat.id}
                    chat={chat}
                    isActive={currentChatId === chat.id}
                    onSelect={onSelectChat}
                    onDelete={onDeleteChat}
                    onUpdateTitle={onUpdateChatTitle}
                    isDeleting={isDeletingChat}
                    isUpdating={isUpdatingTitle}
                    editingChatId={editingChatId}
                    editingTitle={editingTitle}
                    onSetEditingChatId={onSetEditingChatId}
                    onSetEditingTitle={onSetEditingTitle}
                    deletingChatId={deletingChatId}
                    onSetDeletingChatId={onSetDeletingChatId}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        );
      })}

      {/* Infinite scroll trigger */}
      {hasNextPage && (
        <div ref={loadMoreTriggerRef} className="flex items-center justify-center py-2 px-3">
          {isFetchingNextPage ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ClassicLoader size="sm" />
              <span>Lade mehr...</span>
            </div>
          ) : (
            <div className="h-1" />
          )}
        </div>
      )}
    </SidebarContent>
  );
}
