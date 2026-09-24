'use client';

import { useCallback } from 'react';
import type { UseChatHistoryReturn } from '@/hooks/use-chat-history';

interface ChatListDependencies {
  push: (href: string) => void;
  notify: (message: string) => void;
  invalidate: () => void;
  translate: (key: 'untitledChat' | 'openingChat', values?: { title: string }) => string;
}

/**
 * Share chat selection and deletion behavior between the sidebar and full-page list.
 * @param history - Loaded chats, active chat ID and the existing delete mutation.
 * @param dependencies - Navigation, notifications, translations and cache invalidation.
 * @returns Selection and deletion handlers; deleting the open chat returns home.
 */
export function useChatListController(
  { allChats, currentChatId, deleteChat }: Pick<UseChatHistoryReturn, 'allChats' | 'currentChatId' | 'deleteChat'>,
  { push, notify, invalidate, translate }: ChatListDependencies,
) {
  const handleSelectChat = useCallback((chatId: string) => {
    const chat = allChats.find((entry) => entry.id === chatId);
    const title = chat?.title || translate('untitledChat');
    notify(translate('openingChat', { title }));
    invalidate();
    push(`/search/${chatId}`);
  }, [allChats, push, notify, invalidate, translate]);

  const handleDeleteChat = useCallback(async (chatId: string) => {
    await deleteChat(chatId);
    if (currentChatId === chatId) push('/');
  }, [deleteChat, currentChatId, push]);

  return { handleSelectChat, handleDeleteChat };
}
