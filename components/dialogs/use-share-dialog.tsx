'use client';

import { useState, useCallback } from 'react';

interface UseShareDialogProps {
  chatId?: string;
  currentVisibility: 'public' | 'private';
  onVisibilityChange: (visibility: 'public' | 'private') => Promise<void>;
  isOwner?: boolean;
}

interface UseShareDialogReturn {
  isOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  shareDialogProps: {
    isOpen: boolean;
    onClose: () => void;
    chatId: string;
    currentVisibility: 'public' | 'private';
    onVisibilityChange: (visibility: 'public' | 'private') => Promise<void>;
    isOwner: boolean;
  } | null;
}

export function useShareDialog({
  chatId,
  currentVisibility,
  onVisibilityChange,
  isOwner = true,
}: UseShareDialogProps): UseShareDialogReturn {
  const [isOpen, setIsOpen] = useState(false);

  const openDialog = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Only return props if we have a valid chatId and user is owner
  const shareDialogProps = chatId && isOwner ? {
    isOpen,
    onClose: closeDialog,
    chatId,
    currentVisibility,
    onVisibilityChange,
    isOwner,
  } : null;

  return {
    isOpen,
    openDialog,
    closeDialog,
    shareDialogProps,
  };
}
