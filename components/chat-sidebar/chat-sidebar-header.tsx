/**
 * ChatSidebarHeader component with "New Chat" button.
 * @module components/chat-sidebar/chat-sidebar-header
 */

'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

/**
 * Props for the ChatSidebarHeader component.
 */
export interface ChatSidebarHeaderProps {
  /** Optional callback when new chat is clicked */
  onNewChat?: () => void;
}

/**
 * Header component for the chat sidebar with a "New Chat" button.
 * @param props - Component props
 * @returns Header component with new chat action
 */
export function ChatSidebarHeader({ onNewChat }: ChatSidebarHeaderProps) {
  const { setOpenMobile, isMobile } = useSidebar();

  const handleNewChatClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
    onNewChat?.();
  };

  return (
    <SidebarHeader className="border-b border-sidebar-border">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            size="lg"
            className={cn(
              'w-full justify-start gap-2',
              'bg-primary text-primary-foreground',
              'hover:bg-primary/90 hover:text-primary-foreground',
            )}
            tooltip="Neuer Chat"
          >
            <Link href="/new" onClick={handleNewChatClick}>
              <Plus className="size-4" />
              <span>Neuer Chat</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}
