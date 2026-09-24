/**
 * Chat layout with sidebar integration.
 * Uses the category rail for admins and the chat sidebar for other users.
 * @module app/(chat)/layout
 */

import { cookies } from 'next/headers';
import { getUser, isAdmin } from '@/lib/auth-utils';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { ChatSidebar } from '@/components/chat-sidebar';
import { ShellLayout } from '@/components/shell';
import { getUserLoyaltyData } from '@/lib/db/queries/awardwallet';
import { readValuationTable } from '@/lib/valuation/runtime';
import { loadRailWertzahl, type RailWertzahl } from '@/lib/valuation/wertzahl-loader';

const SIDEBAR_COOKIE_NAME = 'sidebar_state';

/**
 * Wire the rail loader to server-only data sources without exposing them to client bundles.
 * @param userId - Authenticated MYLO user ID.
 * @returns Wertzahl promise for streaming through the shell.
 */
function loadRailWertzahlForUser(userId: string): Promise<RailWertzahl> {
  return loadRailWertzahl(userId, {
    loadLoyalty: getUserLoyaltyData,
    loadTable: readValuationTable,
    now: () => new Date(),
  });
}

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

  if (user && await isAdmin(user.id)) {
    const wertzahl = loadRailWertzahlForUser(user.id);
    return <ShellLayout defaultOpen={defaultOpen} wertzahl={wertzahl}>{children}</ShellLayout>;
  }
  
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
