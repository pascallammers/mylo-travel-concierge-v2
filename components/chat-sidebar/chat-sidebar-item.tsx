/**
 * ChatSidebarItem component for displaying a single chat in the sidebar.
 * Supports inline editing, delete confirmation, and active state highlighting.
 * @module components/chat-sidebar/chat-sidebar-item
 */

'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Globe, Lock, Pencil, Trash, Check, X } from 'lucide-react';
import { SidebarMenuItem, SidebarMenuButton, SidebarMenuAction, useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Chat, formatCompactTime } from '@/lib/chat-utils';

/**
 * Props for the ChatSidebarItem component.
 */
export interface ChatSidebarItemProps {
  /** The chat to display */
  chat: Chat;
  /** Whether this chat is currently active */
  isActive: boolean;
  /** Callback when chat is selected */
  onSelect: (chatId: string) => void;
  /** Callback to delete the chat */
  onDelete: (chatId: string) => Promise<void>;
  /** Callback to update the chat title */
  onUpdateTitle: (chatId: string, title: string) => Promise<void>;
  /** Whether a delete operation is in progress */
  isDeleting: boolean;
  /** Whether a title update is in progress */
  isUpdating: boolean;
  /** ID of the chat being edited (null if none) */
  editingChatId: string | null;
  /** Current editing title value */
  editingTitle: string;
  /** Callback to set editing chat ID */
  onSetEditingChatId: (id: string | null) => void;
  /** Callback to set editing title */
  onSetEditingTitle: (title: string) => void;
  /** ID of the chat pending deletion (null if none) */
  deletingChatId: string | null;
  /** Callback to set deleting chat ID */
  onSetDeletingChatId: (id: string | null) => void;
}

/**
 * Individual chat item component with edit/delete functionality.
 * @param props - Component props
 * @returns Chat item with actions
 */
export function ChatSidebarItem({
  chat,
  isActive,
  onSelect,
  onDelete,
  onUpdateTitle,
  isDeleting,
  isUpdating,
  editingChatId,
  editingTitle,
  onSetEditingChatId,
  onSetEditingTitle,
  deletingChatId,
  onSetDeletingChatId,
}: ChatSidebarItemProps) {
  const { setOpenMobile, isMobile } = useSidebar();
  const isPublic = chat.visibility === 'public';
  const isEditingThis = editingChatId === chat.id;
  const isDeletingThis = deletingChatId === chat.id;
  const displayTitle = chat.title || 'Unbenannte Unterhaltung';

  const handleSelect = useCallback(() => {
    if (!isEditingThis && !isDeletingThis) {
      if (isMobile) {
        setOpenMobile(false);
      }
      onSelect(chat.id);
    }
  }, [chat.id, isEditingThis, isDeletingThis, isMobile, setOpenMobile, onSelect]);

  const handleStartEdit = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isDeletingThis) return;
      onSetEditingChatId(chat.id);
      onSetEditingTitle(chat.title || '');
    },
    [chat.id, chat.title, isDeletingThis, onSetEditingChatId, onSetEditingTitle],
  );

  const handleSaveEdit = useCallback(
    async (e: React.MouseEvent | React.KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!editingTitle.trim()) return;
      await onUpdateTitle(chat.id, editingTitle.trim());
      onSetEditingChatId(null);
      onSetEditingTitle('');
    },
    [chat.id, editingTitle, onUpdateTitle, onSetEditingChatId, onSetEditingTitle],
  );

  const handleCancelEdit = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSetEditingChatId(null);
      onSetEditingTitle('');
    },
    [onSetEditingChatId, onSetEditingTitle],
  );

  const handleStartDelete = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSetDeletingChatId(chat.id);
    },
    [chat.id, onSetDeletingChatId],
  );

  const handleConfirmDelete = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      await onDelete(chat.id);
      onSetDeletingChatId(null);
    },
    [chat.id, onDelete, onSetDeletingChatId],
  );

  const handleCancelDelete = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSetDeletingChatId(null);
    },
    [onSetDeletingChatId],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSaveEdit(e);
      } else if (e.key === 'Escape') {
        onSetEditingChatId(null);
        onSetEditingTitle('');
      }
    },
    [handleSaveEdit, onSetEditingChatId, onSetEditingTitle],
  );

  // Delete confirmation state
  if (isDeletingThis) {
    return (
      <SidebarMenuItem>
        <div
          className={cn(
            'flex items-center gap-2 w-full p-2 rounded-md',
            'bg-red-50 dark:bg-red-950/20',
            'border border-red-200 dark:border-red-800',
          )}
        >
          <span className="flex-1 truncate text-sm text-red-700 dark:text-red-300 font-medium">
            &quot;{displayTitle}&quot; löschen?
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
            onClick={handleConfirmDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <div className="h-3 w-3 animate-spin rounded-full border-b-2 border-red-600" />
            ) : (
              <Check className="h-3 w-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:bg-muted/50"
            onClick={handleCancelDelete}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </SidebarMenuItem>
    );
  }

  // Editing state
  if (isEditingThis) {
    return (
      <SidebarMenuItem>
        <div
          className={cn(
            'flex items-center gap-2 w-full p-2 rounded-md',
            'bg-muted/30 dark:bg-muted/20',
            'border border-muted-foreground/20',
          )}
        >
          <input
            type="text"
            value={editingTitle}
            onChange={(e) => onSetEditingTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-background border border-muted-foreground/10 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-muted-foreground/20"
            placeholder="Titel eingeben..."
            autoFocus
            maxLength={100}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-foreground hover:bg-muted"
            onClick={handleSaveEdit}
            disabled={isUpdating || !editingTitle.trim()}
          >
            {isUpdating ? (
              <div className="h-3 w-3 animate-spin rounded-full border-b-2 border-foreground" />
            ) : (
              <Check className="h-3 w-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:bg-muted/50"
            onClick={handleCancelEdit}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </SidebarMenuItem>
    );
  }

  // Normal state
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={displayTitle}
        className="pr-16"
      >
        <Link href={`/search/${chat.id}`} onClick={handleSelect}>
          {isPublic ? (
            <Globe
              className={cn(
                'size-4 shrink-0',
                isActive ? 'text-blue-600 dark:text-blue-400' : 'text-blue-500/70',
              )}
            />
          ) : (
            <Lock
              className={cn(
                'size-4 shrink-0',
                isActive ? 'text-foreground' : 'text-muted-foreground',
              )}
            />
          )}
          <span className="truncate">{displayTitle}</span>
        </Link>
      </SidebarMenuButton>

      {/* Timestamp badge */}
      <span className="absolute right-12 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground whitespace-nowrap pointer-events-none group-data-[collapsible=icon]:hidden">
        {formatCompactTime(new Date(chat.createdAt))}
      </span>

      {/* Edit action */}
      <SidebarMenuAction
        showOnHover
        onClick={handleStartEdit}
        className="right-6"
        disabled={!!editingChatId || !!deletingChatId}
      >
        <Pencil className="size-3" />
        <span className="sr-only">Titel bearbeiten</span>
      </SidebarMenuAction>

      {/* Delete action */}
      <SidebarMenuAction
        showOnHover
        onClick={handleStartDelete}
        className="text-muted-foreground hover:text-red-600"
        disabled={!!editingChatId || !!deletingChatId}
      >
        <Trash className="size-3" />
        <span className="sr-only">Chat löschen</span>
      </SidebarMenuAction>
    </SidebarMenuItem>
  );
}
