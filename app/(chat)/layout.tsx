/**
 * Chat layout with sidebar integration.
 * Wraps all chat-related pages with SidebarProvider and ChatSidebar.
 * @module app/(chat)/layout
 */

import { cookies } from 'next/headers';
import { getUser } from '@/lib/auth-utils';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { ChatSidebar } from '@/components/chat-sidebar';

const SIDEBAR_COOKIE_NAME = 'sidebar_state';

/**
 * Props for the ChatLayout component.
 */
interface ChatLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout component that wraps chat pages with sidebar functionality.
 * Reads sidebar state from cookie and passes user to ChatSidebar.
 * @param props - Layout props with children
 * @returns Layout with sidebar and main content area
 */
export default async function ChatLayout({ children }: ChatLayoutProps) {
  const cookieStore = await cookies();
  const sidebarStateCookie = cookieStore.get(SIDEBAR_COOKIE_NAME);
  
  // Parse cookie value, default to true if not set or invalid
  const defaultOpen = sidebarStateCookie?.value === 'false' ? false : true;

  const user = await getUser();
  
  // Map User to ChatHistoryUser format (only id needed)
  const chatHistoryUser = user ? { id: user.id } : null;

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <ChatSidebar user={chatHistoryUser} />
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
