/**
 * ChatSidebar main container component.
 * Integrates header, search, and list components with the useChatHistory hook.
 * @module components/chat-sidebar/chat-sidebar
 */

'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Sidebar, SidebarRail } from '@/components/ui/sidebar';
import { useChatHistory, ChatHistoryUser } from '@/hooks/use-chat-history';
import { invalidateChatsCache } from '@/lib/utils';
import { ChatSidebarHeader } from './chat-sidebar-header';
import { ChatSidebarSearch } from './chat-sidebar-search';
import { ChatSidebarList } from './chat-sidebar-list';

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

  const handleSelectChat = useCallback(
    (chatId: string) => {
      const chat = allChats.find((c) => c.id === chatId);
      const displayTitle = chat?.title || 'Unbenannte Unterhaltung';
      toast.info(`Öffne "${displayTitle}"...`);
      invalidateChatsCache();
      router.push(`/search/${chatId}`);
    },
    [allChats, router],
  );

  const handleDeleteChat = useCallback(
    async (chatId: string) => {
      await deleteChat(chatId);
      // Redirect to home if deleting current chat
      if (currentChatId === chatId) {
        router.push('/');
      }
    },
    [deleteChat, currentChatId, router],
  );

  // If user is not logged in, show minimal sidebar
  if (!user) {
    return (
      <Sidebar variant={variant} collapsible={collapsible} className={className}>
        <ChatSidebarHeader />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-sm text-muted-foreground">
            <p>Melden Sie sich an, um</p>
            <p>Ihren Chatverlauf zu sehen</p>
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
