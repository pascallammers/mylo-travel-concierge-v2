/**
 * ChatSidebar main container component.
 * Integrates header, search, and list components with the useChatHistory hook.
 * @module components/chat-sidebar/chat-sidebar
 */

'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Sidebar, SidebarRail } from '@/components/ui/sidebar';
import { useChatHistory, ChatHistoryUser } from '@/hooks/use-chat-history';
import { invalidateChatsCache } from '@/lib/utils';
import { ChatSidebarHeader } from './chat-sidebar-header';
import { ChatSidebarSearch } from './chat-sidebar-search';
import { ChatSidebarList } from './chat-sidebar-list';
import { useChatListController } from './use-chat-list-controller';

/**
 * Props for the ChatSidebar component.
 */
export interface ChatSidebarProps {
  /** The authenticated user (null if not logged in) */
  user: ChatHistoryUser | null;
  /** Optional CSS class name */
  className?: string;
  /** Sidebar variant style */
  variant?: 'sidebar' | 'floating' | 'inset';
  /** Collapsible behavior */
  collapsible?: 'offcanvas' | 'icon' | 'none';
}

/**
 * Main sidebar component for chat history management.
 * Provides search, categorization, and CRUD operations for chats.
 * @param props - Component props
 * @returns Complete chat sidebar with all functionality
 */
export function ChatSidebar({
  user,
  className,
  variant = 'sidebar',
  collapsible = 'offcanvas',
}: ChatSidebarProps) {
  const router = useRouter();
  const t = useTranslations('chatHistory');

  const {
    // Query state
    allChats,
    filteredChats,
    categorizedChats,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,

    // Search state
    searchQuery,
    setSearchQuery,
    searchMode,
    cycleSearchMode,

    // Current chat context
    currentChatId,

    // Mutations
    deleteChat,
    updateChatTitle,
    isDeletingChat,
    isUpdatingTitle,

    // State management
    deletingChatId,
    setDeletingChatId,
    editingChatId,
    setEditingChatId,
    editingTitle,
    setEditingTitle,
  } = useChatHistory({
    user,
    isOpen: true, // Sidebar is always "open" in terms of data fetching
  });

  const { handleSelectChat, handleDeleteChat } = useChatListController(
    { allChats, currentChatId, deleteChat },
    { push: router.push, notify: toast.info, invalidate: invalidateChatsCache, translate: t },
  );

  // If user is not logged in, show minimal sidebar
  if (!user) {
    return (
      <Sidebar variant={variant} collapsible={collapsible} className={className}>
        <ChatSidebarHeader />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-sm text-muted-foreground">
            <p>{t('signInToSee')}</p>
            <p>{t('signInToSee2')}</p>
          </div>
        </div>
        <SidebarRail />
      </Sidebar>
    );
  }

  return (
    <Sidebar variant={variant} collapsible={collapsible} className={className}>
      <ChatSidebarHeader />
      
      <ChatSidebarSearch
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchMode={searchMode}
        onCycleMode={cycleSearchMode}
      />

      <ChatSidebarList
        categorizedChats={categorizedChats}
        allChats={searchQuery ? filteredChats : allChats}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
        currentChatId={currentChatId}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        onUpdateChatTitle={updateChatTitle}
        isDeletingChat={isDeletingChat}
        isUpdatingTitle={isUpdatingTitle}
        editingChatId={editingChatId}
        editingTitle={editingTitle}
        onSetEditingChatId={setEditingChatId}
        onSetEditingTitle={setEditingTitle}
        deletingChatId={deletingChatId}
        onSetDeletingChatId={setDeletingChatId}
        searchQuery={searchQuery}
      />

      <SidebarRail />
    </Sidebar>
  );
}
