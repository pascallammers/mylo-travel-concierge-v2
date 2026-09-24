import type { CSSProperties, ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { RailWertzahl } from '@/lib/valuation/wertzahl-loader';
import { ShellRail } from './shell-rail';

interface ShellLayoutProps {
  children: ReactNode;
  defaultOpen: boolean;
  wertzahl: Promise<RailWertzahl>;
}

/**
 * Wrap admin pages in the category rail and its shared sidebar state.
 * @param props - Page content, persisted rail visibility and server-loaded Wertzahl promise.
 * @returns The rail and main content with a 16rem desktop sidebar.
 */
export function ShellLayout({ children, defaultOpen, wertzahl }: ShellLayoutProps) {
  return (
    <SidebarProvider defaultOpen={defaultOpen} style={{ '--sidebar-width': '16rem' } as CSSProperties}>
      <ShellRail wertzahl={wertzahl} />
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </SidebarProvider>
  );
}
