import type { CSSProperties, ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { ShellRail } from './shell-rail';

interface ShellLayoutProps {
  children: ReactNode;
  defaultOpen: boolean;
}

/**
 * Wrap admin pages in the category rail and its shared sidebar state.
 * @param props - Page content and the persisted rail visibility.
 * @returns The rail and main content with a 16rem desktop sidebar.
 */
export function ShellLayout({ children, defaultOpen }: ShellLayoutProps) {
  return (
    <SidebarProvider defaultOpen={defaultOpen} style={{ '--sidebar-width': '16rem' } as CSSProperties}>
      <ShellRail />
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </SidebarProvider>
  );
}
