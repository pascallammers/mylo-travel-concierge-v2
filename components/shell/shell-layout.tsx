'use client';

import type { CSSProperties, ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { usePathname } from '@/i18n/navigation';
import { isConversationPath } from '@/lib/shell';
import { cn } from '@/lib/utils';
import type { RailWertzahl } from '@/lib/valuation/wertzahl-loader';
import { ShellRail } from './shell-rail';
import { ShellModeProvider } from './shell-mode';
import { ShellSettingsProvider } from './shell-settings';
import { MobileAreaHead } from './mobile-area-head';
import { MobileBar } from './mobile-bar';

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
  const showMobileChrome = !isConversationPath(usePathname());

  return (
    <ShellSettingsProvider>
      <SidebarProvider
        defaultOpen={defaultOpen}
        style={{ '--sidebar-width': '16rem' } as CSSProperties}
        className={cn(
          '[--shell-head-h:0px] [--shell-bar-h:0px]',
          showMobileChrome && 'max-md:[--shell-head-h:3rem] max-md:[--shell-bar-h:calc(3.5rem+env(safe-area-inset-bottom))]',
        )}
      >
        <ShellRail wertzahl={wertzahl} />
        <SidebarInset className="min-w-0 pb-(--shell-bar-h) max-md:overflow-x-clip">
          <ShellModeProvider>
            {showMobileChrome && <MobileAreaHead wertzahl={wertzahl} />}
            {children}
            {showMobileChrome && <MobileBar />}
          </ShellModeProvider>
        </SidebarInset>
      </SidebarProvider>
    </ShellSettingsProvider>
  );
}
