'use client';

import { MessageSquare, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ChatSidebarList, ChatSidebarSearch, useChatListController } from '@/components/chat-sidebar';
import { Button } from '@/components/ui/button';
import { useChatHistory, type ChatHistoryUser } from '@/hooks/use-chat-history';
import { Link, useRouter } from '@/i18n/navigation';
import { invalidateChatsCache } from '@/lib/utils';

/**
 * Show chat history as the full-page entry to Hey Mylo.
 * @param props - Authenticated user ID used by the shared history query.
 * @returns Searchable chat history with a new-chat action and an initial empty state.
 */
export function ChatListView({ user }: { user: ChatHistoryUser | null }) {
  const t = useTranslations('shell');
  const tHistory = useTranslations('chatHistory');
  const router = useRouter();
  const history = useChatHistory({ user, isOpen: true });
  const { handleSelectChat, handleDeleteChat } = useChatListController(history, {
    push: router.push,
    notify: toast.info,
    invalidate: invalidateChatsCache,
    translate: tHistory,
  });
  const newChatButton = (
    <Button asChild>
      <Link href="/chat/new"><Plus aria-hidden="true" />{t('chat.newChat')}</Link>
    </Button>
  );

  return (
    <section className="flex h-[calc(100dvh-var(--shell-head-h,0px)-var(--shell-bar-h,0px))] min-h-0 w-full flex-col overflow-hidden p-4 sm:p-6" aria-labelledby="chat-list-title">
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 pb-6">
          <div className="flex items-center gap-2">
            <h1 id="chat-list-title" className="text-2xl font-semibold tracking-tight">{t('areas.chat')}</h1>
          </div>
          {user && newChatButton}
        </header>
        {!user ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">{t('chat.signInPrompt')}</p>
            <Button asChild variant="secondary">
              <Link href="/sign-in">{t('chat.signIn')}</Link>
            </Button>
          </div>
        ) : (
          <>
            <ChatSidebarSearch
              searchQuery={history.searchQuery}
              onSearchChange={history.setSearchQuery}
              searchMode={history.searchMode}
              onCycleMode={history.cycleSearchMode}
            />
            {!history.isLoading && history.allChats.length === 0 && !history.searchQuery ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto py-12 text-center">
                <MessageSquare className="size-10 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-lg font-medium">{t('chat.emptyTitle')}</h2>
                <p className="max-w-sm text-sm text-muted-foreground">{t('chat.emptyBody')}</p>
                {newChatButton}
              </div>
            ) : (
              <ChatSidebarList
                categorizedChats={history.categorizedChats}
                allChats={history.searchQuery ? history.filteredChats : history.allChats}
                isLoading={history.isLoading}
                isFetchingNextPage={history.isFetchingNextPage}
                hasNextPage={history.hasNextPage}
                fetchNextPage={history.fetchNextPage}
                currentChatId={history.currentChatId}
                onSelectChat={handleSelectChat}
                onDeleteChat={handleDeleteChat}
                onUpdateChatTitle={history.updateChatTitle}
                isDeletingChat={history.isDeletingChat}
                isUpdatingTitle={history.isUpdatingTitle}
                editingChatId={history.editingChatId}
                editingTitle={history.editingTitle}
                onSetEditingChatId={history.setEditingChatId}
                onSetEditingTitle={history.setEditingTitle}
                deletingChatId={history.deletingChatId}
                onSetDeletingChatId={history.setDeletingChatId}
                searchQuery={history.searchQuery}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
