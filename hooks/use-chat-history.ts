/**
 * Custom hook for managing chat history state, queries, and mutations.
 * Provides search, filtering, categorization, and CRUD operations for chats.
 * @module hooks/use-chat-history
 */

'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { deleteChat, getUserChats, loadMoreChats, updateChatTitle } from '@/app/actions';
import { invalidateChatsCache } from '@/lib/utils';
import {
  Chat,
  SearchMode,
  CategorizedChats,
  isValidChatId,
  categorizeChatsByDate,
  advancedSearch,
  getNextSearchMode,
} from '@/lib/chat-utils';

// Re-export types for convenience
export type { Chat, SearchMode, CategorizedChats } from '@/lib/chat-utils';

/**
 * User type for authentication context.
 */
export interface ChatHistoryUser {
  id: string;
}

/**
 * Options for the useChatHistory hook.
 */
export interface UseChatHistoryOptions {
  /** The authenticated user */
  user: ChatHistoryUser | null;
  /** Whether the chat history is currently visible/open */
  isOpen?: boolean;
  /** Page size for infinite query */
  pageSize?: number;
  /** Stale time for the query in milliseconds */
  staleTime?: number;
}

/**
 * Return type for the useChatHistory hook.
 */
export interface UseChatHistoryReturn {
  // Query state
  allChats: Chat[];
  filteredChats: Chat[];
  categorizedChats: CategorizedChats;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  refetch: () => void;

  // Search state
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchMode: SearchMode;
  setSearchMode: (mode: SearchMode) => void;
  cycleSearchMode: () => void;

  // Current chat context
  currentChatId: string | null;

  // Mutations
  deleteChat: (id: string) => Promise<void>;
  updateChatTitle: (id: string, title: string) => Promise<void>;
  isDeletingChat: boolean;
  isUpdatingTitle: boolean;

  // State management for inline editing/deleting
  deletingChatId: string | null;
  setDeletingChatId: (id: string | null) => void;
  editingChatId: string | null;
  setEditingChatId: (id: string | null) => void;
  editingTitle: string;
  setEditingTitle: (title: string) => void;

  // Helpers
  resetEditState: () => void;
  resetDeleteState: () => void;
  resetAllState: () => void;
}

// Default constants
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_STALE_TIME = 30000; // 30 seconds
const TIME_UPDATE_INTERVAL = 30000; // 30 seconds

/**
 * Custom hook for managing chat history with search, filtering, and CRUD operations.
 * @param options - Configuration options
 * @returns Chat history state and operations
 */
export function useChatHistory(options: UseChatHistoryOptions): UseChatHistoryReturn {
  const {
    user,
    isOpen = true,
    pageSize = DEFAULT_PAGE_SIZE,
    staleTime = DEFAULT_STALE_TIME,
  } = options;

  const pathname = usePathname();
  const queryClient = useQueryClient();

  // Extract current chat ID from URL
  const rawChatId = pathname?.startsWith('/search/') ? pathname.split('/')[2] : null;
  const currentChatId = rawChatId && isValidChatId(rawChatId) ? rawChatId : null;

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('all');

  // Inline editing/deleting state
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Force update for timestamp refresh
  const [, forceUpdate] = useState({});
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Infinite query for paginated chat loading
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['chats', user?.id],
    queryFn: async ({ pageParam }) => {
      if (!user?.id) return { chats: [], hasMore: false };

      if (pageParam) {
        return await loadMoreChats(user.id, pageParam, pageSize);
      } else {
        return await getUserChats(user.id, pageSize);
      }
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.chats.length === 0) return undefined;
      return lastPage.chats[lastPage.chats.length - 1].id;
    },
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime,
    initialPageParam: undefined,
    initialData: user ? undefined : { pages: [{ chats: [], hasMore: false }], pageParams: [undefined] },
    gcTime: user ? 5 * 60 * 1000 : 0,
  });

  // Flatten all chats from all pages
  const allChats = useMemo(() => {
    return data?.pages.flatMap((page) => page.chats) || [];
  }, [data]);

  // Filter chats based on search query and mode
  const filteredChats = useMemo(() => {
    return allChats.filter((chat) => advancedSearch(chat, searchQuery, searchMode));
  }, [allChats, searchQuery, searchMode]);

  // Categorize filtered chats by date
  const categorizedChats = useMemo(() => {
    return categorizeChatsByDate(filteredChats);
  }, [filteredChats]);

  // Cycle through search modes
  const cycleSearchMode = useCallback(() => {
    setSearchMode((current) => getNextSearchMode(current));
  }, []);

  // Reset state helpers
  const resetEditState = useCallback(() => {
    setEditingChatId(null);
    setEditingTitle('');
  }, []);

  const resetDeleteState = useCallback(() => {
    setDeletingChatId(null);
  }, []);

  const resetAllState = useCallback(() => {
    setDeletingChatId(null);
    setEditingChatId(null);
    setEditingTitle('');
    setSearchQuery('');
    setSearchMode('all');
  }, []);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      resetAllState();
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }
    }
  }, [isOpen, resetAllState]);

  // Periodic update for real-time timestamps
  useEffect(() => {
    if (!isOpen) return;

    const updateTimes = () => {
      forceUpdate({});
      updateTimerRef.current = setTimeout(updateTimes, TIME_UPDATE_INTERVAL);
    };

    updateTimerRef.current = setTimeout(updateTimes, TIME_UPDATE_INTERVAL);

    return () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }
    };
  }, [isOpen]);

  // Refetch when dialog opens
  useEffect(() => {
    if (isOpen && user?.id) {
      refetch();
    }
  }, [isOpen, user?.id, refetch]);

  // Listen for cache invalidation events
  useEffect(() => {
    const handleCacheInvalidation = () => {
      if (user?.id) {
        refetch();
      }
    };

    window.addEventListener('invalidate-chats-cache', handleCacheInvalidation);
    return () => {
      window.removeEventListener('invalidate-chats-cache', handleCacheInvalidation);
    };
  }, [user?.id, refetch]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteChat(id);
    },
    onSuccess: (_, id) => {
      toast.success('Chat gelöscht');
      queryClient.setQueryData(['chats', user?.id], (oldData: unknown) => {
        if (!oldData) return oldData;
        const typedData = oldData as { pages: Array<{ chats: Chat[]; hasMore: boolean }> };
        return {
          ...typedData,
          pages: typedData.pages.map((page) => ({
            ...page,
            chats: page.chats.filter((chat) => chat.id !== id),
          })),
        };
      });
    },
    onError: (error) => {
      console.error('Failed to delete chat:', error);
      toast.error('Fehler beim Löschen des Chats. Bitte versuchen Sie es erneut.');
      queryClient.invalidateQueries({ queryKey: ['chats', user?.id] });
    },
  });

  // Update title mutation
  const updateTitleMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      return await updateChatTitle(id, title);
    },
    onSuccess: (updatedChat, { id, title }) => {
      if (updatedChat) {
        toast.success('Titel aktualisiert');
        queryClient.setQueryData(['chats', user?.id], (oldData: unknown) => {
          if (!oldData) return oldData;
          const typedData = oldData as { pages: Array<{ chats: Chat[]; hasMore: boolean }> };
          return {
            ...typedData,
            pages: typedData.pages.map((page) => ({
              ...page,
              chats: page.chats.map((chat) =>
                chat.id === id ? { ...chat, title } : chat
              ),
            })),
          };
        });
      } else {
        toast.error('Fehler beim Aktualisieren des Titels. Bitte versuchen Sie es erneut.');
      }
    },
    onError: (error) => {
      console.error('Failed to update chat title:', error);
      toast.error('Fehler beim Aktualisieren des Titels. Bitte versuchen Sie es erneut.');
    },
  });

  // Wrapped mutation functions
  const handleDeleteChat = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync(id);
      invalidateChatsCache();
    },
    [deleteMutation]
  );

  const handleUpdateChatTitle = useCallback(
    async (id: string, title: string) => {
      if (!title.trim()) {
        toast.error('Titel darf nicht leer sein');
        return;
      }
      if (title.trim().length > 100) {
        toast.error('Titel ist zu lang (max 100 Zeichen)');
        return;
      }
      await updateTitleMutation.mutateAsync({ id, title: title.trim() });
    },
    [updateTitleMutation]
  );

  return {
    // Query state
    allChats,
    filteredChats,
    categorizedChats,
    isLoading,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    fetchNextPage,
    refetch,

    // Search state
    searchQuery,
    setSearchQuery,
    searchMode,
    setSearchMode,
    cycleSearchMode,

    // Current chat context
    currentChatId,

    // Mutations
    deleteChat: handleDeleteChat,
    updateChatTitle: handleUpdateChatTitle,
    isDeletingChat: deleteMutation.isPending,
    isUpdatingTitle: updateTitleMutation.isPending,

    // State management
    deletingChatId,
    setDeletingChatId,
    editingChatId,
    setEditingChatId,
    editingTitle,
    setEditingTitle,

    // Helpers
    resetEditState,
    resetDeleteState,
    resetAllState,
  };
}
